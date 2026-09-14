import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import check_db_backend
from app.routers.auth import router as auth_router
from app.routers.quizzes import router as quizzes_router
from app.routers.sessions import router as sessions_router
from app.routers.participants import router as participants_router
from app.routers.results import router as results_router
from app.websocket.admin import router as ws_admin_router
from app.websocket.participant import router as ws_participant_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cyber_quiz.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    backend_mode = check_db_backend()
    logger.info("==================================================")
    logger.info(" CYBER SECURITY QUIZ PLATFORM - BACKEND INITIALIZED")
    logger.info(f" Database Engine Mode: {backend_mode.upper()}")
    logger.info(f" Frontend Origin Configured: {settings.FRONTEND_URL}")
    logger.info("==================================================")
    yield
    logger.info("Shutting down Cyber Quiz Platform Backend...")

app = FastAPI(
    title="Cyberpunk Real-Time Quiz Platform API",
    description="Server-authoritative, real-time cybersecurity quiz engine with WebSockets, dynamic options, and anti-cheat timing.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.0.112:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for LAN phone access and local testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST Routers
app.include_router(auth_router)
app.include_router(quizzes_router)
app.include_router(sessions_router)
app.include_router(participants_router)
app.include_router(results_router)

# Include WebSocket Routers
app.include_router(ws_admin_router)
app.include_router(ws_participant_router)

@app.get("/api/health", tags=["Health"])
def health_check():
    db_mode = check_db_backend()
    return {
        "status": "healthy",
        "service": "cyber_quiz_backend",
        "db_mode": db_mode,
        "websocket_support": True
    }
