# -*- coding: utf-8 -*-
"""
KnowledgeService Module.
Manages the local SQLite RAG system, document chunking, automatic database seeding,
index rebuilding upon DB modifications, and pure-Python BM25 keyword search.
"""

import os
import re
import math
import sqlite3
import logging
from typing import List, Dict, Any, Tuple
from ..local_kb import MEDICAL_KB, FAQ_KB

logger = logging.getLogger(__name__)

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
DB_PATH = os.path.join(DB_DIR, "local_knowledge.db")

class KnowledgeService:
    @staticmethod
    def get_db_connection():
        os.makedirs(DB_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    @classmethod
    def init_rag_db(cls):
        """Create schemas and auto-seed initial knowledge from local_kb on startup."""
        conn = cls.get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                doc_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY(doc_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
            )
        """)
        conn.commit()

        # Check if we need to auto-seed
        cursor.execute("SELECT COUNT(*) as count FROM knowledge_chunks")
        row = cursor.fetchone()
        if row["count"] == 0:
            logger.info("Initializing SQLite RAG with local knowledge definitions and FAQs...")

            # 1. Seed MEDICAL_KB
            for term, definition in MEDICAL_KB.items():
                cursor.execute(
                    "INSERT INTO knowledge_documents (title, doc_type) VALUES (?, ?)",
                    (f"Definition: {term.title()}", "medical_kb")
                )
                doc_id = cursor.lastrowid
                cursor.execute(
                    "INSERT INTO knowledge_chunks (doc_id, chunk_index, content) VALUES (?, ?, ?)",
                    (doc_id, 0, f"Topic: {term.title()}. Definition: {definition}")
                )

            # 2. Seed FAQ_KB
            for question, answer in FAQ_KB.items():
                cursor.execute(
                    "INSERT INTO knowledge_documents (title, doc_type) VALUES (?, ?)",
                    (f"FAQ: {question}", "faq")
                )
                doc_id = cursor.lastrowid
                cursor.execute(
                    "INSERT INTO knowledge_chunks (doc_id, chunk_index, content) VALUES (?, ?, ?)",
                    (doc_id, 0, f"Question: {question}. Answer: {answer}")
                )

            conn.commit()
            logger.info("Auto-seeded SQLite RAG database successfully.")

        conn.close()

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
        """Split text into overlapping chunks of approx chunk_size characters."""
        words = text.split()
        chunks = []
        current_chunk = []
        current_len = 0

        for word in words:
            current_chunk.append(word)
            current_len += len(word) + 1
            if current_len >= chunk_size:
                chunks.append(" ".join(current_chunk))
                overlap_words = current_chunk[-12:] if len(current_chunk) > 12 else []
                current_chunk = overlap_words
                current_len = sum(len(w) + 1 for w in current_chunk)

        if current_chunk:
            chunks.append(" ".join(current_chunk))
        return chunks

    @classmethod
    def add_document_to_rag(cls, title: str, content: str, doc_type: str) -> int:
        """Adds a new document to the local RAG, chunks it, and updates the SQLite store."""
        conn = cls.get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "INSERT INTO knowledge_documents (title, doc_type) VALUES (?, ?)",
                (title, doc_type)
            )
            doc_id = cursor.lastrowid

            chunks = cls.chunk_text(content)
            for idx, chunk in enumerate(chunks):
                cursor.execute(
                    "INSERT INTO knowledge_chunks (doc_id, chunk_index, content) VALUES (?, ?, ?)",
                    (doc_id, idx, chunk)
                )
            conn.commit()
            return doc_id
        finally:
            conn.close()


class BM25SearchEngine:
    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.doc_lens: List[int] = []
        self.avg_doc_len: float = 0.0
        self.doc_counts: Dict[str, int] = {}
        self.N: int = 0
        self.last_load_time = 0

    def tokenize(self, text: str) -> List[str]:
        return re.findall(r'\b\w+\b', text.lower())

    def load_index(self):
        """Load chunks from SQLite and prepare BM25 statistics if the DB changes."""
        if os.path.exists(DB_PATH):
            mtime = os.path.getmtime(DB_PATH)
            if mtime <= self.last_load_time and self.N > 0:
                return
            self.last_load_time = mtime

        conn = KnowledgeService.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.id, c.content, d.title, d.doc_type
            FROM knowledge_chunks c
            JOIN knowledge_documents d ON c.doc_id = d.id
        """)
        rows = cursor.fetchall()
        conn.close()

        self.chunks = [dict(row) for row in rows]
        self.N = len(self.chunks)
        self.doc_lens = [len(self.tokenize(c["content"])) for c in self.chunks]
        self.avg_doc_len = sum(self.doc_lens) / max(self.N, 1)

        self.doc_counts = {}
        for c in self.chunks:
            terms = set(self.tokenize(c["content"]))
            for t in terms:
                self.doc_counts[t] = self.doc_counts.get(t, 0) + 1

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        self.load_index()
        if self.N == 0:
            return []

        query_terms = self.tokenize(query)
        if not query_terms:
            return []

        k1 = 1.5
        b = 0.75
        scores: List[Tuple[int, float]] = []

        for idx, chunk in enumerate(self.chunks):
            doc_len = self.doc_lens[idx]
            doc_terms = self.tokenize(chunk["content"])

            term_freqs = {}
            for t in doc_terms:
                term_freqs[t] = term_freqs.get(t, 0) + 1

            score = 0.0
            for qt in query_terms:
                if qt not in term_freqs:
                    continue
                tf = term_freqs[qt]
                df = self.doc_counts.get(qt, 0)

                idf = math.log((self.N - df + 0.5) / (df + 0.5) + 1.0)
                num = tf * (k1 + 1)
                den = tf + k1 * (1.0 - b + b * (doc_len / max(self.avg_doc_len, 1)))
                score += idf * (num / den)

            if score > 0.0:
                scores.append((idx, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        results = []
        for rank_idx, (idx, score) in enumerate(scores[:top_k]):
            chunk = self.chunks[idx].copy()
            chunk["score"] = round(score, 3)
            chunk["rank"] = rank_idx + 1
            results.append(chunk)

        return results

# Global search instance
rag_search_engine = BM25SearchEngine()

def search_local_rag(query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    return rag_search_engine.search(query, top_k)
