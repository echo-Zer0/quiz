"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shield, User, ArrowRight, Radio, AlertTriangle } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import TerminalText from "@/components/TerminalText";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi } from "@/lib/api";
import {
  saveParticipantCookie,
  getParticipantCookie,
  getParticipantCookieByRoom,
  getBrowserId
} from "@/lib/cookies";

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params?.roomCode ? String(params.roomCode).trim().toUpperCase() : "";

  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [username, setUsername] = useState("");
  const [existingParticipant, setExistingParticipant] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomCode) return;

    async function verifyRoom() {
      setLoadingSession(true);
      setError("");
      try {
        const data = await fetchApi(`/api/sessions/code/${roomCode}`);
        setSession(data);
        if (data.status === "ended") {
          setError("This quiz session has already concluded.");
        }

        // Check if this browser already has a participant cookie for this session
        const existing = getParticipantCookie(data.session_id || data.id) || getParticipantCookieByRoom(roomCode);
        if (existing && existing.participant_id) {
          setExistingParticipant(existing);
          setUsername(existing.username);
        }
      } catch (err) {
        setError(err.message || "Invalid or unreachable room code.");
      } finally {
        setLoadingSession(false);
      }
    }

    verifyRoom();
  }, [roomCode]);

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || cleanUser.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    // Enforce one user per browser per session if existing session is present
    if (existingParticipant && cleanUser.toLowerCase() !== existingParticipant.username.toLowerCase()) {
      setError(`RESTRICTION: This browser is already registered as "${existingParticipant.username}" in this session. Clear saved session below to use a new callsign.`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetchApi(`/api/sessions/join/${roomCode}`, {
        method: "POST",
        body: JSON.stringify({
          username: cleanUser,
          participant_id: existingParticipant?.participant_id || undefined,
          browser_id: getBrowserId(),
        }),
      });

      const activeSessionId = res.session_id || session?.session_id || session?.id;

      // Save to persistent cookie so refreshing / closing tab always resumes same session
      saveParticipantCookie(activeSessionId, { ...res, session_id: activeSessionId });

      // Store participant credentials in storage
      sessionStorage.setItem("cyber_participant_id", res.participant_id);
      sessionStorage.setItem("cyber_session_id", activeSessionId);
      sessionStorage.setItem("cyber_username", res.username);
      sessionStorage.setItem("cyber_room_code", res.room_code || roomCode);
      sessionStorage.setItem("cyber_quiz_title", res.quiz_title);

      // Transition directly to Quiz Arena if already started, otherwise Waiting Room
      const queryParams = `?pid=${res.participant_id}&u=${encodeURIComponent(res.username)}`;
      if (session?.status === "running" || res.status === "running") {
        router.push(`/quiz/${activeSessionId}${queryParams}`);
      } else {
        router.push(`/waiting/${activeSessionId}${queryParams}`);
      }
    } catch (err) {
      setError(err.message || "Access Denied: Unable to join room.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 font-mono text-xs tracking-widest uppercase">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>AUTHENTICATION GATEWAY</span>
          </div>

          <GlitchText
            text="JOIN QUIZ ROOM"
            as="h2"
            className="text-3xl md:text-4xl font-black text-cyan-400 glow-cyan tracking-wider"
          />
        </div>

        {/* Room Status Diagnostic Card */}
        <CyberCard
          title="NETWORK HANDSHAKE"
          badge={roomCode}
          glowColor="cyan"
          className="space-y-4"
        >
          {loadingSession ? (
            <div className="space-y-2 py-4 font-mono text-sm text-cyan-400">
              <TerminalText
                lines={[
                  `SEARCHING QUIZ NETWORK FOR ROOM [${roomCode}]...`,
                  "RESOLVING HOST AND TIMING PARAMETERS...",
                ]}
                speed={20}
              />
            </div>
          ) : session ? (
            <div className="space-y-4">
              <div className="p-3 bg-black/60 border border-cyan-500/20 font-mono text-xs space-y-1">
                <div className="text-cyan-400">&gt; ROOM FOUND: <span className="font-bold text-white tracking-widest">{session.room_code}</span></div>
                <div className="text-cyan-400">&gt; TARGET QUIZ: <span className="font-bold text-white">{session.quiz_title}</span></div>
                <div className="text-cyan-400">&gt; SESSION STATUS: <span className="font-bold uppercase text-emerald-400">{session.status}</span></div>
                <div className="text-cyan-400">&gt; CONNECTED PARTICIPANTS: <span className="font-bold text-white">{session.participant_count}</span></div>
              </div>

              {session.status === "ended" ? (
                <div className="p-4 border border-rose-500/60 bg-rose-950/40 text-rose-300 font-mono text-xs">
                  &gt; ACCESS DENIED: SESSION HAS ALREADY TERMINATED.
                </div>
              ) : (
                <form onSubmit={handleJoinSubmit} className="space-y-4 pt-2">
                  {existingParticipant && (
                    <div className="p-3.5 bg-cyan-950/40 border border-cyan-400/40 font-mono text-xs space-y-2.5">
                      <div className="flex items-center justify-between text-cyan-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                          ACTIVE BROWSER SESSION DETECTED
                        </span>
                        <span className="text-emerald-400 uppercase text-[10px] px-1.5 py-0.5 bg-emerald-950/70 border border-emerald-500/40">
                          1 USER / BROWSER
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        This browser is already registered in this session as agent <strong className="text-cyan-300 font-bold glow-cyan">{existingParticipant.username}</strong>.
                      </p>
                      <CyberButton
                        type="button"
                        size="md"
                        variant="cyan"
                        className="w-full"
                        onClick={() => {
                          const targetSessionId = session?.session_id || session?.id || existingParticipant?.session_id;
                          sessionStorage.setItem("cyber_participant_id", existingParticipant.participant_id);
                          sessionStorage.setItem("cyber_session_id", targetSessionId);
                          sessionStorage.setItem("cyber_username", existingParticipant.username);
                          if (roomCode) sessionStorage.setItem("cyber_room_code", roomCode);
                          if (session?.quiz_title) sessionStorage.setItem("cyber_quiz_title", session.quiz_title);

                          const queryParams = `?pid=${existingParticipant.participant_id}&u=${encodeURIComponent(existingParticipant.username)}`;
                          if (session?.status === "running") {
                            router.push(`/quiz/${targetSessionId}${queryParams}`);
                          } else {
                            router.push(`/waiting/${targetSessionId}${queryParams}`);
                          }
                        }}
                        icon={ArrowRight}
                      >
                        RESUME SESSION AS [{existingParticipant.username}]
                      </CyberButton>
                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setExistingParticipant(null);
                            setUsername("");
                          }}
                          className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 underline"
                        >
                          &gt; Register new callsign / reset local session
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-mono text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>CHOOSE HACKER CALLSIGN / USERNAME</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="e.g. zero, cyberfox, neo"
                      maxLength={30}
                      autoFocus
                      className="w-full bg-black/70 border border-cyan-500/50 px-4 py-3 text-lg font-mono font-bold text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
                    />
                    <p className="text-[11px] font-mono text-slate-400 mt-1">
                      * Must be unique within room {roomCode}.
                    </p>
                  </div>

                  {error && <ErrorMessage message={error} />}

                  <CyberButton
                    type="submit"
                    size="lg"
                    variant="green"
                    loading={submitting}
                    disabled={!username.trim()}
                    className="w-full"
                    icon={ArrowRight}
                  >
                    ACCESS GRANTED // JOIN WAITING ROOM
                  </CyberButton>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <ErrorMessage message={error || "Room not found. Please verify the room code."} />
              <CyberButton
                size="md"
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full"
              >
                RETURN TO LANDING PAGE
              </CyberButton>
            </div>
          )}
        </CyberCard>
      </div>
    </div>
  );
}
