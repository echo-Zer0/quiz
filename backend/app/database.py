import os
import sqlite3
import uuid
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger("cyber_quiz.database")

supabase: Optional[Client] = None
use_supabase: bool = False
_last_check_time: float = 0.0
_CHECK_INTERVAL_SECONDS: float = 30.0

if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.warning(f"Supabase init notice: {e}")

DB_PATH = Path(__file__).resolve().parent.parent / "quiz_local.sqlite"

def get_sqlite_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_local_db():
    conn = get_sqlite_conn()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS creators (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id TEXT PRIMARY KEY,
            creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            published_at TEXT
        );

        CREATE TABLE IF NOT EXISTS questions (
            id TEXT PRIMARY KEY,
            quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            time_limit INTEGER NOT NULL DEFAULT 20,
            question_order INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS options (
            id TEXT PRIMARY KEY,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            option_text TEXT NOT NULL,
            option_order INTEGER NOT NULL DEFAULT 1,
            is_correct INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS quiz_sessions (
            id TEXT PRIMARY KEY,
            quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            room_code TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'waiting',
            current_question_index INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            ended_at TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS participants (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            joined_at TEXT NOT NULL,
            total_score INTEGER NOT NULL DEFAULT 0,
            correct_count INTEGER NOT NULL DEFAULT 0,
            wrong_count INTEGER NOT NULL DEFAULT 0,
            unanswered_count INTEGER NOT NULL DEFAULT 0,
            UNIQUE(session_id, username)
        );

        CREATE TABLE IF NOT EXISTS participant_questions (
            id TEXT PRIMARY KEY,
            participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            display_order INTEGER NOT NULL,
            started_at TEXT,
            UNIQUE(participant_id, question_id)
        );

        CREATE TABLE IF NOT EXISTS answers (
            id TEXT PRIMARY KEY,
            participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            selected_option_id TEXT REFERENCES options(id) ON DELETE SET NULL,
            is_correct INTEGER NOT NULL DEFAULT 0,
            response_time_ms INTEGER NOT NULL DEFAULT 0,
            points INTEGER NOT NULL DEFAULT 0,
            answered_at TEXT NOT NULL,
            UNIQUE(participant_id, question_id)
        );
        """)
    conn.close()

init_local_db()

def check_db_backend(force_check: bool = False) -> str:
    if settings.FORCE_SQLITE:
        return "sqlite_fallback"
        
    global use_supabase, _last_check_time
    now = time.time()
    
    if not force_check and (now - _last_check_time) < _CHECK_INTERVAL_SECONDS:
        return "supabase" if use_supabase else "sqlite_fallback"
        
    _last_check_time = now
    if supabase:
        try:
            supabase.table("creators").select("id").limit(1).execute()
            use_supabase = True
            return "supabase"
        except Exception:
            use_supabase = False
            return "sqlite_fallback"
    return "sqlite_fallback"
