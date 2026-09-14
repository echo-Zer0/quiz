"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Square,
  Users,
  QrCode,
  Trophy,
  Shield,
  RefreshCw,
  BarChart2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  FastForward,
  Zap,
  Activity,
  Layers,
  X
} from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import Leaderboard from "@/components/Leaderboard";
import ErrorMessage from "@/components/ErrorMessage";
import { getWsBaseUrl, fetchApi } from "@/lib/api";

export default function AdminSessionControlPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [confirmEndModal, setConfirmEndModal] = useState(false);
  const [showQrProjector, setShowQrProjector] = useState(true);
  const [isRefreshingScoreboard, setIsRefreshingScoreboard] = useState(false);

  // Live Answer Activity Stream Ticker
  const [activityFeed, setActivityFeed] = useState([]);

  // Next Quiz Launcher Modal
  const [showNextQuizModal, setShowNextQuizModal] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [launchingQuizId, setLaunchingQuizId] = useState(null);

  const wsRef = useRef(null);

  // Load session from API
  const loadSession = async () => {
    try {
      const data = await fetchApi(`/api/sessions/id/${sessionId}`);
      setSession(data);
    } catch (err) {
      if (err.message.includes("401") || err.message.includes("token")) {
        router.push("/admin/login");
      } else {
        setError(err.message || "Failed to load session details.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual or interval scoreboard refresh
  const refreshLeaderboard = async () => {
    setIsRefreshingScoreboard(true);
    try {
      const lb = await fetchApi(`/api/sessions/${sessionId}/leaderboard`);
      setLeaderboard(lb);
    } catch (e) {
      console.error("Leaderboard fetch error:", e);
    } finally {
      setTimeout(() => setIsRefreshingScoreboard(false), 500);
    }
  };

  useEffect(() => {
    loadSession();
    refreshLeaderboard();

    // Connect admin websocket
    const token = typeof window !== "undefined" ? localStorage.getItem("cyber_creator_token") : null;
    const wsUrl = `${getWsBaseUrl()}/ws/admin/${sessionId}${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "admin_sync") {
          setSession(msg.data.session);
          setParticipants(msg.data.connected_participants || []);
          if (msg.data.leaderboard) {
            setLeaderboard(msg.data.leaderboard);
          }
        } else if (msg.event === "participant_joined") {
          setParticipants(msg.data.participants || []);
          loadSession();
          setActivityFeed((prev) => [
            {
              id: Date.now(),
              text: `Agent [${msg.data.username}] connected to room`,
              type: "join",
              time: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9),
          ]);
        } else if (msg.event === "participant_left") {
          loadSession();
          setActivityFeed((prev) => [
            {
              id: Date.now(),
              text: `Agent [${msg.data.username}] disconnected`,
              type: "leave",
              time: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9),
          ]);
        } else if (msg.event === "answer_received") {
          // Instant 0ms scoreboard update from answer payload!
          if (msg.data.leaderboard) {
            setLeaderboard(msg.data.leaderboard);
          } else {
            refreshLeaderboard();
          }

          // Push into live activity ticker
          setActivityFeed((prev) => [
            {
              id: Date.now(),
              text: `Agent [${msg.data.username}] answered ${msg.data.is_correct ? "CORRECTLY" : "WRONGLY"} (+${msg.data.points} pts, ${msg.data.response_time_ms || 0}ms)`,
              type: msg.data.is_correct ? "correct" : "wrong",
              time: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9),
          ]);
        } else if (msg.event === "leaderboard_updated") {
          // Direct broadcast of new scoreboard
          if (msg.data.leaderboard) {
            setLeaderboard(msg.data.leaderboard);
          }
        } else if (msg.event === "quiz_started") {
          setSession((prev) => (prev ? { ...prev, status: "running" } : null));
        } else if (msg.event === "quiz_ended") {
          setSession((prev) => (prev ? { ...prev, status: "ended" } : null));
          if (msg.data.leaderboard) {
            setLeaderboard(msg.data.leaderboard);
          }
        }
      } catch (err) {
        console.error("WS event error:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    // Auto-polling fallback every 3s to guarantee 100% sync
    const pollInterval = setInterval(() => {
      refreshLeaderboard();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId, router]);

  // Start Quiz
  const handleStartQuiz = async () => {
    try {
      await fetchApi(`/api/sessions/${sessionId}/start`, { method: "POST" });
      setSession((prev) => ({ ...prev, status: "running" }));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "start_quiz" }));
      }
    } catch (err) {
      alert(`Failed to start quiz: ${err.message}`);
    }
  };

  // Next Question (Advance room)
  const handleNextQuestion = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "next_question" }));
      setActivityFeed((prev) => [
        {
          id: Date.now(),
          text: "GAME MASTER BROADCASTED: ADVANCE TO NEXT CHALLENGE",
          type: "admin",
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
    }
  };

  // End Quiz
  const handleEndQuiz = async () => {
    try {
      await fetchApi(`/api/sessions/${sessionId}/end`, { method: "POST" });
      setSession((prev) => ({ ...prev, status: "ended" }));
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "end_quiz" }));
      }
      setConfirmEndModal(false);
      refreshLeaderboard();
    } catch (err) {
      alert(`Failed to end quiz: ${err.message}`);
    }
  };

  // Open Next Quiz Selector Modal
  const handleOpenNextQuizModal = async () => {
    setShowNextQuizModal(true);
    setLoadingQuizzes(true);
    try {
      const allQuizzes = await fetchApi("/api/quizzes");
      // Filter out current quiz
      const others = allQuizzes.filter((q) => q.id !== session?.quiz_id);
      setAvailableQuizzes(others);
    } catch (e) {
      console.error("Failed to load quizzes:", e);
    } finally {
      setLoadingQuizzes(false);
    }
  };

  // Launch another quiz session
  const handleLaunchNewQuiz = async (quizId) => {
    setLaunchingQuizId(quizId);
    try {
      const res = await fetchApi(`/api/quizzes/${quizId}/publish`, { method: "POST" });
      setShowNextQuizModal(false);
      router.push(`/admin/session/${res.session_id}`);
    } catch (err) {
      alert(`Launch error: ${err.message}`);
    } finally {
      setLaunchingQuizId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-cyan-400 text-sm animate-pulse">
        &gt; CONNECTING TO MISSION CONTROL SESSION...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <ErrorMessage message={error || "Session not found."} />
        <Link href="/admin/dashboard">
          <CyberButton variant="outline" className="mt-4">
            RETURN TO DASHBOARD
          </CyberButton>
        </Link>
      </div>
    );
  }

  // For mobile QR code scanning: if opened on localhost, automatically prefer reachable LAN IP so phones connect
  const getProjectorJoinUrl = () => {
    if (typeof window === "undefined") return `http://localhost:3000/join/${session.room_code}`;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost && session?.lan_ip && session.lan_ip !== "127.0.0.1") {
      return `http://${session.lan_ip}:3000/join/${session.room_code}`;
    }
    return `${window.location.origin}/join/${session.room_code}`;
  };

  const joinUrl = getProjectorJoinUrl();

  return (
    <div className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-6">
        <div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan-400 hover:text-cyan-300 mb-2 uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>EXIT TO DASHBOARD</span>
          </Link>
          <GlitchText
            text="QUIZ CONTROL CENTER"
            as="h1"
            className="text-2xl sm:text-3xl font-black text-cyan-400 glow-cyan tracking-wider"
          />
          <p className="text-xs font-mono text-slate-300 mt-1">
            TARGET QUIZ: <span className="text-white font-bold">{session.quiz_title}</span> &bull; ROOM:{" "}
            <span className="text-cyan-300 font-bold tracking-widest">{session.room_code}</span>
          </p>
        </div>

        {/* Master Control Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {session.status === "waiting" && (
            <CyberButton
              size="lg"
              variant="green"
              onClick={handleStartQuiz}
              icon={Play}
            >
              START QUIZ NOW
            </CyberButton>
          )}

          {session.status === "running" && (
            <>
              {/* NEXT QUESTION BUTTON (for advancing all participants) */}
              <CyberButton
                size="md"
                variant="cyan"
                onClick={handleNextQuestion}
                icon={FastForward}
              >
                NEXT QUESTION
              </CyberButton>

              {/* END QUIZ BUTTON */}
              <CyberButton
                size="md"
                variant="red"
                onClick={() => setConfirmEndModal(true)}
                icon={Square}
              >
                END QUIZ
              </CyberButton>
            </>
          )}

          {/* NEXT QUIZ BUTTON */}
          <CyberButton
            size="md"
            variant="purple"
            onClick={handleOpenNextQuizModal}
            icon={Layers}
          >
            NEXT QUIZ
          </CyberButton>

          {session.status === "ended" && (
            <Link href={`/admin/results/${sessionId}`}>
              <CyberButton size="md" variant="cyan" icon={BarChart2}>
                VIEW FINAL DEBRIEF
              </CyberButton>
            </Link>
          )}
        </div>
      </div>

      {/* Real-time Status Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <div className="p-4 bg-black/60 border border-cyan-500/30">
          <div className="text-[10px] text-slate-400 uppercase">ROOM STATUS</div>
          <div className="text-lg font-bold uppercase mt-1 flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                session.status === "running"
                  ? "bg-emerald-400 animate-ping"
                  : session.status === "waiting"
                  ? "bg-cyan-400"
                  : "bg-slate-500"
              }`}
            />
            <span className={session.status === "running" ? "text-emerald-400 glow-green" : "text-cyan-300"}>
              {session.status}
            </span>
          </div>
        </div>

        <div className="p-4 bg-black/60 border border-cyan-500/30">
          <div className="text-[10px] text-slate-400 uppercase">CONNECTED AGENTS</div>
          <div className="text-2xl font-black text-cyan-400 glow-cyan mt-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>{participants.length || session.participant_count}</span>
          </div>
        </div>

        <div className="p-4 bg-black/60 border border-cyan-500/30">
          <div className="text-[10px] text-slate-400 uppercase">QUESTIONS BUFFER</div>
          <div className="text-2xl font-black text-purple-400 glow-purple mt-1">
            {session.total_questions}
          </div>
        </div>

        <div className="p-4 bg-black/60 border border-cyan-500/30">
          <div className="text-[10px] text-slate-400 uppercase">SOCKET TELEMETRY</div>
          <div className="text-xs font-bold mt-2 flex items-center justify-between">
            <span className={connected ? "text-emerald-400 glow-green" : "text-rose-400"}>
              {connected ? "[ONLINE] WS LIVE" : "[OFFLINE] RETRY"}
            </span>
            <button
              onClick={refreshLeaderboard}
              title="Manual Scoreboard Refresh"
              className="p-1 hover:text-cyan-400 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingScoreboard ? "animate-spin text-cyan-400" : "text-slate-400"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split View: QR Projector & Live Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: QR Code Projector Terminal & Live Telemetry Feed */}
        <div className="lg:col-span-5 space-y-6">
          <CyberCard
            title="ROOM ACCESS // PROJECTOR DISPLAY"
            badge={`CODE: ${session.room_code}`}
            glowColor="cyan"
            headerRight={
              <button
                onClick={() => setShowQrProjector(!showQrProjector)}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 uppercase"
              >
                {showQrProjector ? "MINIMIZE" : "EXPAND"}
              </button>
            }
          >
            {showQrProjector ? (
              <QRCodeDisplay
                url={joinUrl}
                roomCode={session.room_code}
                size={260}
              />
            ) : (
              <div className="p-4 text-center font-mono text-sm text-cyan-300">
                ROOM CODE: <span className="text-xl font-bold tracking-widest">{session.room_code}</span>
              </div>
            )}
          </CyberCard>

          {/* Live Activity Telemetry Feed */}
          <CyberCard
            title="REAL-TIME TELEMETRY FEED"
            badge="LIVE STREAM"
            glowColor="purple"
          >
            {activityFeed.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-slate-400">
                &gt; STANDBY: AWAITING SUBMISSIONS AND TELEMETRY...
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto">
                {activityFeed.map((act) => (
                  <div
                    key={act.id}
                    className={`p-2 border text-[11px] flex items-center justify-between ${
                      act.type === "correct"
                        ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                        : act.type === "wrong"
                        ? "border-rose-500/40 bg-rose-950/20 text-rose-300"
                        : act.type === "admin"
                        ? "border-cyan-500/40 bg-cyan-950/20 text-cyan-300"
                        : "border-slate-800 bg-black/40 text-slate-300"
                    }`}
                  >
                    <span className="truncate pr-2">&gt; {act.text}</span>
                    <span className="text-slate-500 text-[9px] shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
            )}
          </CyberCard>
        </div>

        {/* Right Column: Live Real-Time Leaderboard Scoreboard */}
        <div className="lg:col-span-7 space-y-6">
          <CyberCard
            title="REAL-TIME TOURNAMENT SCOREBOARD"
            badge="AUTO-UPDATE 0MS"
            glowColor="cyan"
            headerRight={
              <button
                onClick={refreshLeaderboard}
                className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingScoreboard ? "animate-spin text-cyan-300" : ""}`} />
                <span>SYNC</span>
              </button>
            }
          >
            <Leaderboard leaderboard={leaderboard} compact={false} />
          </CyberCard>
        </div>
      </div>

      {/* NEXT QUIZ QUICK-LAUNCH MODAL */}
      {showNextQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xl p-6 bg-[#0b1120] border-2 border-purple-500 shadow-[0_0_30px_rgba(157,0,255,0.6)] space-y-4 font-mono relative">
            <button
              onClick={() => setShowNextQuizModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white border border-slate-700 hover:border-purple-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-purple-400 font-bold text-lg">
              <Layers className="w-5 h-5 text-purple-400 glow-purple" />
              <span>LAUNCH NEXT QUIZ SESSION</span>
            </div>

            <p className="text-xs text-slate-300">
              Select another quiz from your repository to generate a new live room and launch immediately:
            </p>

            {loadingQuizzes ? (
              <div className="py-8 text-center text-xs text-cyan-400 animate-pulse">
                &gt; RETRIEVING AVAILABLE QUIZZES...
              </div>
            ) : availableQuizzes.length === 0 ? (
              <div className="p-6 text-center border border-slate-800 text-xs text-slate-400 space-y-3">
                <p>&gt; No other quizzes found in your repository.</p>
                <Link href="/admin/quiz/new">
                  <CyberButton size="sm" variant="cyan">
                    CREATE NEW QUIZ
                  </CyberButton>
                </Link>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                {availableQuizzes.map((q) => (
                  <div
                    key={q.id}
                    className="p-3 border border-slate-800 bg-black/60 hover:border-purple-500/60 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{q.title}</div>
                      <div className="text-[10px] text-slate-400">
                        {q.question_count} Questions &bull; Status: {q.status.toUpperCase()}
                      </div>
                    </div>

                    <CyberButton
                      size="sm"
                      variant="purple"
                      loading={launchingQuizId === q.id}
                      onClick={() => handleLaunchNewQuiz(q.id)}
                      icon={Play}
                    >
                      LAUNCH THIS QUIZ
                    </CyberButton>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px]">
              <Link href="/admin/quiz/new">
                <span className="text-cyan-400 hover:underline">+ Create Brand New Quiz</span>
              </Link>
              <CyberButton
                size="sm"
                variant="outline"
                onClick={() => setShowNextQuizModal(false)}
              >
                CLOSE
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for END QUIZ */}
      {confirmEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-6 bg-[#0b1120] border-2 border-rose-500 shadow-[0_0_30px_rgba(255,0,85,0.6)] space-y-4 font-mono">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-lg">
              <Square className="w-5 h-5 text-rose-400" />
              <span>CONFIRM QUIZ TERMINATION</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to conclude the quiz session? This will immediately lock submissions for all participants, calculate final standings, and reveal answer keys.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <CyberButton
                size="sm"
                variant="outline"
                onClick={() => setConfirmEndModal(false)}
              >
                CANCEL
              </CyberButton>

              <CyberButton
                size="sm"
                variant="red"
                onClick={handleEndQuiz}
                icon={Square}
              >
                CONFIRM END QUIZ
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
