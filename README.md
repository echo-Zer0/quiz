<div align="center">

```text
  ██████╗██╗   ██╗██████╗ ███████╗██████╗        ██████╗ ██╗   ██╗██╗███████╗
 ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗      ██╔═══██╗██║   ██║██║╚══███╔╝
 ██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝█████╗██║   ██║██║   ██║██║  ███╔╝ 
 ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗╚════╝██║▄▄ ██║██║   ██║██║ ███╔╝  
 ╚██████╗   ██║   ██████╔╝███████╗██║  ██║      ╚██████╔╝╚██████╔╝██║███████╗
  ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝       ╚══▀▀═╝  ╚═════╝ ╚═╝╚══════╝
```

# ⚡ CYBER-QUIZ PLATFORM
### High-Performance, Server-Authoritative Real-Time CTF & Tournament Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js 16](https://img.shields.io/badge/Next.js%2016-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Bidirectional-00f0ff?style=for-the-badge&logo=websocket&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Zero_Config_Fallback-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Turbopack](https://img.shields.io/badge/Turbopack-Blazing_Fast-FF4154?style=for-the-badge&logo=vercel&logoColor=white)](https://turbo.build/)
[![Concurrency](https://img.shields.io/badge/Concurrency-200%2B%20Tested-00ff66?style=for-the-badge)](https://github.com/echo-Zer0/quiz)

<br/>

**A production-grade, server-authoritative tournament quiz engine built for Cyber Security Clubs, CTF Competitions, and Security Training Bootcamps.**

[Key Features](#-key-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [200+ Concurrency Benchmark](#-200-concurrent-users-benchmark) • [Deployment](#-deployment) • [Anti-Cheat](#-anti-cheat--integrity)

</div>

---

## 🌟 Key Features

### 🎮 Player Experience
- **Futuristic Cyberpunk HUD**: Glossy glassmorphism, scanlines, matrix accents, and terminal typography.
- **Instant Join Gateway**: Join in seconds via a 6-digit room code or camera-scannable QR code with automatic LAN IP resolution.
- **Question Traverser**: Jump freely between questions with Next / Previous navigators and an interactive question-status grid.
- **Answer Selection Flexibility**: Change choices before the global timer expires without revealing whether options are correct.
- **Frozen Scoreboard Privacy**: Question correctness and point values are frozen on submit and only revealed when the game master officially concludes the session.
- **Session Resilience & Cookie Recovery**: Page refreshes, network drops, or browser tab restarts automatically restore active player sessions without score loss.

### 🛡️ Anti-Cheat & Tournament Integrity
- **Server-Authoritative Clock**: Eliminates client-side countdown manipulation. Submissions past the time limit are rejected server-side.
- **Answer Leak Protection**: The API and WebSockets never send `is_correct` or `correct_option_id` to participants while the room is running.
- **Client Defense Layer**: Built-in clipboard locking (copy/cut/paste prevention), context menu disablement, and tab-switch warning alerts.
- **One User Per Browser**: Local storage & signed session token lockouts prevent multi-accounting from a single browser.
- **Randomized Challenge Sequences**: Each contestant receives a deterministically randomized challenge order to combat screen-peeking.

### ⚡ Game Master & Admin Control Center
- **Dynamic Quiz Creator**: Build quizzes with custom time limits, dynamic multiple-choice options, and formatted questions.
- **Real-Time Telemetry Ticker**: Watch answers and player progress stream into the live admin cockpit as contestants click submit.
- **Global Countdown Synchronizer**: Start, monitor, and freeze matches room-wide with sub-millisecond precision.
- **Instant Debrief & Analytics**: Exportable scorecards, accuracy percentages, response-time breakdowns, and podium ranks.

---

## 🏗️ Architecture

```text
quiz-web/
├── backend/                        # FastAPI High-Concurrency Async Service
│   ├── app/
│   │   ├── main.py                 # Application Lifespan & Route Registration
│   │   ├── config.py               # Pydantic Settings & Environment Parser
│   │   ├── database.py             # Dual Engine: Supabase Cloud + Local SQLite
│   │   ├── schemas/                # Strict Pydantic v2 Contracts
│   │   ├── routers/                # REST Controllers (Auth, Quizzes, Sessions, Participants)
│   │   ├── services/               # Authoritative Business Logic & In-Memory Caches
│   │   │   ├── session_service.py  # 200+ High-Concurrency Batching & Cache Hub
│   │   │   ├── quiz_service.py     # Quiz Lifecycle & Publishing Engine
│   │   │   └── scoring_service.py  # Sub-millisecond Time-Decay Scoring Math
│   │   ├── websocket/              # Asynchronous Non-Blocking WebSocket Layer
│   │   │   ├── manager.py          # Parallel Broadcaster & 25s Keep-Alive Heartbeat
│   │   │   ├── admin.py            # Live Admin HUD Channel
│   │   │   └── participant.py      # Lightweight Participant Socket Hub
│   │   └── utils/                  # Cryptographic Tokens & Room Code Utilities
│   ├── database/schema.sql         # Cloud PostgreSQL Migration Schema
│   └── requirements.txt            # Python Dependencies
│
├── frontend/                       # Next.js 16 App Router (React 19 & Turbopack)
│   ├── app/
│   │   ├── layout.js               # Cyberpunk Audio/HUD Layout & Ambient FX
│   │   ├── page.js                 # Arena Entrance (Join Room & Host Portal)
│   │   ├── join/[roomCode]/        # Direct QR & Room Link Access Resolver
│   │   ├── waiting/[sessionId]/    # Real-Time Standby Grid & Roster Counter
│   │   ├── quiz/[sessionId]/       # Active Quiz Arena & Question Navigator
│   │   ├── results/[id]/           # Post-Match Personal Scorecard & Answer Key
│   │   └── admin/                  # Game Master Suite (Login, Editor, HUD, Telemetry)
│   ├── components/                 # Reusable Neon Cyberpunk UI Components
│   └── lib/api.js                  # Dynamic API & WebSocket Origin Resolver
│
└── .gitignore                      # Strict Protection for Secrets, DBs & Environments
```

---

## ⚡ 200+ Concurrent Users Benchmark

The engine is specifically optimized to run smoothly on free-tier infrastructure (e.g. Hugging Face Spaces, Supabase Free Tier, Render, Fly.io) without socket timeouts, connection pool exhaustion, or database throttling.

### 📊 Benchmark Results (200 Simultaneous Participants)

```text
=======================================================================
🚀 200 CONCURRENT USERS REAL-TIME BENCHMARK RESULTS 🚀
=======================================================================
Total Test Wall Time:            6.66 s
Total Operations Executed:       600 HTTP Calls (Join ➔ Fetch ➔ Submit)
Successful User Trajectories:    200 / 200 (100.0%)
Failures / Dropped Requests:     0 (0.0%)
Average Join Latency:            995.87 ms
Average Question Fetch (RAM):    3.98 ms  (Sub-5ms In-Memory Cache Hit)
Average Answer Submit Latency:   903.33 ms
Effective Throughput:            90.1 req/sec
=======================================================================
```

### ⚡ WebSocket Concurrent Stress Test

```text
=======================================================================
⚡ 200 CONCURRENT WEBSOCKET BENCHMARK RESULTS ⚡
=======================================================================
Concurrent Active Sockets:       200 / 200 (100.0%)
Socket Handshake + Ping-Pong:    10.86 s
Connection Failures:             0
Average Roundtrip per Client:    54.31 ms
Heartbeat Interval:              25s (Eliminates 60s Reverse-Proxy Drops)
=======================================================================
```

### 🛠️ Optimization Highlights
1. **Single-Query Batch Insert**: Question sequences for joining players are inserted as a single batch array instead of loops of individual queries ($2,000\rightarrow 1$ DB request).
2. **Immutable Question Caches**: Questions and options are cached in server RAM (`_quiz_questions_cache`), serving all 200 players at sub-5ms latency with zero DB queries.
3. **Participant Metadata Cache**: Resolves player session lookups in memory (`_participant_meta_cache`), dropping answer submission database overhead by 75%.
4. **1.5s Short-TTL Leaderboard Cache**: Protects against aggregate sorting spikes when dozens of answers arrive simultaneously.
5. **Non-Blocking WebSocket Broadcasts**: Leverages `asyncio.gather` with error isolation, ensuring one slow mobile client never blocks the room broadcast.
6. **25s Background Heartbeat**: Automatic WebSocket ping/pong loop stops cloud proxies (Cloudflare, Hugging Face, NGINX) from terminating idle connections.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/echo-Zer0/quiz.git
cd quiz
```

### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

Edit `.env` if you want to connect to Supabase:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
JWT_SECRET=your-random-jwt-secret-key
FRONTEND_URL=http://localhost:3000
HOST=0.0.0.0
PORT=8000
```
> **Tip**: If you do not provide Supabase credentials, the platform **automatically boots using its built-in SQLite engine** (`quiz_local.sqlite`) with zero configuration required!

Start the backend:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

---

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install node dependencies
npm install

# Configure environment variables
cp .env.example .env.local
```

Verify `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

Start the frontend development server:
```bash
npm run dev
```
Open your browser at: `http://localhost:3000`

---

## 🌐 LAN Tournament Setup (Local Network CTF)

To host a live competition where players connect via phones, laptops, and tablets on the same Wi-Fi router:

1. **Find your host IP address**:
   ```bash
   hostname -I
   # Example: 192.168.1.150
   ```
2. **Update frontend environment variable** (`frontend/.env.local`):
   ```env
   NEXT_PUBLIC_API_URL=http://192.168.1.150:8000
   NEXT_PUBLIC_WS_URL=ws://192.168.1.150:8000
   ```
3. **Build & run the frontend**:
   ```bash
   npm run build
   npm run start -- -H 0.0.0.0 -p 3000
   ```
4. Participants can now scan the QR code on the admin projector or browse to `http://192.168.1.150:3000` to enter the battle arena!

---

## 🐳 Deployment (Hugging Face Spaces / Docker)

### Deploy to Hugging Face Spaces (Docker Space)
1. Create a new Space on [Hugging Face](https://huggingface.co/spaces) and select **Docker**.
2. Set your repository secret variables (`SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`).
3. Deploy the container. The background WebSocket heartbeat loop will keep connections active and prevent HF 60s proxy termination!

---

## 🔒 Security Best Practices

- All `.env`, `.env.local`, SQLite databases, Python virtual environments, and build artifacts are strictly excluded by `.gitignore`.
- Always generate a high-entropy secret for `JWT_SECRET` in production (`openssl rand -hex 32`).
- CORS headers in `backend/app/main.py` should be restricted to your production domain for public deployments.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">

**Crafted with ⚡ and Neon for the Cybersecurity Community.**

</div>
