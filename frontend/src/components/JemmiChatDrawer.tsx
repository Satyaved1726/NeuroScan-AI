import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MaterialIcon from './MaterialIcon';
import ProfileAvatar from './ProfileAvatar';
import { useToastContext } from '../hooks/useToastContext';
import { useAuth } from '../hooks/useAuth';
import { useProfilePhoto } from '../hooks/useProfilePhoto';
import { useLanguage } from '../hooks/useLanguage';
import { getAccessToken } from '../services/apiClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  feedback?: boolean | null;
  responseTime?: number | null;
  model?: string | null;
  tokensUsed?: number | null;
  timestamp?: string;
  fileName?: string | null;
  fileType?: string | null;
}

interface ChatSession {
  id: string;
  title: string;
  scan_id?: string | null;
  patient_id?: string | null;
  is_archived: boolean;
  is_favorite: boolean;
  language?: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatHistoryItem {
  id: string;
  scanId?: string | null;
  patientId?: string | null;
  sessionId?: string | null;
  question: string;
  answer?: string | null;
  language?: string | null;
  responseTime?: number | null;
  model?: string | null;
  tokensUsed?: number | null;
  feedback?: boolean | null;
  timestamp: string;
}

type ChatLanguage = 'English' | 'Telugu' | 'Hindi';

function getOfflineFallbackResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('prevent') || q.includes('avoid') || q.includes('progression')) {
    return `### 🛡️ Clinical Guidelines: Dementia Progression Prevention
[OFFLINE DIAGNOSTIC KB FALLBACK]

Based on localized medical guidelines, here are the key steps to support neurological health and mitigate progression:
1. **Regular Cognitive Engagement**: Encourage puzzles, reading, social interaction, and brain-stimulating hobbies.
2. **Physical Exercise**: At least 150 minutes of moderate aerobic activity weekly to stimulate cerebral blood flow.
3. **Cardiovascular Health**: Rigorously manage hypertension, diabetes, and hyperlipidemia, as vascular risk factors directly accelerate cognitive decline.
4. **Sleep Quality**: Ensure 7-8 hours of uninterrupted sleep to facilitate glymphatic brain clearance of toxic plaques.`;
  }

  if (q.includes('treat') || q.includes('medicat') || q.includes('donepezil') || q.includes('medicine')) {
    return `### 💊 Clinical Pharmacotherapy & Dementia Management
[OFFLINE DIAGNOSTIC KB FALLBACK]

Under standard clinical pathways for cognitive disorders:
1. **Cholinesterase Inhibitors**: Medications like *Donepezil*, *Rivastigmine*, or *Galantamine* are frequently indicated for mild-to-moderate stages to enhance synaptic transmission.
2. **NMDA Receptor Antagonists**: *Memantine* is commonly indicated for moderate-to-severe stages to protect against glutamate excitotoxicity.
3. **Comorbid Control**: Treat active secondary symptoms like sleep disruption or anxiety under strict clinician supervision.
*Disclaimer: All pharmacotherapies must be prescribed and monitored by a registered neurologist.*`;
  }

  if (q.includes('diet') || q.includes('eat') || q.includes('nutrition') || q.includes('habit') || q.includes('lifestyle')) {
    return `### 🥗 Brain Health Nutrition Guidelines
[OFFLINE DIAGNOSTIC KB FALLBACK]

The recommended dietary pattern for neuroprotection is the **MIND Diet** (Mediterranean-DASH Intervention for Neurodegenerative Delay):
*   **Green Leafy Vegetables**: Spinach, kale, and salads (minimum 6 servings/week).
*   **Berries**: Berries and strawberries (minimum 2 servings/week) for high antioxidant concentrations.
*   **Healthy Fats**: Extra virgin olive oil as the primary cooking oil.
*   **Whole Grains & Lean Proteins**: Poultry, fish, and nuts; minimize red meat, butter, and processed sugars.`;
  }

  if (q.includes('mild') || q.includes('stage') || q.includes('dement')) {
    return `### 🧠 Dementia Stages & MRI Diagnostics Overview
[OFFLINE DIAGNOSTIC KB FALLBACK]

Dementia progression is typically categorized via the Clinical Dementia Rating (CDR) scale:
*   **CDR 0 (Non-Demented)**: Normal cognitive function. MRI shows expected age-related brain volume.
*   **CDR 0.5 (Very Mild / MCI)**: Borderline cognitive impairment. Subtle short-term memory challenges.
*   **CDR 1 (Mild Dementia)**: Moderate impairment. Daily functions require minor assistance. MRI often demonstrates bilateral hippocampal atrophy.
*   **CDR 2 (Moderate) & CDR 3 (Severe)**: Pronounced decline. Continuous care is required. MRI reveals global cortical volume loss and ventricular enlargement.`;
  }

  return `### 🩺 NeuroScan AI Offline Clinical Reference
[OFFLINE DIAGNOSTIC KB FALLBACK]

I am currently running in **offline local knowledge mode** because the primary Jemmi AI streaming API is temporarily unreachable.

*   **Active Patient Context**: I am aware of your active patient record file.
*   **Clinical Inquiry**: To explore brain health, try asking about "Dementia Prevention", "Recommended Diets", or "Dementia Stage details".
*   **Support**: If you suspect a technical network issue, please contact your facility PACS IT administrator.`;
}

interface JemmiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export default function JemmiChatDrawer({ isOpen, onClose, onOpen }: JemmiChatDrawerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastContext();
  const { user } = useAuth();
  const { photoUrl } = useProfilePhoto();
  const { t } = useLanguage();

  // Dialog sizing state
  const [isMaximized, setIsMaximized] = useState(false);

  // Chat conversation states
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [staggeredStep, setStaggeredStep] = useState('');
  const [language, setLanguage] = useState<ChatLanguage>('English');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // Dictation states
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // TTS speech states
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [isSpeakingPaused, setIsSpeakingPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Document attachment context states
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // References to handle queuing and aborting
  const abortControllerRef = useRef<AbortController | null>(null);
  const responseCacheRef = useRef<Record<string, { answer: string; responseTime: number; model: string; tokensUsed: number }>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load browser voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Initialize dictation
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setInput((prev) => (prev ? `${prev} ${text}` : text));
        }
      };
      recognitionRef.current = rec;
    }
  }, []);

  // Auto-scroll messages list
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load session chat logs if activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      loadSessionHistory(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Handle active page scan URL parameters automatically to dynamically attach MRI context
  const activeContext = useMemo(() => {
    // If clinician is looking at a specific MRI result, inject it as context
    const pathMatch = location.pathname.match(/\/results\/([^\/]+)/);
    if (pathMatch) {
      return { scan_id: pathMatch[1] };
    }
    return undefined;
  }, [location.pathname]);

  const loadSessionHistory = async (sid: string) => {
    try {
      const token = getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/assistant/history?session_id=${sid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const logs: ChatHistoryItem[] = await response.json();
        const formatted: Message[] = [];
        logs.forEach((log) => {
          formatted.push({
            id: `${log.id}-question`,
            role: 'user',
            content: log.question,
            timestamp: log.timestamp
          });
          if (log.answer) {
            formatted.push({
              id: `${log.id}-answer`,
              role: 'assistant',
              content: log.answer,
              feedback: log.feedback,
              responseTime: log.responseTime,
              model: log.model,
              tokensUsed: log.tokensUsed,
              timestamp: log.timestamp
            });
          }
        });
        setMessages(formatted);
      }
    } catch {
      toast.error('Failed to load chat history');
    }
  };

  const handleToggleSpeak = (messageId: string, content: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech not supported on this browser');
      return;
    }

    if (currentlySpeakingId === messageId) {
      if (isSpeakingPaused) {
        window.speechSynthesis.resume();
        setIsSpeakingPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeakingPaused(true);
      }
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = content.replace(/[*#_`~-]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Default professional speech variables
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let targetVoice = voices.find((v) => v.lang.startsWith('en')) || null;
    if (targetVoice) utterance.voice = targetVoice;

    utterance.onend = () => {
      setCurrentlySpeakingId(null);
      setIsSpeakingPaused(false);
    };
    utterance.onerror = () => {
      setCurrentlySpeakingId(null);
      setIsSpeakingPaused(false);
    };

    setCurrentlySpeakingId(messageId);
    setIsSpeakingPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      setIsSpeakingPaused(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() && !attachedFile) return;

    if (isGenerating) {
      toast.info('Please wait for Jemmi to finish responding.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const tempId = `pending-${Date.now()}`;
    const userMessage: Message = {
      id: `${tempId}-question`,
      role: 'user',
      content: text || `Analyzed attachment: ${attachedFile?.name}`,
      fileName: attachedFile?.name,
      fileType: attachedFile?.type,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Check offline fallback triggers if API fails
    setIsLoading(true);
    setIsGenerating(true);
    setStaggeredStep('Classifying query intent...');

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      await delay(200);
      setStaggeredStep('Retrieving local patient indices...');
      await delay(200);
      setStaggeredStep('Processing response...');

      const token = getAccessToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/assistant/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          context: activeContext,
          language,
          session_id: activeSessionId,
          file_name: attachedFile?.name,
          file_content: attachedFile?.content,
          file_type: attachedFile?.type
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Streaming connection failed');
      }

      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('No reader available');

      let targetText = '';
      let resolvedSessionId = activeSessionId;
      const assistantMessageId = `assistant-stream-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          model: 'gemini-flash-latest',
          timestamp: new Date().toISOString()
        }
      ]);

      setStaggeredStep('');
      setIsLoading(false);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = decoder.decode(value);
          const lines = textChunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try {
                const data = JSON.parse(dataStr);
                if (data.event === 'session_created') {
                  resolvedSessionId = data.session_id;
                  setActiveSessionId(data.session_id);
                } else if (data.event === 'chunk') {
                  targetText += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: targetText } : msg
                    )
                  );
                } else if (data.event === 'completed') {
                  const history = data.history_item;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            id: `${history.id}-answer`,
                            content: history.answer,
                            responseTime: history.responseTime,
                            model: history.model,
                            tokensUsed: history.tokensUsed
                          }
                        : msg
                    )
                  );
                }
              } catch {
                // Skip partial chunk parsing failures
              }
            }
          }
        }
      } catch (streamErr) {
        throw streamErr;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      const offlineReply = getOfflineFallbackResponse(text);
      const assistantMessageId = `assistant-offline-${Date.now()}`;

      setMessages((prev) => {
        const pendingIdx = prev.findIndex(m => m.id.startsWith('assistant-stream-'));
        if (pendingIdx !== -1) {
          return prev.map((m, idx) =>
            idx === pendingIdx
              ? {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: offlineReply,
                  model: 'local-knowledge-base',
                  timestamp: new Date().toISOString(),
                  responseTime: 0.1,
                  tokensUsed: 120
                }
              : m
          );
        }
        return [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: offlineReply,
            model: 'local-knowledge-base',
            timestamp: new Date().toISOString(),
            responseTime: 0.1,
            tokensUsed: 120
          }
        ];
      });
      toast.warning('Using offline clinical knowledge base fallback');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setIsLoading(false);
      toast.info('Response generation stopped.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File exceeds the 2MB size limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachedFile({
        name: file.name,
        content: content || '',
        type: file.type || 'text/plain'
      });
      toast.success(`Attached ${file.name} successfully`);
    };
    reader.readAsText(file);
  };

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied response to clipboard');
  };

  const handleFeedback = async (messageId: string, helpful: boolean) => {
    try {
      const cleanId = messageId.replace('-answer', '');
      const token = getAccessToken();
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/assistant/history/message/${cleanId}/feedback?helpful=${helpful}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages((current) =>
        current.map((msg) =>
          msg.id === messageId ? { ...msg, feedback: helpful } : msg
        )
      );
      toast.success(helpful ? 'Feedback: Marked as helpful' : 'Feedback: Marked as unhelpful');
    } catch {
      toast.error('Could not submit feedback');
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((current) => current.filter((msg) => msg.id !== messageId));
    toast.success('Message removed from workspace view');
  };

  const handleClearChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    handleStopSpeaking();
    toast.success('Conversation cleared');
  };

  // High-End Custom Markdown and Card Renderer
  const renderInlineMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|__.*?__|__.*?__|\*.*?\*|_.*?_|`.*?`)/g;
    const splitParts = text.split(regex);

    splitParts.forEach((part, idx) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        parts.push(<strong key={idx} className="font-extrabold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>);
      } else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
        parts.push(<em key={idx} className="italic text-slate-700 dark:text-slate-350">{part.slice(1, -1)}</em>);
      } else if (part.startsWith('`') && part.endsWith('`')) {
        parts.push(
          <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0E1322]/80 border border-slate-200 dark:border-white/5 font-mono text-xs text-rose-500 dark:text-rose-400 font-bold">
            {part.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(part);
      }
    });
    return parts;
  };

  const renderMarkdownBlocks = (text: string) => {
    const blocks = text.split(/\n\n+/);
    return blocks.map((block, bIdx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Card Detection: MRI Diagnostic report card
      if (trimmed.startsWith('### 🧠 MRI Screening Summary') || trimmed.startsWith('### 🧠 Active Brain MRI')) {
        const lines = trimmed.split('\n');
        const header = lines[0].replace(/^###\s*/, '');
        const items = lines.slice(1).map(l => l.replace(/^[\*\-\•]\s+/, '').split(': '));

        return (
          <div key={bIdx} className="my-3 p-4 rounded-[20px] border border-sky-100 dark:border-sky-950/40 bg-gradient-to-br from-sky-50/50 to-indigo-50/30 dark:from-sky-950/20 dark:to-indigo-950/10 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 border-b border-sky-100 dark:border-sky-900/50 pb-2 mb-2">
              <MaterialIcon name="analytics" className="h-4.5 w-4.5 text-sky-500" />
              <h4 className="font-extrabold text-sky-900 dark:text-sky-300 text-xs uppercase tracking-wider">{header}</h4>
            </div>
            <div className="grid gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-355 text-left w-full">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between py-0.5 border-b border-sky-100/30 dark:border-sky-900/20">
                  <span className="text-slate-500 font-bold">{it[0]}</span>
                  <span className="text-slate-750 dark:text-slate-200 font-extrabold">{it[1] ? renderInlineMarkdown(it[1]) : 'N/A'}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      // Check if block is a table
      if (trimmed.startsWith('|') && trimmed.includes('\n|')) {
        const lines = trimmed.split('\n');
        const headers = lines[0].split('|').map(s => s.trim()).filter(Boolean);
        const rows = lines.slice(2).map(line => line.split('|').map(s => s.trim()).filter(Boolean)).filter(r => r.length > 0);
        return (
          <div key={bIdx} className="overflow-x-auto my-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="w-full text-[11px] text-left border-collapse bg-white dark:bg-[#181E32]/40">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-bold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition font-semibold text-slate-700 dark:text-slate-300">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2">{renderInlineMarkdown(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        const lines = trimmed.split('\n');
        return (
          <ol key={bIdx} className="list-decimal pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300 font-semibold text-xs leading-relaxed">
            {lines.map((line, idx) => {
              const itemText = line.replace(/^\d+\.\s+/, '');
              return <li key={idx}>{renderInlineMarkdown(itemText)}</li>;
            })}
          </ol>
        );
      }

      // Unordered list
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const lines = trimmed.split('\n');
        return (
          <ul key={bIdx} className="list-disc pl-5 my-2 space-y-1 text-slate-700 dark:text-slate-300 font-semibold text-xs leading-relaxed">
            {lines.map((line, idx) => {
              const itemText = line.replace(/^[\*\-\•]\s+/, '');
              return <li key={idx}>{renderInlineMarkdown(itemText)}</li>;
            })}
          </ul>
        );
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        return (
          <blockquote key={bIdx} className="border-l-4 border-clinical-primary bg-slate-50 dark:bg-slate-900/40 px-3 py-2 my-2 rounded-r-xl text-xs text-slate-600 dark:text-slate-300 italic font-semibold leading-relaxed">
            {renderInlineMarkdown(quoteText)}
          </blockquote>
        );
      }

      // Heading
      if (trimmed.startsWith('###')) {
        const headingText = trimmed.replace(/^###\s*/, '');
        return (
          <h4 key={bIdx} className="text-xs font-extrabold text-slate-900 dark:text-slate-100 mt-3 mb-1 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-0.5">
            {renderInlineMarkdown(headingText)}
          </h4>
        );
      }

      // General Paragraph
      return (
        <p key={bIdx} className="my-1.5 leading-relaxed text-xs text-slate-700 dark:text-slate-300 font-semibold">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  const getFollowUpChips = () => {
    if (activeContext?.scan_id) {
      return [
        'Explain MRI scan predictions',
        'Identify key risk indicators',
        'Suggest next diagnostic steps'
      ];
    }
    return [
      'What are common dementia warning signs?',
      'Explain MRI confidence scores',
      'What lifestyle habits support brain health?'
    ];
  };

  return (
    <>
      {/* Floating circular toggle button */}
      <button
        onClick={isOpen ? onClose : onOpen}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-clinical-primary to-emerald-600 hover:from-clinical-primary hover:to-emerald-500 text-white shadow-xl hover:shadow-clinical-primary/20 flex items-center justify-center cursor-pointer transition-transform duration-200 active:scale-95 z-[100] group"
        title="Chat with Jemmi AI"
        aria-label="Toggle chat assistant"
        aria-expanded={isOpen}
      >
        <AnimatePresence>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -45, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 45, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MaterialIcon name="close" className="h-6 w-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center"
            >
              <MaterialIcon name="psychology" className="h-6 w-6 text-white" />
              {isGenerating && (
                <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Popup Chat Window Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`fixed bottom-24 right-6 z-[99] bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 font-sans rounded-[24px] ${
              isMaximized
                ? 'w-[680px] max-w-[90vw] h-[600px] max-h-[80vh]'
                : 'w-[360px] md:w-[380px] h-[480px] md:h-[520px] max-h-[75vh]'
            }`}
            role="dialog"
            aria-label="Jemmi AI Assistant"
          >
            {/* Header section */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#152033] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-3xl bg-gradient-to-br from-clinical-primary to-emerald-600 text-white shadow-sm shrink-0">
                  <MaterialIcon name="psychology" className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 leading-tight">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xs truncate">Jemmi AI Assistant</h3>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wide flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Dementia Copilot
                  </p>
                </div>
              </div>

              {/* Utility actions */}
              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-1.5 rounded-3xl hover:bg-slate-200/50 dark:hover:bg-slate-800/80 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer"
                    title="Clear Conversation"
                  >
                    <MaterialIcon name="delete_sweep" className="h-4.5 w-4.5" />
                  </button>
                )}
                {/* Maximize/Restore Toggle Button (Only on screen sizes md and above) */}
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="hidden md:block p-1.5 rounded-3xl hover:bg-slate-200/50 dark:hover:bg-slate-800/80 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer"
                  title={isMaximized ? "Restore size" : "Maximize chat"}
                >
                  <MaterialIcon name={isMaximized ? "fullscreen_exit" : "fullscreen"} className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-3xl hover:bg-slate-200/50 dark:hover:bg-slate-800/80 hover:text-slate-700 dark:hover:text-slate-355 cursor-pointer"
                  title="Close Assistant"
                >
                  <MaterialIcon name="close" className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scroll-smooth bg-slate-50/20 dark:bg-[#1A2333]/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-6 max-w-sm mx-auto">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[24px] bg-clinical-primary/10 text-clinical-primary shadow-sm border border-clinical-primary/20">
                    <MaterialIcon name="psychology" className="h-8 w-8 text-clinical-primary" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Ask Jemmi anything</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1">
                      Query clinical MRI predictions, request simpler layout definitions, or explore brain diagnostic reports securely.
                    </p>
                  </div>
                  <div className="grid gap-2 w-full text-xs font-bold">
                    {getFollowUpChips().slice(0, 2).map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleSendMessage(chip)}
                        className="w-full text-left p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] hover:border-clinical-primary hover:text-clinical-primary transition cursor-pointer text-slate-700 dark:text-slate-300 font-semibold shadow-soft"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, mIndex) => {
                    const isUser = message.role === 'user';
                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 items-start ${isUser ? 'justify-end' : 'justify-start'} group`}
                      >
                        {/* Jemmi Avatar */}
                        {!isUser && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-3xl bg-gradient-to-br from-clinical-primary to-emerald-600 text-white shadow-sm shrink-0 border border-clinical-primary/10">
                            <MaterialIcon name="psychology" className="h-4.5 w-4.5 text-white" />
                          </div>
                        )}

                        <div className={`max-w-[78%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                          {/* Message Bubble */}
                          <div
                            className={`rounded-[18px] px-3.5 py-2.5 text-xs border transition shadow-sm leading-relaxed ${
                              isUser
                                ? 'rounded-tr-sm bg-clinical-primary text-white border-clinical-primary/10 font-bold text-xs text-left'
                                : 'rounded-tl-sm bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800/80 text-left'
                            }`}
                          >
                            {isUser && message.fileName && (
                              <div className="mb-1 text-[9px] bg-white/20 px-2 py-0.5 rounded flex items-center gap-1 font-extrabold w-fit">
                                <MaterialIcon name="attach_file" className="h-3 w-3" />
                                <span>{message.fileName}</span>
                              </div>
                            )}

                            {isUser ? (
                              <span className="whitespace-pre-line font-bold text-xs">{message.content}</span>
                            ) : (
                              <div className="space-y-2">
                                {renderMarkdownBlocks(message.content)}

                                {/* Suggested follows only on the last loaded message */}
                                {mIndex === messages.length - 1 && !isGenerating && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/50 space-y-1.5">
                                    <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider">💡 Suggested Follow-up:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {getFollowUpChips().map((chip) => (
                                        <button
                                          key={chip}
                                          onClick={() => handleSendMessage(chip)}
                                          className="rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-355 hover:border-clinical-primary hover:bg-clinical-primary/5 hover:text-clinical-primary transition cursor-pointer"
                                        >
                                          {chip}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Diagnostic disclaimer */}
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/55 text-[9px] italic text-slate-400 dark:text-slate-550 leading-normal flex gap-1">
                                  <span className="text-amber-650 font-extrabold shrink-0">⚖️ Disclaimer:</span>
                                  <span>Supports clinical decision-making.</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Timestamp and professional hover/visible actions */}
                          <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-400 dark:text-slate-500 min-h-6 w-full justify-between">
                            <span>{message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>

                            {!isUser && (
                              <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:hover:opacity-100 transition-opacity duration-250 p-0.5 rounded-full bg-slate-100/60 dark:bg-slate-800/40">
                                <button
                                  onClick={() => handleCopyText(message.content)}
                                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                                  title="Copy response"
                                >
                                  <MaterialIcon name="content_copy" className="text-[14px]" />
                                </button>
                                <button
                                  onClick={() => handleToggleSpeak(message.id, message.content)}
                                  className={`p-1 rounded-full transition cursor-pointer ${
                                    currentlySpeakingId === message.id
                                      ? 'text-clinical-primary bg-slate-200 dark:bg-slate-700'
                                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                  }`}
                                  title="Read Aloud (TTS)"
                                >
                                  <MaterialIcon name={currentlySpeakingId === message.id && !isSpeakingPaused ? "volume_off" : "volume_up"} className="text-[14px]" />
                                </button>
                                <button
                                  onClick={() => handleFeedback(message.id, true)}
                                  className={`p-1 rounded-full transition cursor-pointer ${
                                    message.feedback === true ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'
                                  }`}
                                  title="Good response"
                                >
                                  <MaterialIcon name="thumb_up" className="text-[14px]" />
                                </button>
                                <button
                                  onClick={() => handleFeedback(message.id, false)}
                                  className={`p-1 rounded-full transition cursor-pointer ${
                                    message.feedback === false ? 'text-red-500' : 'text-slate-400 hover:text-red-500'
                                  }`}
                                  title="Bad response"
                                >
                                  <MaterialIcon name="thumb_down" className="text-[14px]" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="p-1 rounded-full text-slate-400 hover:text-red-500 transition cursor-pointer"
                                  title="Delete message"
                                >
                                  <MaterialIcon name="delete" className="text-[14px]" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {isUser && (
                          <ProfileAvatar src={photoUrl} name={user?.name} sizeClassName="h-8 w-8 shrink-0 shadow-sm border border-slate-200 dark:border-slate-800" />
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Blinking Typing indicator */}
              {isLoading && (
                <div className="flex justify-start items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101E36] text-clinical-primary shrink-0 shadow-sm">
                    <MaterialIcon name="psychology" className="h-4.5 w-4.5 text-clinical-primary" />
                  </div>
                  <div className="flex max-w-[78%] flex-col gap-2 rounded-[18px] rounded-tl-sm border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#1E293B] px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-350 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Jemmi is typing...</span>
                      <div className="flex gap-1 items-center">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-clinical-primary" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-clinical-primary" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-clinical-primary" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                    {staggeredStep && (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic block">{staggeredStep}</span>
                    )}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions bottom panel (Only when generating response or text is active) */}
            {isGenerating && (
              <div className="flex px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 justify-end shrink-0">
                <button
                  onClick={handleCancelGeneration}
                  className="flex items-center gap-1 text-[10px] font-extrabold text-red-500 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 border border-red-100/40 rounded-3xl px-2.5 py-1.5 transition cursor-pointer shadow-sm"
                >
                  <MaterialIcon name="stop_circle" className="h-3.5 w-3.5 animate-pulse" />
                  Stop Generating
                </button>
              </div>
            )}

            {/* File upload attachment bar */}
            {attachedFile && (
              <div className="px-5 py-2 border-t border-slate-100 dark:border-slate-800 bg-amber-50/40 dark:bg-amber-950/10 flex justify-between items-center text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
                <span className="truncate max-w-[80%] flex items-center gap-1">
                  <MaterialIcon name="attach_file" className="h-4 w-4" />
                  Attachment: {attachedFile.name}
                </span>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <MaterialIcon name="close" className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input Composer area */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1E293B] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim() || attachedFile) {
                    handleSendMessage(input);
                  }
                }}
                className="flex items-center gap-2 bg-slate-50 dark:bg-[#121B2A] border border-slate-200 dark:border-slate-800 rounded-[24px] px-3.5 py-2 shadow-inner"
              >
                {/* File Upload Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer transition shrink-0"
                  title="Attach clinical files"
                >
                  <MaterialIcon name="attach_file" className="h-5 w-5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".txt,.json,.xml,.csv"
                />

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || attachedFile) {
                        handleSendMessage(input);
                      }
                    }
                  }}
                  rows={1}
                  placeholder="Ask Jemmi anything..."
                  className="flex-grow bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none resize-none max-h-20 leading-relaxed font-sans py-1 text-left"
                />

                {/* Speech Dictation microphone */}
                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`p-1 rounded-full transition shrink-0 cursor-pointer ${
                    isListening ? 'text-red-500 bg-red-50 dark:bg-red-950/20 animate-pulse' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                  title={isListening ? "Listening (Click to stop)" : "Speech dictation"}
                >
                  <MaterialIcon name={isListening ? "mic_off" : "mic"} className="h-5 w-5" />
                </button>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() && !attachedFile}
                  className="h-8 w-8 rounded-full bg-clinical-primary text-white flex items-center justify-center hover:bg-clinical-primary/95 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer shadow-soft"
                >
                  <MaterialIcon name="arrow_upward" className="h-4.5 w-4.5 text-white" />
                </button>
              </form>
              <p className="text-[9px] text-center text-slate-400 dark:text-slate-550 mt-2 font-bold uppercase tracking-wider">
                Jemmi AI 2.0 • HIPAA Compliant Patient Workspace
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
