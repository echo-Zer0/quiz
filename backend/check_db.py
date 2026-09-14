import sys
import os
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import check_db_backend, supabase
from app.config import settings

def main():
    print("=" * 60)
    print(" CYBER QUIZ PLATFORM - SUPABASE DATABASE CHECK")
    print("=" * 60)
    print(f"SUPABASE_URL: {settings.SUPABASE_URL}")
    print(f"SUPABASE_KEY: {'*' * 10}...{settings.SUPABASE_KEY[-6:] if settings.SUPABASE_KEY else 'NONE'}")
    
    mode = check_db_backend()
    print(f"Current Active Engine: {mode.upper()}")
    
    if mode == "supabase":
        print("\n[SUCCESS] Supabase PostgreSQL tables verified and active!")
        tables = ["creators", "quizzes", "questions", "options", "quiz_sessions", "participants", "participant_questions", "answers"]
        for t in tables:
            try:
                res = supabase.table(t).select("id", count="exact").limit(1).execute()
                print(f" - Table '{t}': OK (Records: {res.count})")
            except Exception as e:
                print(f" - Table '{t}': ERROR ({e})")
    else:
        print("\n[NOTICE] Supabase tables not yet migrated.")
        print("To sync your Supabase PostgreSQL cloud database:")
        print(" 1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/uzapqnrntrzuqfxswqhg")
        print(" 2. Navigate to SQL Editor -> New Query")
        print(" 3. Paste the contents of backend/database/schema.sql")
        print(" 4. Click 'Run'")
        print(" 5. Re-run this script: python backend/check_db.py")
        print("\nNote: The platform is currently running using the local fallback engine, so all functions work immediately!")
    print("=" * 60)

if __name__ == "__main__":
    main()
