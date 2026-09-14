import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory for backend
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class Settings:
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    FORCE_SQLITE: bool = os.getenv("FORCE_SQLITE", "false").lower() in ("true", "1")
    
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-cyber-key-quiz-jwt")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

settings = Settings()
