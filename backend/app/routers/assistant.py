import logging
from typing import Any
from fastapi import APIRouter, Depends, Query, status, HTTPException, Response

from ..models.schemas import ChatHistoryItem, ChatMessage, ChatResponse, UserOut, ChatSessionCreate, ChatSessionUpdate, ChatSessionOut
from ..routers.auth import current_user_dependency
from ..services.gemini_assistant import build_assistant_context
from ..services.store import get_store
from ..core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/assistant', tags=['assistant'])


def _chat_history_item(row: dict[str, Any]) -> ChatHistoryItem:
    return ChatHistoryItem(
        id=row['id'],
        scanId=row.get('scan_id'),
        patientId=row.get('patient_id'),
        sessionId=row.get('session_id'),
        question=row['question'],
        answer=row.get('answer'),
        language=row.get('language'),
        responseTime=row.get('response_time'),
        model=row.get('model'),
        tokensUsed=row.get('tokens_used'),
        feedback=row.get('feedback'),
        timestamp=row['created_at'],
    )


def _context_identifiers(context: dict[str, Any]) -> tuple[str | None, str | None]:
    scan = context.get('scan') if isinstance(context.get('scan'), dict) else {}
    patient = context.get('patient') if isinstance(context.get('patient'), dict) else {}
    return scan.get('scan_id'), patient.get('patient_id')


@router.get('/sessions', response_model=list[ChatSessionOut])
def list_sessions(user: UserOut = Depends(current_user_dependency)):
    rows = get_store().list_chat_sessions(user.id)
    return [ChatSessionOut(**row) for row in rows]


@router.post('/sessions', response_model=ChatSessionOut)
def create_session(payload: ChatSessionCreate, user: UserOut = Depends(current_user_dependency)):
    row = get_store().create_chat_session(
        user_id=user.id,
        title=payload.title,
        scan_id=payload.scan_id,
        patient_id=payload.patient_id,
    )
    return ChatSessionOut(**row)


@router.put('/sessions/{session_id}', response_model=ChatSessionOut)
def update_session(
    session_id: str,
    payload: ChatSessionUpdate,
    user: UserOut = Depends(current_user_dependency),
):
    row = get_store().update_chat_session(
        session_id=session_id,
        user_id=user.id,
        title=payload.title,
        is_archived=payload.is_archived,
        is_favorite=payload.is_favorite,
        language=payload.language,
    )
    if not row:
        raise HTTPException(status_code=404, detail='Chat session not found')
    return ChatSessionOut(**row)


@router.delete('/sessions/{session_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, user: UserOut = Depends(current_user_dependency)):
    deleted = get_store().delete_chat_session(session_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail='Chat session not found')
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get('/history', response_model=list[ChatHistoryItem])
def history(
    session_id: str | None = Query(default=None),
    scan_id: str | None = Query(default=None),
    patient_id: str | None = Query(default=None),
    user: UserOut = Depends(current_user_dependency),
):
    if session_id:
        rows = get_store().list_chat_history_by_session(user.id, session_id=session_id)
    else:
        rows = get_store().list_chat_history(user.id, scan_id=scan_id, patient_id=patient_id)
    return [_chat_history_item(row) for row in rows]


@router.post('/chat', response_model=ChatResponse)
def chat(payload: ChatMessage, user: UserOut = Depends(current_user_dependency)):
    from ..services.jemmi.conversation_manager import ConversationManager

    context = build_assistant_context(user, payload.context)
    scan_id, patient_id = _context_identifiers(context)

    res = ConversationManager.handle_chat_request(
        user_id=user.id,
        message=payload.message,
        patient_context=context,
        session_id=payload.session_id,
        scan_id=scan_id,
        patient_id=patient_id,
        file_name=payload.file_name,
        file_content=payload.file_content,
        file_type=payload.file_type,
        language=payload.language
    )

    return ChatResponse(
        answer=res['answer'],
        safety_note=res['safety_note'],
        clinical_explanation=res['clinical_explanation'],
        lifestyle_advice=res['lifestyle_advice'],
        next_steps=res['next_steps'],
        history_item=_chat_history_item(res['history_item']),
    )


@router.post('/stream')
def chat_stream(
    payload: ChatMessage,
    user: UserOut = Depends(current_user_dependency),
):
    from fastapi.responses import StreamingResponse
    from ..services.jemmi.conversation_manager import ConversationManager

    context = build_assistant_context(user, payload.context)
    scan_id, patient_id = _context_identifiers(context)

    generator = ConversationManager.handle_stream_request(
        user_id=user.id,
        message=payload.message,
        patient_context=context,
        session_id=payload.session_id,
        scan_id=scan_id,
        patient_id=patient_id,
        file_name=payload.file_name,
        file_content=payload.file_content,
        file_type=payload.file_type,
        language=payload.language
    )

    return StreamingResponse(generator, media_type="text/event-stream")


@router.post('/history/message/{message_id}/feedback', status_code=status.HTTP_200_OK)
def update_message_feedback(
    message_id: str,
    feedback: bool | None = Query(default=None),
    user: UserOut = Depends(current_user_dependency),
):
    import uuid
    try:
        uuid.UUID(message_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid message ID format',
        )

    updated = get_store().update_chat_message_feedback(message_id, user.id, feedback)
    if not updated:
        raise HTTPException(status_code=404, detail='Message not found')
    return {'status': 'ok'}


@router.delete('/history', status_code=status.HTTP_204_NO_CONTENT)
def clear_history(
    scan_id: str | None = Query(default=None),
    patient_id: str | None = Query(default=None),
    user: UserOut = Depends(current_user_dependency),
):
    get_store().clear_chat_history(user.id, scan_id=scan_id, patient_id=patient_id)
    return None
