import uuid
import random
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.database import supabase, check_db_backend, get_sqlite_conn
from app.config import settings
from app.utils.room_code import clean_room_code
from app.services.scoring_service import scoring_engine
from app.websocket.manager import manager

logger = logging.getLogger("cyber_quiz.session_service")

class SessionService:
    # High-concurrency in-memory caches for 200+ simultaneous participants
    _quiz_questions_cache: Dict[str, List[Dict[str, Any]]] = {}
    _question_detail_cache: Dict[str, Dict[str, Any]] = {}
    _participant_meta_cache: Dict[str, Dict[str, Any]] = {}
    _participant_pq_cache: Dict[str, List[Dict[str, Any]]] = {}
    _participant_answers_cache: Dict[str, Dict[str, str]] = {}
    _leaderboard_cache: Dict[str, Any] = {}
    _room_code_cache: Dict[str, Any] = {}

    @staticmethod
    def _get_quiz_questions(quiz_id: str) -> List[Dict[str, Any]]:
        """Fetch and cache all questions and options for a quiz."""
        if quiz_id in SessionService._quiz_questions_cache:
            return SessionService._quiz_questions_cache[quiz_id]

        mode = check_db_backend()
        questions = []
        if mode == "supabase" and supabase:
            res = supabase.table("questions").select("id, quiz_id, question_text, time_limit, question_order, options(id, option_text, option_order, is_correct)").eq("quiz_id", quiz_id).order("question_order").execute()
            questions = res.data or []
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("SELECT id, quiz_id, question_text, time_limit, question_order FROM questions WHERE quiz_id = ? ORDER BY question_order", (quiz_id,))
                q_rows = cur.fetchall()
                for qr in q_rows:
                    q_dict = dict(qr)
                    cur.execute("SELECT id, option_text, option_order, is_correct FROM options WHERE question_id = ? ORDER BY option_order", (q_dict["id"],))
                    q_dict["options"] = [dict(o) for o in cur.fetchall()]
                    questions.append(q_dict)
            finally:
                conn.close()

        SessionService._quiz_questions_cache[quiz_id] = questions
        for q in questions:
            SessionService._question_detail_cache[q["id"]] = q

        return questions

    @staticmethod
    def _get_question_detail(question_id: str) -> Optional[Dict[str, Any]]:
        """Fetch question details including options from cache or DB."""
        if question_id in SessionService._question_detail_cache:
            return SessionService._question_detail_cache[question_id]

        mode = check_db_backend()
        if mode == "supabase" and supabase:
            res = supabase.table("questions").select("id, quiz_id, question_text, time_limit, options(id, option_text, option_order, is_correct)").eq("id", question_id).execute()
            if res.data:
                q = res.data[0]
                SessionService._question_detail_cache[question_id] = q
                return q
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("SELECT id, quiz_id, question_text, time_limit FROM questions WHERE id = ?", (question_id,))
                row = cur.fetchone()
                if row:
                    q = dict(row)
                    cur.execute("SELECT id, option_text, option_order, is_correct FROM options WHERE question_id = ? ORDER BY option_order", (question_id,))
                    q["options"] = [dict(o) for o in cur.fetchall()]
                    SessionService._question_detail_cache[question_id] = q
                    return q
            finally:
                conn.close()
        return None

    @staticmethod
    def get_session_by_code(room_code: str) -> Dict[str, Any]:
        cleaned = clean_room_code(room_code)
        now_ts = datetime.now(timezone.utc).timestamp()
        
        # 3-second cache to prevent 200 concurrent joins from all hitting the DB for the same room code
        cached_entry = SessionService._room_code_cache.get(cleaned)
        if cached_entry and (now_ts - cached_entry[0]) < 3.0:
            session = dict(cached_entry[1])
            mem_state = manager.get_session_state(session["id"])
            if mem_state.get("status"):
                session["status"] = mem_state.get("status")
            if mem_state.get("started_at"):
                session["started_at"] = mem_state.get("started_at")
            if mem_state.get("total_time_limit"):
                session["total_time_limit"] = mem_state.get("total_time_limit")
            return session

        mode = check_db_backend()
        session = None
        if mode == "supabase" and supabase:
            res = supabase.table("quiz_sessions").select("*, quizzes(id, title, creator_id, description)").eq("room_code", cleaned).execute()
            if not res.data:
                raise ValueError("Room not found. Please verify the code and try again.")
            session = res.data[0]
            quiz = session.get("quizzes") or {}
            session["quiz_title"] = quiz.get("title", "Cyber Quiz")
            session["creator_id"] = quiz.get("creator_id")
            
            p_res = supabase.table("participants").select("id", count="exact").eq("session_id", session["id"]).execute()
            session["participant_count"] = p_res.count or len(p_res.data or [])
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT s.*, q.title as quiz_title, q.creator_id as creator_id,
                           (SELECT COUNT(*) FROM participants WHERE session_id = s.id) as participant_count
                    FROM quiz_sessions s
                    JOIN quizzes q ON s.quiz_id = q.id
                    WHERE s.room_code = ?
                """, (cleaned,))
                row = cur.fetchone()
                if not row:
                    raise ValueError("Room not found. Please verify the code and try again.")
                session = dict(row)
            finally:
                conn.close()

        # Pre-cache questions and calculate limits from cache
        questions = SessionService._get_quiz_questions(session["quiz_id"])
        session["total_questions"] = len(questions)
        default_total_time = sum(q.get("time_limit", 20) for q in questions) or 600

        # Check in-memory session state for global total time limit
        mem_state = manager.get_session_state(session["id"])
        session["total_time_limit"] = mem_state.get("total_time_limit") or default_total_time
        if mem_state.get("started_at") and not session.get("started_at"):
            session["started_at"] = mem_state.get("started_at")
        if mem_state.get("status"):
            session["status"] = mem_state.get("status")

        SessionService._room_code_cache[cleaned] = (now_ts, session)
        return session

    @staticmethod
    def get_session_by_id(session_id: str) -> Dict[str, Any]:
        mode = check_db_backend()
        session = None
        if mode == "supabase" and supabase:
            res = supabase.table("quiz_sessions").select("*, quizzes(id, title, creator_id, description)").eq("id", session_id).execute()
            if not res.data:
                raise ValueError("Session not found")
            session = res.data[0]
            quiz = session.get("quizzes") or {}
            session["quiz_title"] = quiz.get("title", "Cyber Quiz")
            session["creator_id"] = quiz.get("creator_id")
            p_res = supabase.table("participants").select("id", count="exact").eq("session_id", session_id).execute()
            session["participant_count"] = p_res.count or len(p_res.data or [])
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT s.*, q.title as quiz_title, q.creator_id as creator_id,
                           (SELECT COUNT(*) FROM participants WHERE session_id = s.id) as participant_count
                    FROM quiz_sessions s
                    JOIN quizzes q ON s.quiz_id = q.id
                    WHERE s.id = ?
                """, (session_id,))
                row = cur.fetchone()
                if not row:
                    raise ValueError("Session not found")
                session = dict(row)
            finally:
                conn.close()

        questions = SessionService._get_quiz_questions(session["quiz_id"])
        session["total_questions"] = len(questions)
        default_total_time = sum(q.get("time_limit", 20) for q in questions) or 600

        mem_state = manager.get_session_state(session_id)
        session["total_time_limit"] = mem_state.get("total_time_limit") or default_total_time
        if mem_state.get("started_at") and not session.get("started_at"):
            session["started_at"] = mem_state.get("started_at")
        if mem_state.get("status"):
            session["status"] = mem_state.get("status")

        return session

    @staticmethod
    def join_session(room_code: str, username: str, participant_id: Optional[str] = None, browser_id: Optional[str] = None) -> Dict[str, Any]:
        session = SessionService.get_session_by_code(room_code)
        if session["status"] == "ended":
            raise ValueError("This quiz session has already ended")
            
        username = username.strip()
        session_id = session["id"]
        quiz_id = session["quiz_id"]
        mode = check_db_backend()
        now_str = datetime.now(timezone.utc).isoformat()
        
        # Check if participant already exists in this session (cookie resume)
        if participant_id:
            if mode == "supabase" and supabase:
                p_check = supabase.table("participants").select("*").eq("id", participant_id).eq("session_id", session_id).execute()
                if p_check.data:
                    existing_p = p_check.data[0]
                    SessionService._participant_meta_cache[existing_p["id"]] = {
                        "session_id": session_id,
                        "username": existing_p["username"],
                        "quiz_id": quiz_id
                    }
                    return {
                        "id": existing_p["id"],
                        "participant_id": existing_p["id"],
                        "session_id": session_id,
                        "room_code": room_code,
                        "username": existing_p["username"],
                        "quiz_title": session.get("quiz_title", "Cyber Quiz"),
                        "status": session["status"],
                        "resumed": True
                    }
            else:
                conn = get_sqlite_conn()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM participants WHERE id = ? AND session_id = ?", (participant_id, session_id))
                    row = cur.fetchone()
                    if row:
                        existing_p = dict(row)
                        SessionService._participant_meta_cache[existing_p["id"]] = {
                            "session_id": session_id,
                            "username": existing_p["username"],
                            "quiz_id": quiz_id
                        }
                        return {
                            "id": existing_p["id"],
                            "participant_id": existing_p["id"],
                            "session_id": session_id,
                            "room_code": room_code,
                            "username": existing_p["username"],
                            "quiz_title": session.get("quiz_title", "Cyber Quiz"),
                            "status": session["status"],
                            "resumed": True
                        }
                finally:
                    conn.close()

        # Check if username already exists in this session - if so, resume agent session
        if mode == "supabase" and supabase:
            existing = supabase.table("participants").select("*").eq("session_id", session_id).ilike("username", username).execute()
            if existing.data:
                existing_p = existing.data[0]
                SessionService._participant_meta_cache[existing_p["id"]] = {
                    "session_id": session_id,
                    "username": existing_p["username"],
                    "quiz_id": quiz_id
                }
                return {
                    "id": existing_p["id"],
                    "participant_id": existing_p["id"],
                    "session_id": session_id,
                    "room_code": room_code,
                    "username": existing_p["username"],
                    "quiz_title": session.get("quiz_title", "Cyber Quiz"),
                    "status": session["status"],
                    "resumed": True
                }

            participant_id = str(uuid.uuid4())
            try:
                # Create participant
                supabase.table("participants").insert({
                    "id": participant_id,
                    "session_id": session_id,
                    "username": username,
                    "joined_at": now_str,
                    "total_score": 0,
                    "correct_count": 0,
                    "wrong_count": 0,
                    "unanswered_count": 0
                }).execute()
            except Exception as e:
                # In case of concurrent join race on unique (session_id, username), resume
                p_check = supabase.table("participants").select("*").eq("session_id", session_id).ilike("username", username).execute()
                if p_check.data:
                    existing_p = p_check.data[0]
                    SessionService._participant_meta_cache[existing_p["id"]] = {
                        "session_id": session_id,
                        "username": existing_p["username"],
                        "quiz_id": quiz_id
                    }
                    return {
                        "id": existing_p["id"],
                        "participant_id": existing_p["id"],
                        "session_id": session_id,
                        "room_code": room_code,
                        "username": existing_p["username"],
                        "quiz_title": session.get("quiz_title", "Cyber Quiz"),
                        "status": session["status"],
                        "resumed": True
                    }
                raise e
            
            # Fetch all questions from cache and randomize order for this participant
            questions = SessionService._get_quiz_questions(quiz_id)
            q_ids = [q["id"] for q in questions]
            random.shuffle(q_ids)
            
            # BATCH INSERT all participant questions in 1 single Supabase REST call
            pq_rows = [
                {
                    "id": str(uuid.uuid4()),
                    "participant_id": participant_id,
                    "question_id": q_id,
                    "display_order": order_idx
                }
                for order_idx, q_id in enumerate(q_ids, start=1)
            ]
            if pq_rows:
                supabase.table("participant_questions").insert(pq_rows).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM participants WHERE session_id = ? AND LOWER(username) = LOWER(?)", (session_id, username))
                    existing_row = cur.fetchone()
                    if existing_row:
                        existing_p = dict(existing_row)
                        SessionService._participant_meta_cache[existing_p["id"]] = {
                            "session_id": session_id,
                            "username": existing_p["username"],
                            "quiz_id": quiz_id
                        }
                        return {
                            "id": existing_p["id"],
                            "participant_id": existing_p["id"],
                            "session_id": session_id,
                            "room_code": room_code,
                            "username": existing_p["username"],
                            "quiz_title": session.get("quiz_title", "Cyber Quiz"),
                            "status": session["status"],
                            "resumed": True
                        }

                    participant_id = str(uuid.uuid4())
                    cur.execute("""
                        INSERT INTO participants (id, session_id, username, joined_at, total_score, correct_count, wrong_count, unanswered_count)
                        VALUES (?, ?, ?, ?, 0, 0, 0, 0)
                    """, (participant_id, session_id, username, now_str))
                    
                    questions = SessionService._get_quiz_questions(quiz_id)
                    q_ids = [q["id"] for q in questions]
                    random.shuffle(q_ids)
                    
                    pq_rows = [
                        {
                            "id": str(uuid.uuid4()),
                            "participant_id": participant_id,
                            "question_id": q_id,
                            "display_order": order_idx
                        }
                        for order_idx, q_id in enumerate(q_ids, start=1)
                    ]
                    cur.executemany("""
                        INSERT INTO participant_questions (id, participant_id, question_id, display_order)
                        VALUES (?, ?, ?, ?)
                    """, [(r["id"], r["participant_id"], r["question_id"], r["display_order"]) for r in pq_rows])
            finally:
                conn.close()

        # Pre-warm participant in-memory caches
        SessionService._participant_pq_cache[participant_id] = pq_rows
        SessionService._participant_meta_cache[participant_id] = {
            "session_id": session_id,
            "username": username,
            "quiz_id": quiz_id
        }
        SessionService._participant_answers_cache[participant_id] = {}
                
        return {
            "id": participant_id,
            "participant_id": participant_id,
            "session_id": session_id,
            "room_code": session["room_code"],
            "username": username,
            "quiz_title": session["quiz_title"],
            "status": session["status"]
        }

    @staticmethod
    def start_session(session_id: str, creator_id: str, total_time_limit: Optional[int] = None) -> Dict[str, Any]:
        session = SessionService.get_session_by_id(session_id)
        if session.get("creator_id") and session["creator_id"] != creator_id:
            raise ValueError("Only the quiz creator can start this session")
            
        now_str = datetime.now(timezone.utc).isoformat()
        mode = check_db_backend()
        
        # Calculate time limit if not provided
        if not total_time_limit or total_time_limit <= 0:
            total_time_limit = session.get("total_time_limit") or 600

        # Save to memory manager for real-time global timing
        manager.set_session_state(session_id, "started_at", now_str)
        manager.set_session_state(session_id, "total_time_limit", total_time_limit)

        if mode == "supabase" and supabase:
            supabase.table("quiz_sessions").update({
                "status": "running",
                "started_at": now_str
            }).eq("id", session_id).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute("UPDATE quiz_sessions SET status = 'running', started_at = ? WHERE id = ?", (now_str, session_id))
            finally:
                conn.close()
                
        session["status"] = "running"
        session["started_at"] = now_str
        session["total_time_limit"] = total_time_limit
        return session

    @staticmethod
    def end_session(session_id: str, creator_id: str) -> Dict[str, Any]:
        session = SessionService.get_session_by_id(session_id)
        if session.get("creator_id") and session["creator_id"] != creator_id:
            raise ValueError("Only the quiz creator can end this session")
            
        now_str = datetime.now(timezone.utc).isoformat()
        mode = check_db_backend()
        
        if mode == "supabase" and supabase:
            supabase.table("quiz_sessions").update({
                "status": "ended",
                "ended_at": now_str
            }).eq("id", session_id).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute("UPDATE quiz_sessions SET status = 'ended', ended_at = ? WHERE id = ?", (now_str, session_id))
            finally:
                conn.close()
                
        session["status"] = "ended"
        session["ended_at"] = now_str
        return session

    @staticmethod
    def get_participant_question(participant_id: str, question_index: int) -> Optional[Dict[str, Any]]:
        """
        Fetch the question assigned to participant at question_index (0-indexed).
        Traverse freely without exposing is_correct! Optimized with memory caching for 200+ users.
        """
        display_order = question_index + 1
        now_str = datetime.now(timezone.utc).isoformat()
        mode = check_db_backend()

        # 1. Get participant questions list (cached in memory)
        pq_list = SessionService._participant_pq_cache.get(participant_id)
        if not pq_list:
            if mode == "supabase" and supabase:
                res = supabase.table("participant_questions").select("id, question_id, display_order, started_at").eq("participant_id", participant_id).order("display_order").execute()
                pq_list = res.data or []
            else:
                conn = get_sqlite_conn()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT id, question_id, display_order, started_at FROM participant_questions WHERE participant_id = ? ORDER BY display_order", (participant_id,))
                    pq_list = [dict(r) for r in cur.fetchall()]
                finally:
                    conn.close()
            SessionService._participant_pq_cache[participant_id] = pq_list

        if not pq_list or question_index < 0 or question_index >= len(pq_list):
            return None

        pq = pq_list[question_index]
        question_id = pq["question_id"]
        total_q = len(pq_list)

        # 2. Track started_at if not set
        if not pq.get("started_at"):
            pq["started_at"] = now_str
            if mode == "supabase" and supabase:
                try:
                    supabase.table("participant_questions").update({"started_at": now_str}).eq("id", pq["id"]).execute()
                except Exception as e:
                    logger.warning(f"Could not update started_at: {e}")
            else:
                conn = get_sqlite_conn()
                try:
                    with conn:
                        cur = conn.cursor()
                        cur.execute("UPDATE participant_questions SET started_at = ? WHERE id = ?", (now_str, pq["id"]))
                except Exception as e:
                    logger.warning(f"Could not update started_at: {e}")
                finally:
                    conn.close()
        started_at = pq["started_at"]

        # 3. Get question details from cache (0 DB queries on cache hit)
        q = SessionService._get_question_detail(question_id)
        if not q:
            return None

        raw_options = q.get("options") or []
        options_sorted = sorted(raw_options, key=lambda x: x.get("option_order", 0))

        # 4. Check answer state from cache
        ans_cache = SessionService._participant_answers_cache.get(participant_id)
        if ans_cache is None:
            ans_cache = {}
            if mode == "supabase" and supabase:
                a_res = supabase.table("answers").select("question_id, selected_option_id").eq("participant_id", participant_id).execute()
                for a in (a_res.data or []):
                    ans_cache[a["question_id"]] = a["selected_option_id"]
            else:
                conn = get_sqlite_conn()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT question_id, selected_option_id FROM answers WHERE participant_id = ?", (participant_id,))
                    for row in cur.fetchall():
                        ans_cache[row["question_id"]] = row["selected_option_id"]
                finally:
                    conn.close()
            SessionService._participant_answers_cache[participant_id] = ans_cache

        selected_option_id = ans_cache.get(question_id)
        already_answered = bool(selected_option_id)

        return {
            "question_id": q["id"],
            "question_text": q["question_text"],
            "time_limit": q.get("time_limit", 20),
            "question_order": display_order,
            "total_questions": total_q,
            "started_at": started_at,
            "already_answered": already_answered,
            "selected_option_id": selected_option_id,
            "options": [{
                "id": opt["id"],
                "option_text": opt["option_text"],
                "option_order": idx + 1
            } for idx, opt in enumerate(options_sorted)]
        }

    @staticmethod
    def get_participant_questions_overview(participant_id: str) -> List[Dict[str, Any]]:
        """Return overview of all questions and answered status for the participant's navigator."""
        pq_list = SessionService._participant_pq_cache.get(participant_id)
        ans_cache = SessionService._participant_answers_cache.get(participant_id)

        if pq_list is not None and ans_cache is not None:
            return [
                {
                    "question_order": pq["display_order"],
                    "question_id": pq["question_id"],
                    "answered": bool(ans_cache.get(pq["question_id"])),
                    "selected_option_id": ans_cache.get(pq["question_id"])
                }
                for pq in pq_list
            ]

        mode = check_db_backend()
        overview = []
        if mode == "supabase" and supabase:
            pq_res = supabase.table("participant_questions").select("question_id, display_order").eq("participant_id", participant_id).order("display_order").execute()
            ans_res = supabase.table("answers").select("question_id, selected_option_id").eq("participant_id", participant_id).execute()
            ans_map = {a["question_id"]: a["selected_option_id"] for a in (ans_res.data or [])}
            for pq in (pq_res.data or []):
                q_id = pq["question_id"]
                overview.append({
                    "question_order": pq["display_order"],
                    "question_id": q_id,
                    "answered": bool(ans_map.get(q_id)),
                    "selected_option_id": ans_map.get(q_id)
                })
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT pq.display_order, pq.question_id, a.selected_option_id
                    FROM participant_questions pq
                    LEFT JOIN answers a ON pq.participant_id = a.participant_id AND pq.question_id = a.question_id
                    WHERE pq.participant_id = ?
                    ORDER BY pq.display_order ASC
                """, (participant_id,))
                for row in cur.fetchall():
                    overview.append({
                        "question_order": row["display_order"],
                        "question_id": row["question_id"],
                        "answered": bool(row["selected_option_id"]),
                        "selected_option_id": row["selected_option_id"]
                    })
            finally:
                conn.close()
        return overview

    @staticmethod
    def submit_answer(participant_id: str, question_id: str, selected_option_id: str) -> Dict[str, Any]:
        """
        Server-authoritative answer submission / update.
        Allows answer updates when traversing questions before the global timer expires.
        Does NOT expose is_correct or correct_option_id to the participant!
        """
        now = datetime.now(timezone.utc)
        now_str = now.isoformat()
        mode = check_db_backend()
        
        # 1. Fetch participant to identify session (from cache if available)
        meta = SessionService._participant_meta_cache.get(participant_id)
        if meta:
            session_id = meta["session_id"]
            username = meta["username"]
        else:
            if mode == "supabase" and supabase:
                p_res = supabase.table("participants").select("session_id, username").eq("id", participant_id).execute()
                if not p_res.data:
                    raise ValueError("Participant not found")
                session_id = p_res.data[0]["session_id"]
                username = p_res.data[0]["username"]
            else:
                conn = get_sqlite_conn()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT session_id, username FROM participants WHERE id = ?", (participant_id,))
                    row = cur.fetchone()
                    if not row:
                        raise ValueError("Participant not found")
                    session_id = row["session_id"]
                    username = row["username"]
                finally:
                    conn.close()
            SessionService._participant_meta_cache[participant_id] = {
                "session_id": session_id,
                "username": username
            }

        # 2. Check Global Timer & Session Status
        session = SessionService.get_session_by_id(session_id)
        if session.get("status") == "ended":
            raise ValueError("Quiz has already concluded. Submissions are closed.")

        mem_state = manager.get_session_state(session_id)
        started_at_str = mem_state.get("started_at") or session.get("started_at")
        total_time_limit = mem_state.get("total_time_limit") or session.get("total_time_limit") or 600

        if started_at_str:
            start_dt = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
            elapsed = (now - start_dt).total_seconds()
            if elapsed > (total_time_limit + 3.0):
                raise ValueError("Global quiz time limit has expired. Submissions are closed.")

        # 3. Check question time limit & correctness from memory cache
        q_detail = SessionService._get_question_detail(question_id)
        time_limit = q_detail.get("time_limit", 20) if q_detail else 20
        is_correct = False
        correct_option_id = None
        if q_detail:
            for opt in q_detail.get("options", []):
                if opt.get("is_correct"):
                    correct_option_id = opt["id"]
                if opt["id"] == selected_option_id and opt.get("is_correct"):
                    is_correct = True

        # Determine started_at from cached participant questions or fallback
        started_at = now
        pq_list = SessionService._participant_pq_cache.get(participant_id, [])
        for pq in pq_list:
            if pq.get("question_id") == question_id and pq.get("started_at"):
                try:
                    started_at = datetime.fromisoformat(pq["started_at"].replace("Z", "+00:00"))
                except Exception:
                    pass
                break

        response_time_ms = max(50, int((now - started_at).total_seconds() * 1000))
        points = scoring_engine.calculate_score(is_correct, response_time_ms, time_limit)

        # Update in-memory participant answers cache
        if participant_id not in SessionService._participant_answers_cache:
            SessionService._participant_answers_cache[participant_id] = {}
        SessionService._participant_answers_cache[participant_id][question_id] = selected_option_id

        # Invalidate leaderboard cache
        SessionService._leaderboard_cache.pop(session_id, None)

        if mode == "supabase" and supabase:
            # Check existing answer (UPSERT to allow question traversal update)
            ans_res = supabase.table("answers").select("id").eq("participant_id", participant_id).eq("question_id", question_id).execute()
            if ans_res.data:
                ans_id = ans_res.data[0]["id"]
                supabase.table("answers").update({
                    "selected_option_id": selected_option_id,
                    "is_correct": is_correct,
                    "response_time_ms": response_time_ms,
                    "points": points,
                    "answered_at": now_str
                }).eq("id", ans_id).execute()
            else:
                ans_id = str(uuid.uuid4())
                supabase.table("answers").insert({
                    "id": ans_id,
                    "participant_id": participant_id,
                    "question_id": question_id,
                    "selected_option_id": selected_option_id,
                    "is_correct": is_correct,
                    "response_time_ms": response_time_ms,
                    "points": points,
                    "answered_at": now_str
                }).execute()

            # Recalculate participant's overall statistics
            all_ans = supabase.table("answers").select("points, is_correct").eq("participant_id", participant_id).execute()
            new_score = sum(a.get("points", 0) for a in (all_ans.data or []))
            new_correct = sum(1 for a in (all_ans.data or []) if a.get("is_correct"))
            new_wrong = sum(1 for a in (all_ans.data or []) if not a.get("is_correct"))

            supabase.table("participants").update({
                "total_score": new_score,
                "correct_count": new_correct,
                "wrong_count": new_wrong
            }).eq("id", participant_id).execute()

        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute("SELECT id FROM answers WHERE participant_id = ? AND question_id = ?", (participant_id, question_id))
                    existing_ans = cur.fetchone()
                    if existing_ans:
                        cur.execute("""
                            UPDATE answers
                            SET selected_option_id = ?, is_correct = ?, response_time_ms = ?, points = ?, answered_at = ?
                            WHERE id = ?
                        """, (selected_option_id, 1 if is_correct else 0, response_time_ms, points, now_str, existing_ans["id"]))
                    else:
                        ans_id = str(uuid.uuid4())
                        cur.execute("""
                            INSERT INTO answers (id, participant_id, question_id, selected_option_id, is_correct, response_time_ms, points, answered_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (ans_id, participant_id, question_id, selected_option_id, 1 if is_correct else 0, response_time_ms, points, now_str))

                    # Recompute participant score
                    cur.execute("""
                        SELECT SUM(points) as tot_score,
                               SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as tot_corr,
                               SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as tot_wrong
                        FROM answers WHERE participant_id = ?
                    """, (participant_id,))
                    stats = cur.fetchone()
                    new_score = stats["tot_score"] or 0
                    new_correct = stats["tot_corr"] or 0
                    new_wrong = stats["tot_wrong"] or 0

                    cur.execute("""
                        UPDATE participants
                        SET total_score = ?, correct_count = ?, wrong_count = ?
                        WHERE id = ?
                    """, (new_score, new_correct, new_wrong, participant_id))
            finally:
                conn.close()

        # Secretly prepare telemetry for admin live scoreboard ticker
        telemetry = {
            "participant_id": participant_id,
            "session_id": session_id,
            "username": username,
            "question_id": question_id,
            "is_correct": is_correct,
            "points": points,
            "response_time_ms": response_time_ms
        }

        # IMPORTANT: To participant, return ONLY confirmation that selection was recorded!
        # Do NOT reveal is_correct, points, or correct_option_id until quiz stops!
        return {
            "question_id": question_id,
            "selected_option_id": selected_option_id,
            "status": "saved",
            "_telemetry": telemetry # used internally by WS/router to notify admin
        }

    @staticmethod
    def get_leaderboard(session_id: str) -> List[Dict[str, Any]]:
        now_ts = datetime.now(timezone.utc).timestamp()
        cached = SessionService._leaderboard_cache.get(session_id)
        if cached and (now_ts - cached[0]) < 1.5:
            return cached[1]

        mode = check_db_backend()
        leaderboard = []
        
        if mode == "supabase" and supabase:
            res = supabase.table("participants").select("id, username, total_score, correct_count, wrong_count, unanswered_count").eq("session_id", session_id).order("total_score", desc=True).order("correct_count", desc=True).order("joined_at", desc=False).execute()
            for rank, p in enumerate(res.data or [], start=1):
                leaderboard.append({
                    "rank": rank,
                    "participant_id": p["id"],
                    "username": p["username"],
                    "score": p["total_score"],
                    "correct_count": p["correct_count"],
                    "wrong_count": p["wrong_count"],
                    "unanswered_count": p["unanswered_count"]
                })
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT id, username, total_score, correct_count, wrong_count, unanswered_count
                    FROM participants
                    WHERE session_id = ?
                    ORDER BY total_score DESC, correct_count DESC, joined_at ASC
                """, (session_id,))
                for rank, row in enumerate(cur.fetchall(), start=1):
                    leaderboard.append({
                        "rank": rank,
                        "participant_id": row["id"],
                        "username": row["username"],
                        "score": row["total_score"],
                        "correct_count": row["correct_count"],
                        "wrong_count": row["wrong_count"],
                        "unanswered_count": row["unanswered_count"]
                    })
            finally:
                conn.close()

        SessionService._leaderboard_cache[session_id] = (now_ts, leaderboard)
        return leaderboard

    @staticmethod
    def get_participant_result_summary(participant_id: str) -> Dict[str, Any]:
        """
        Reveals correct answers, score, and rank only after quiz stops/ends.
        """
        mode = check_db_backend()
        
        participant = None
        session = None
        history = []
        
        if mode == "supabase" and supabase:
            p_res = supabase.table("participants").select("*, quiz_sessions(id, room_code, status, quiz_id, quizzes(title))").eq("id", participant_id).execute()
            if not p_res.data:
                raise ValueError("Participant not found")
            participant = p_res.data[0]
            session = participant.get("quiz_sessions") or {}
            quiz_title = (session.get("quizzes") or {}).get("title", "Cyber Quiz")
            session_id = session.get("id", participant["session_id"])
            sess_status = session.get("status", "running")
            
            lb = SessionService.get_leaderboard(session_id)
            total_participants = len(lb)
            rank = next((item["rank"] for item in lb if item["participant_id"] == participant_id), 1)
            
            if sess_status != "ended":
                return {
                    "participant_id": participant["id"],
                    "username": participant["username"],
                    "session_id": session_id,
                    "quiz_title": quiz_title,
                    "status": "frozen",
                    "is_frozen": True,
                    "message": "Responses recorded and locked. Official scores and scoreboard will unlock when the game master concludes the quiz session.",
                    "total_score": 0,
                    "rank": 1,
                    "total_participants": total_participants,
                    "correct_count": 0,
                    "wrong_count": 0,
                    "unanswered_count": 0,
                    "accuracy_percentage": 0.0,
                    "avg_response_time_ms": 0,
                    "fastest_response_time_ms": 0,
                    "total_questions": 0,
                    "answer_history": []
                }
            
            pq_res = supabase.table("participant_questions").select("question_id, display_order, questions(id, question_text, time_limit, options(*))").eq("participant_id", participant_id).order("display_order").execute()
            ans_res = supabase.table("answers").select("*").eq("participant_id", participant_id).execute()
            ans_map = {a["question_id"]: a for a in (ans_res.data or [])}
            
            for item in (pq_res.data or []):
                q = item.get("questions") or {}
                q_id = q.get("id")
                options = q.get("options") or []
                correct_opt = next((o for o in options if o.get("is_correct")), {})
                
                ans = ans_map.get(q_id)
                if ans:
                    selected_opt = next((o for o in options if o["id"] == ans["selected_option_id"]), {})
                    history.append({
                        "question_id": q_id,
                        "question_text": q.get("question_text", ""),
                        "selected_option_id": ans["selected_option_id"],
                        "selected_option_text": selected_opt.get("option_text", "N/A"),
                        "correct_option_id": correct_opt.get("id", ""),
                        "correct_option_text": correct_opt.get("option_text", ""),
                        "is_correct": bool(ans["is_correct"]),
                        "points": ans["points"],
                        "response_time_ms": ans["response_time_ms"],
                        "time_limit": q.get("time_limit", 20)
                    })
                else:
                    history.append({
                        "question_id": q_id,
                        "question_text": q.get("question_text", ""),
                        "selected_option_id": None,
                        "selected_option_text": "Not Answered",
                        "correct_option_id": correct_opt.get("id", ""),
                        "correct_option_text": correct_opt.get("option_text", ""),
                        "is_correct": False,
                        "points": 0,
                        "response_time_ms": 0,
                        "time_limit": q.get("time_limit", 20)
                    })
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT p.*, s.id as sess_id, s.room_code, s.status as sess_status, q.title as quiz_title
                    FROM participants p
                    JOIN quiz_sessions s ON p.session_id = s.id
                    JOIN quizzes q ON s.quiz_id = q.id
                    WHERE p.id = ?
                """, (participant_id,))
                p_row = cur.fetchone()
                if not p_row:
                    raise ValueError("Participant not found")
                participant = dict(p_row)
                quiz_title = participant["quiz_title"]
                session_id = participant["session_id"]
                sess_status = participant.get("sess_status", "running")
                
                lb = SessionService.get_leaderboard(session_id)
                total_participants = len(lb)
                rank = next((item["rank"] for item in lb if item["participant_id"] == participant_id), 1)

                if sess_status != "ended":
                    return {
                        "participant_id": participant["id"],
                        "username": participant["username"],
                        "session_id": session_id,
                        "quiz_title": quiz_title,
                        "status": "frozen",
                        "is_frozen": True,
                        "message": "Responses recorded and locked. Official scores and scoreboard will unlock when the game master concludes the quiz session.",
                        "total_score": 0,
                        "rank": 1,
                        "total_participants": total_participants,
                        "correct_count": 0,
                        "wrong_count": 0,
                        "unanswered_count": 0,
                        "accuracy_percentage": 0.0,
                        "avg_response_time_ms": 0,
                        "fastest_response_time_ms": 0,
                        "total_questions": 0,
                        "answer_history": []
                    }
                
                cur.execute("""
                    SELECT pq.question_id, pq.display_order, q.question_text, q.time_limit
                    FROM participant_questions pq
                    JOIN questions q ON pq.question_id = q.id
                    WHERE pq.participant_id = ?
                    ORDER BY pq.display_order ASC
                """, (participant_id,))
                questions = [dict(r) for r in cur.fetchall()]
                
                cur.execute("SELECT * FROM answers WHERE participant_id = ?", (participant_id,))
                ans_map = {r["question_id"]: dict(r) for r in cur.fetchall()}
                
                for q in questions:
                    q_id = q["question_id"]
                    cur.execute("SELECT id, option_text, is_correct FROM options WHERE question_id = ?", (q_id,))
                    opts = [dict(o) for o in cur.fetchall()]
                    correct_opt = next((o for o in opts if o["is_correct"]), {})
                    
                    ans = ans_map.get(q_id)
                    if ans:
                        selected_opt = next((o for o in opts if o["id"] == ans["selected_option_id"]), {})
                        history.append({
                            "question_id": q_id,
                            "question_text": q["question_text"],
                            "selected_option_id": ans["selected_option_id"],
                            "selected_option_text": selected_opt.get("option_text", "N/A"),
                            "correct_option_id": correct_opt.get("id", ""),
                            "correct_option_text": correct_opt.get("option_text", ""),
                            "is_correct": bool(ans["is_correct"]),
                            "points": ans["points"],
                            "response_time_ms": ans["response_time_ms"],
                            "time_limit": q["time_limit"]
                        })
                    else:
                        history.append({
                            "question_id": q_id,
                            "question_text": q["question_text"],
                            "selected_option_id": None,
                            "selected_option_text": "Not Answered",
                            "correct_option_id": correct_opt.get("id", ""),
                            "correct_option_text": correct_opt.get("option_text", ""),
                            "is_correct": False,
                            "points": 0,
                            "response_time_ms": 0,
                            "time_limit": q["time_limit"]
                        })
            finally:
                conn.close()
                
        total_questions = len(history)
        correct_count = participant["correct_count"]
        wrong_count = participant["wrong_count"]
        unanswered_count = max(0, total_questions - (correct_count + wrong_count))
        accuracy = round((correct_count / total_questions * 100), 1) if total_questions > 0 else 0.0
        
        valid_times = [h["response_time_ms"] for h in history if h["is_correct"] and h["response_time_ms"] > 0]
        avg_time = int(sum(valid_times) / len(valid_times)) if valid_times else 0
        fastest_time = min(valid_times) if valid_times else 0
        
        return {
            "participant_id": participant_id,
            "username": participant["username"],
            "session_id": session_id,
            "quiz_title": quiz_title,
            "total_score": participant["total_score"],
            "rank": rank,
            "total_participants": total_participants,
            "correct_count": correct_count,
            "wrong_count": wrong_count,
            "unanswered_count": unanswered_count,
            "accuracy_percentage": accuracy,
            "avg_response_time_ms": avg_time,
            "fastest_response_time_ms": fastest_time,
            "total_questions": total_questions,
            "answer_history": history
        }

    @staticmethod
    def get_session_admin_results(session_id: str, creator_id: str) -> Dict[str, Any]:
        session = SessionService.get_session_by_id(session_id)
        if session.get("creator_id") and session["creator_id"] != creator_id:
            raise ValueError("Unauthorized to view admin results for this session")
            
        leaderboard = SessionService.get_leaderboard(session_id)
        participants_detail = []
        for p in leaderboard:
            try:
                summary = SessionService.get_participant_result_summary(p["participant_id"])
                participants_detail.append(summary)
            except Exception:
                pass
                
        return {
            "session_id": session_id,
            "room_code": session["room_code"],
            "quiz_title": session["quiz_title"],
            "status": session["status"],
            "total_participants": len(leaderboard),
            "leaderboard": leaderboard,
            "participants_detail": participants_detail
        }

session_service = SessionService()
