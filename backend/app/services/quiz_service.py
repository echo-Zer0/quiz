import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.database import supabase, check_db_backend, get_sqlite_conn
from app.config import settings
from app.utils.room_code import generate_room_code
from app.schemas.quiz import QuizCreate, QuizUpdate

class QuizService:
    
    @staticmethod
    def create_quiz(creator_id: str, data: QuizCreate) -> Dict[str, Any]:
        quiz_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        mode = check_db_backend()
        
        if mode == "supabase" and supabase:
            # Insert quiz
            supabase.table("quizzes").insert({
                "id": quiz_id,
                "creator_id": creator_id,
                "title": data.title,
                "description": data.description or "",
                "status": "draft",
                "created_at": now_str,
                "updated_at": now_str
            }).execute()
            
            # Insert questions & options
            for q_idx, q in enumerate(data.questions, start=1):
                question_id = str(uuid.uuid4())
                supabase.table("questions").insert({
                    "id": question_id,
                    "quiz_id": quiz_id,
                    "question_text": q.question_text,
                    "time_limit": q.time_limit,
                    "question_order": q_idx,
                    "created_at": now_str
                }).execute()
                
                for opt_idx, opt in enumerate(q.options, start=1):
                    opt_id = str(uuid.uuid4())
                    supabase.table("options").insert({
                        "id": opt_id,
                        "question_id": question_id,
                        "option_text": opt.option_text,
                        "option_order": opt_idx,
                        "is_correct": opt.is_correct
                    }).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute(
                        "INSERT INTO quizzes (id, creator_id, title, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)",
                        (quiz_id, creator_id, data.title, data.description or "", now_str, now_str)
                    )
                    for q_idx, q in enumerate(data.questions, start=1):
                        q_id = str(uuid.uuid4())
                        cur.execute(
                            "INSERT INTO questions (id, quiz_id, question_text, time_limit, question_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                            (q_id, quiz_id, q.question_text, q.time_limit, q_idx, now_str)
                        )
                        for opt_idx, opt in enumerate(q.options, start=1):
                            opt_id = str(uuid.uuid4())
                            cur.execute(
                                "INSERT INTO options (id, question_id, option_text, option_order, is_correct) VALUES (?, ?, ?, ?, ?)",
                                (opt_id, q_id, opt.option_text, opt_idx, 1 if opt.is_correct else 0)
                            )
            finally:
                conn.close()
                
        return QuizService.get_quiz_detail(creator_id, quiz_id)

    @staticmethod
    def list_quizzes(creator_id: str) -> List[Dict[str, Any]]:
        mode = check_db_backend()
        quizzes = []
        if mode == "supabase" and supabase:
            res = supabase.table("quizzes").select("*, questions(id)").eq("creator_id", creator_id).order("created_at", desc=True).execute()
            for row in (res.data or []):
                q_count = len(row.get("questions") or [])
                quizzes.append({
                    "id": row["id"],
                    "creator_id": row["creator_id"],
                    "title": row["title"],
                    "description": row.get("description", ""),
                    "status": row["status"],
                    "question_count": q_count,
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "published_at": row.get("published_at")
                })
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT q.*, COUNT(qs.id) as question_count
                    FROM quizzes q
                    LEFT JOIN questions qs ON q.id = qs.quiz_id
                    WHERE q.creator_id = ?
                    GROUP BY q.id
                    ORDER BY q.created_at DESC
                """, (creator_id,))
                for row in cur.fetchall():
                    quizzes.append({
                        "id": row["id"],
                        "creator_id": row["creator_id"],
                        "title": row["title"],
                        "description": row["description"] or "",
                        "status": row["status"],
                        "question_count": row["question_count"],
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                        "published_at": row["published_at"]
                    })
            finally:
                conn.close()
        return quizzes

    @staticmethod
    def get_quiz_detail(creator_id: str, quiz_id: str) -> Dict[str, Any]:
        mode = check_db_backend()
        if mode == "supabase" and supabase:
            q_res = supabase.table("quizzes").select("*").eq("id", quiz_id).eq("creator_id", creator_id).execute()
            if not q_res.data:
                raise ValueError("Quiz not found")
            quiz = q_res.data[0]
            
            # Fetch questions and options
            quest_res = supabase.table("questions").select("*, options(*)").eq("quiz_id", quiz_id).order("question_order").execute()
            questions = []
            for q in (quest_res.data or []):
                options = sorted(q.get("options") or [], key=lambda x: x["option_order"])
                questions.append({
                    "id": q["id"],
                    "question_text": q["question_text"],
                    "time_limit": q["time_limit"],
                    "question_order": q["question_order"],
                    "options": [{
                        "id": opt["id"],
                        "option_text": opt["option_text"],
                        "option_order": opt["option_order"],
                        "is_correct": bool(opt["is_correct"])
                    } for opt in options]
                })
            quiz["questions"] = questions
            return quiz
        else:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("SELECT * FROM quizzes WHERE id = ? AND creator_id = ?", (quiz_id, creator_id))
                quiz_row = cur.fetchone()
                if not quiz_row:
                    raise ValueError("Quiz not found")
                quiz = dict(quiz_row)
                
                cur.execute("SELECT * FROM questions WHERE quiz_id = ? ORDER BY question_order", (quiz_id,))
                questions = []
                for q_row in cur.fetchall():
                    q_dict = dict(q_row)
                    cur.execute("SELECT * FROM options WHERE question_id = ? ORDER BY option_order", (q_dict["id"],))
                    opts = [dict(opt) for opt in cur.fetchall()]
                    q_dict["options"] = [{
                        "id": o["id"],
                        "option_text": o["option_text"],
                        "option_order": o["option_order"],
                        "is_correct": bool(o["is_correct"])
                    } for o in opts]
                    questions.append(q_dict)
                quiz["questions"] = questions
                return quiz
            finally:
                conn.close()

    @staticmethod
    def update_quiz(creator_id: str, quiz_id: str, data: QuizUpdate) -> Dict[str, Any]:
        mode = check_db_backend()
        now_str = datetime.now(timezone.utc).isoformat()
        
        # Verify exists
        quiz = QuizService.get_quiz_detail(creator_id, quiz_id)
        if quiz["status"] not in ("draft", "published"):
            raise ValueError(f"Cannot edit quiz with status '{quiz['status']}'")

        if mode == "supabase" and supabase:
            update_fields = {"updated_at": now_str}
            if data.title is not None:
                update_fields["title"] = data.title
            if data.description is not None:
                update_fields["description"] = data.description
            supabase.table("quizzes").update(update_fields).eq("id", quiz_id).execute()
            
            if data.questions is not None:
                # Delete existing questions (cascade deletes options)
                supabase.table("questions").delete().eq("quiz_id", quiz_id).execute()
                for q_idx, q in enumerate(data.questions, start=1):
                    q_id = str(uuid.uuid4())
                    supabase.table("questions").insert({
                        "id": q_id,
                        "quiz_id": quiz_id,
                        "question_text": q.question_text,
                        "time_limit": q.time_limit,
                        "question_order": q_idx,
                        "created_at": now_str
                    }).execute()
                    for opt_idx, opt in enumerate(q.options, start=1):
                        supabase.table("options").insert({
                            "id": str(uuid.uuid4()),
                            "question_id": q_id,
                            "option_text": opt.option_text,
                            "option_order": opt_idx,
                            "is_correct": opt.is_correct
                        }).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    if data.title is not None:
                        cur.execute("UPDATE quizzes SET title = ?, updated_at = ? WHERE id = ?", (data.title, now_str, quiz_id))
                    if data.description is not None:
                        cur.execute("UPDATE quizzes SET description = ?, updated_at = ? WHERE id = ?", (data.description, now_str, quiz_id))
                    if data.questions is not None:
                        cur.execute("DELETE FROM questions WHERE quiz_id = ?", (quiz_id,))
                        for q_idx, q in enumerate(data.questions, start=1):
                            q_id = str(uuid.uuid4())
                            cur.execute(
                                "INSERT INTO questions (id, quiz_id, question_text, time_limit, question_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                                (q_id, quiz_id, q.question_text, q.time_limit, q_idx, now_str)
                            )
                            for opt_idx, opt in enumerate(q.options, start=1):
                                cur.execute(
                                    "INSERT INTO options (id, question_id, option_text, option_order, is_correct) VALUES (?, ?, ?, ?, ?)",
                                    (str(uuid.uuid4()), q_id, opt.option_text, opt_idx, 1 if opt.is_correct else 0)
                                )
            finally:
                conn.close()
                
        return QuizService.get_quiz_detail(creator_id, quiz_id)

    @staticmethod
    def delete_quiz(creator_id: str, quiz_id: str) -> bool:
        mode = check_db_backend()
        QuizService.get_quiz_detail(creator_id, quiz_id)
        if mode == "supabase" and supabase:
            supabase.table("quizzes").delete().eq("id", quiz_id).eq("creator_id", creator_id).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute("DELETE FROM quizzes WHERE id = ? AND creator_id = ?", (quiz_id, creator_id))
            finally:
                conn.close()
        return True

    @staticmethod
    def publish_quiz(creator_id: str, quiz_id: str) -> Dict[str, Any]:
        quiz = QuizService.get_quiz_detail(creator_id, quiz_id)
        
        # Validation rules:
        # Title must exist
        if not quiz.get("title") or len(quiz["title"].strip()) < 3:
            raise ValueError("Quiz title is required and must have at least 3 characters")
            
        questions = quiz.get("questions") or []
        if len(questions) < 1:
            raise ValueError("Quiz must have at least one question before publishing")
            
        for idx, q in enumerate(questions, start=1):
            opts = q.get("options") or []
            if len(opts) < 3:
                raise ValueError(f"Question #{idx} must have at least 3 options")
            correct_opts = [o for o in opts if o.get("is_correct")]
            if len(correct_opts) != 1:
                raise ValueError(f"Question #{idx} must have exactly one correct answer selected")
            if q.get("time_limit", 0) < 3:
                raise ValueError(f"Question #{idx} must have a valid time limit (minimum 3 seconds)")
                
        now_str = datetime.now(timezone.utc).isoformat()
        room_code = generate_room_code(6)
        session_id = str(uuid.uuid4())
        mode = check_db_backend()
        
        if mode == "supabase" and supabase:
            # Update quiz status to published
            supabase.table("quizzes").update({
                "status": "published",
                "published_at": now_str,
                "updated_at": now_str
            }).eq("id", quiz_id).execute()
            
            # Create session
            supabase.table("quiz_sessions").insert({
                "id": session_id,
                "quiz_id": quiz_id,
                "room_code": room_code,
                "status": "waiting",
                "current_question_index": 0,
                "created_at": now_str
            }).execute()
        else:
            conn = get_sqlite_conn()
            try:
                with conn:
                    cur = conn.cursor()
                    cur.execute("UPDATE quizzes SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?", (now_str, now_str, quiz_id))
                    cur.execute(
                        "INSERT INTO quiz_sessions (id, quiz_id, room_code, status, current_question_index, created_at) VALUES (?, ?, ?, 'waiting', 0, ?)",
                        (session_id, quiz_id, room_code, now_str)
                    )
            finally:
                conn.close()
                
        join_url = f"{settings.FRONTEND_URL}/join/{room_code}"
        return {
            "session_id": session_id,
            "quiz_id": quiz_id,
            "room_code": room_code,
            "status": "waiting",
            "join_url": join_url
        }

quiz_service = QuizService()
