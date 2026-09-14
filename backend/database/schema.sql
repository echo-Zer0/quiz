-- ==============================================================================
-- Cyber Quiz Platform - Supabase PostgreSQL Schema
-- ==============================================================================
-- Paste this entire file into:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Creators Table (Admin/Quiz Creator accounts)
CREATE TABLE IF NOT EXISTS public.creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'running', 'ended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    time_limit INTEGER NOT NULL DEFAULT 20 CHECK (time_limit >= 3 AND time_limit <= 300),
    question_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Options Table (Dynamic options per question)
CREATE TABLE IF NOT EXISTS public.options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_order INTEGER NOT NULL DEFAULT 1,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. Quiz Sessions (Active Room / Game Instance)
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    room_code VARCHAR(16) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'ended')),
    current_question_index INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Participants Table
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_score INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT unique_session_username UNIQUE(session_id, username)
);

-- 7. Participant Questions Table (Stores unique randomized question order per participant)
CREATE TABLE IF NOT EXISTS public.participant_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL,
    started_at TIMESTAMPTZ,
    CONSTRAINT unique_participant_question UNIQUE(participant_id, question_id)
);

-- 8. Answers Table (Records individual participant submissions)
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES public.options(id) ON DELETE SET NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_participant_answer UNIQUE(participant_id, question_id)
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_quizzes_creator_id ON public.quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_options_question_id ON public.options(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_room_code ON public.quiz_sessions(room_code);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON public.quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON public.participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_total_score ON public.participants(session_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_participant_questions_part_order ON public.participant_questions(participant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_answers_participant_id ON public.answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);

-- ==============================================================================
-- TRIGGER FOR UPDATED_AT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER trigger_quizzes_updated_at
    BEFORE UPDATE ON public.quizzes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
