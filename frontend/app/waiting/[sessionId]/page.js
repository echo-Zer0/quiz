"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Radio, Users, ShieldAlert, Cpu, CheckCircle2 } from "lucide-react";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import { getWsBaseUrl, fetchApi } from "@/lib/api";
import { getParticipantCookie, saveParticipantCookie } from "@/lib/cookies";

export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [participantId, setParticipantId] = useState("");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [connected, setConnected] = useState(false);
  const [systemLogs, setSystemLogs] = useState([
    "INITIALIZING SECURE QUIZ PROTOCOL...",
    "ESTABLISHING WEBSOCKET TELEMETRY...",
  ]);

  const wsRef = useRef(null);

  useEffect(() => {
    let pId = sessionStorage.getItem("cyber_participant_id");
    let uName = sessionStorage.getItem("cyber_username");
    let rCode = sessionStorage.getItem("cyber_room_code");
    let qTitle = sessionStorage.getItem("cyber_quiz_title");

    // Recover from persistent cookie if sessionStorage is empty
    const cookieData = getParticipantCookie(sessionId);
    if (cookieData && cookieData.participant_id) {
      pId = pId || cookieData.participant_id;
      uName = uName || cookieData.username;
      rCode = rCode || cookieData.room_code;
      qTitle = qTitle || cookieData.quiz_title;
      sessionStorage.setItem("cyber_participant_id", pId);
      sessionStorage.setItem("cyber_username", uName);
      if (rCode) sessionStorage.setItem("cyber_room_code", rCode);
      if (qTitle) sessionStorage.setItem("cyber_quiz_title", qTitle);
    }

    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (!pId && sp.get("pid")) {
        pId = sp.get("pid");
        sessionStorage.setItem("cyber_participant_id", pId);
      }
      if ((!uName || uName === "Hacker") && sp.get("u")) {
        uName = sp.get("u");
        sessionStorage.setItem("cyber_username", uName);
      }
    }

    if (pId && uName) {
      saveParticipantCookie(sessionId, {
        participant_id: pId,
        username: uName,
        session_id: sessionId,
        room_code: rCode,
        quiz_title: qTitle,
      });
    }

    if (!pId || !sessionId) {
      router.push("/");
      return;
    }

    setParticipantId(pId);
    setUsername(uName || "Hacker");
    setRoomCode(rCode || "---");
    setQuizTitle(qTitle || "Cyber Quiz");

    const quizRoute = `/quiz/${sessionId}?pid=${pId}&u=${encodeURIComponent(uName || "Hacker")}`;

    // Check if session is already active
    fetchApi(`/api/sessions/id/${sessionId}`)
      .then((sess) => {
        if (sess.status === "running") {
          router.push(quizRoute);
        }
      })
      .catch(() => {});

    // Establish WebSocket connection
    const wsUrl = `${getWsBaseUrl()}/ws/participant/${sessionId}/${pId}?username=${encodeURIComponent(uName || "Hacker")}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setSystemLogs((prev) => [
        ...prev,
        `SECURE LINK ESTABLISHED // SESSION: ${sessionId.slice(0, 8)}`,
        "SYSTEM STATUS: STANDBY // WAITING FOR GAME MASTER...",
      ]);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "waiting_state") {
          if (msg.data.status === "running") {
            router.push(quizRoute);
            return;
          }
          setParticipantCount(msg.data.participant_count || 1);
        } else if (msg.event === "participant_joined") {
          setParticipantCount(msg.data.participant_count || 1);
          setSystemLogs((prev) => [
            ...prev,
            `&gt; AGENT [${msg.data.username}] JOINED ROOM (TOTAL: ${msg.data.participant_count})`,
          ]);
        } else if (msg.event === "participant_left") {
          setParticipantCount(msg.data.participant_count || 1);
        } else if (msg.event === "quiz_started") {
          setSystemLogs((prev) => [
            ...prev,
            "&gt;&gt;&gt; START SIGNAL RECEIVED! DEPLOYING CHALLENGES...",
          ]);
          // Instant automatic transition to live quiz
          setTimeout(() => {
            router.push(quizRoute);
          }, 600);
        }
      } catch (err) {
        console.error("WS Parse error:", err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId, router]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/60 border border-cyan-400/40 text-cyan-400 font-mono text-xs tracking-widest uppercase">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>STANDBY ARENA // ROOM {roomCode}</span>
          </div>

          <GlitchText
            text={quizTitle || "CYBER QUIZ STANDBY"}
            as="h2"
            className="text-2xl sm:text-3xl md:text-4xl font-black text-cyan-400 glow-cyan tracking-wider"
          />

          <p className="text-xs font-mono text-slate-300">
            Authenticated Agent: <span className="text-cyan-300 font-bold glow-cyan">{username}</span>
          </p>
        </div>

        {/* Live Standby HUD Card */}
        <CyberCard
          title="PROTOCOL SYNC: STANDBY"
          badge={`ROOM: ${roomCode}`}
          glowColor="cyan"
          className="space-y-6"
        >
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-black/60 border border-cyan-500/20 font-mono text-xs">
            <div>
              <div className="text-slate-400 uppercase text-[10px]">CALLSIGN</div>
              <div className="text-cyan-300 font-bold text-sm truncate">{username}</div>
            </div>

            <div>
              <div className="text-slate-400 uppercase text-[10px]">CONNECTED PLAYERS</div>
              <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>{participantCount}</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <div className="text-slate-400 uppercase text-[10px]">SERVER LINK</div>
              <div className="text-sm font-bold flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-ping" : "bg-rose-500"}`} />
                <span className={connected ? "text-emerald-400" : "text-rose-400"}>
                  {connected ? "LIVE WS SYNC" : "CONNECTING..."}
                </span>
              </div>
            </div>
          </div>

          {/* Animated Terminal Waiting Screen */}
          <div className="p-4 bg-black/80 border border-cyan-500/30 font-mono text-xs space-y-2 min-h-[160px]">
            <div className="text-slate-400 uppercase text-[10px] tracking-widest border-b border-cyan-500/20 pb-1">
              TERMINAL LOGS // GAME MASTER BROADCAST FEED
            </div>
            <div className="space-y-1 text-cyan-300">
              {systemLogs.map((log, i) => (
                <div key={i} className="flex items-start">
                  <span className="text-cyan-600 mr-2 select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
              <div className="flex items-center text-emerald-400 animate-pulse pt-2">
                <span className="text-emerald-600 mr-2 select-none">&gt;</span>
                <span>AWAITING GAME MASTER START COMMAND...</span>
                <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-cursor ml-1.5" />
              </div>
            </div>
          </div>

          <div className="text-center font-mono text-[11px] text-slate-400">
            &gt; Do not refresh this page. The quiz will automatically begin the instant the admin launches the session.
          </div>
        </CyberCard>
      </div>
    </div>
  );
}
