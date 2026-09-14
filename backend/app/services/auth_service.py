import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.database import supabase, check_db_backend, get_sqlite_conn
from app.utils.security import hash_password, verify_password, create_access_token
from app.schemas.auth import CreatorRegisterRequest, CreatorLoginRequest, TokenResponse

logger = logging.getLogger("cyber_quiz.auth")

class AuthService:
    
    @staticmethod
    def register_creator(req: CreatorRegisterRequest) -> Dict[str, Any]:
        username = req.username.strip()
        pwd_hash = hash_password(req.password)
        creator_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        
        mode = check_db_backend()
        if mode == "supabase" and supabase:
            # Check unique username
            try:
                existing = supabase.table("creators").select("id").eq("username", username).execute()
                if existing.data:
                    raise ValueError("Username is already taken")
                supabase.table("creators").insert({
                    "id": creator_id,
                    "username": username,
                    "password_hash": pwd_hash,
                    "created_at": now_str
                }).execute()
            except ValueError:
                raise
            except Exception as e:
                logger.warning(f"Supabase register error: {e}")
        
        # Dual-write to local SQLite so offline / fallback authentication is preserved
        conn = get_sqlite_conn()
        try:
            with conn:
                cur = conn.cursor()
                cur.execute("SELECT id FROM creators WHERE username = ?", (username,))
                if cur.fetchone():
                    if mode != "supabase":
                        raise ValueError("Username is already taken")
                else:
                    cur.execute(
                        "INSERT INTO creators (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                        (creator_id, username, pwd_hash, now_str)
                    )
        finally:
            conn.close()

        return {"id": creator_id, "username": username, "created_at": now_str}

    @staticmethod
    def authenticate_creator(req: CreatorLoginRequest) -> TokenResponse:
        username = req.username.strip()
        mode = check_db_backend()
        user_record = None
        
        # 1. Try primary Supabase if available
        if mode == "supabase" and supabase:
            try:
                res = supabase.table("creators").select("*").eq("username", username).execute()
                if res.data:
                    user_record = res.data[0]
            except Exception as e:
                logger.warning(f"Supabase login lookup error: {e}")
        
        # 2. If not found in Supabase (or fallback mode), check local SQLite
        if not user_record:
            conn = get_sqlite_conn()
            try:
                cur = conn.cursor()
                cur.execute("SELECT * FROM creators WHERE username = ?", (username,))
                row = cur.fetchone()
                if row:
                    user_record = dict(row)
                    # If Supabase is active, sync this local account to Supabase
                    if supabase and mode == "supabase":
                        try:
                            supabase.table("creators").upsert({
                                "id": user_record["id"],
                                "username": user_record["username"],
                                "password_hash": user_record["password_hash"],
                                "created_at": user_record["created_at"]
                            }).execute()
                        except Exception:
                            pass
            finally:
                conn.close()
                
        if not user_record or not verify_password(req.password, user_record["password_hash"]):
            raise ValueError("Invalid username or password")
            
        token = create_access_token({
            "sub": user_record["id"],
            "username": user_record["username"]
        })
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            creator_id=user_record["id"],
            username=user_record["username"]
        )

auth_service = AuthService()
