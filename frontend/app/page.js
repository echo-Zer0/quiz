"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Terminal, QrCode, ArrowRight, Sparkles, Cpu, Lock, CheckCircle2 } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import TerminalText from "@/components/TerminalText";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleanCode) {
      setError("Please enter a valid room code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate room code against backend
      const session = await fetchApi(`/api/sessions/code/${cleanCode}`);
      if (session.status === "ended") {
        setError("This quiz session has already concluded.");
        return;
      }
      // Redirect to participant join form for this verified room
      router.push(`/join/${cleanCode}`);
    } catch (err) {
      setError(err.message || "Invalid or inactive room code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Cyber HUD Accents */}
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl mx-auto space-y-10 relative z-10">
        {/* Hero Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/60 border border-cyan-400/30 text-cyan-400 font-mono text-xs tracking-widest uppercase">
            <Terminal className="w-3.5 h-3.5 animate-pulse" />
            <span>Ruet Cyber Security Club Presents</span>
          </div>

          <GlitchText
            text="RCSC Cyber Quiz Arena"
            as="h1"
            className="text-4xl sm:text-6xl md:text-7xl font-black text-cyan-400 glow-cyan tracking-wider"
          />
        </div>

        {/* Major Actions Grid: JOIN QUIZ & CREATE QUIZ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Action 1: JOIN QUIZ (Manual Room Code + QR) */}
          <CyberCard
            title="PARTICIPANT ACCESS"
            badge="JOIN QUIZ"
            glowColor="cyan"
            className="flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-wider">
                <Lock className="w-4 h-4" />
                <span>ENTER PROTOCOL ROOM CODE</span>
              </div>

              <form onSubmit={handleJoin} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase());
                      if (error) setError("");
                    }}
                    placeholder="E.G. A7X9Q2"
                    maxLength={10}
                    className="w-full bg-black/70 border border-cyan-500/40 px-4 py-3 text-center text-xl md:text-2xl font-mono font-bold tracking-[0.25em] text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all uppercase"
                  />
                </div>

                {error && <ErrorMessage message={error} />}

                <CyberButton
                  type="submit"
                  size="md"
                  variant="cyan"
                  loading={loading}
                  className="w-full"
                  icon={ArrowRight}
                >
                  JOIN ROOM
                </CyberButton>
              </form>

              {/* QR Code Alternative Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-cyan-500/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase font-mono">
                  <span className="bg-[#0b1120] px-3 text-slate-400">OR SCAN QR CODE</span>
                </div>
              </div>

              <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 flex items-center gap-3">
                <div className="p-2 bg-cyan-950 border border-cyan-400/40 shrink-0">
                  <QrCode className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-xs font-mono text-slate-400">
                  Scan the room QR code shown on the event screen with your phone camera to join instantly.
                </p>
              </div>
            </div>
          </CyberCard>

          {/* Action 2: CREATE QUIZ (Admin / Creator Portal) */}
          <CyberCard
            title="GAME MASTER PORTAL"
            badge="CREATOR"
            glowColor="purple"
            className="flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-400 font-mono text-xs tracking-wider">
                <Cpu className="w-4 h-4" />
                <span>QUIZ ARCHITECT & MASTER CONTROLS</span>
              </div>



              <div className="p-3 bg-purple-950/20 border border-purple-500/20 space-y-2 font-mono text-xs text-slate-400">
                <div className="flex items-center gap-2 text-purple-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Secure Session & Identity Validation</span>
                </div>

                <div className="flex items-center gap-2 text-purple-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Real-Time Suspicious Activity Detection</span>
                </div>

                <div className="flex items-center gap-2 text-purple-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Protected API & WebSocket Communication</span>
                </div>
              </div>

              <Link href="/admin/login" className="block pt-2">
                <CyberButton size="md" variant="purple" className="w-full" icon={Cpu}>
                  CREATE QUIZ / ADMIN
                </CyberButton>
              </Link>
            </div>
          </CyberCard>
        </div>

        {/* Terminal Boot Sequence Logs */}
        <div className="max-w-2xl mx-auto border border-cyan-500/30 bg-black/70 p-4">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest border-b border-cyan-500/20 pb-1 mb-2">
            SYSTEM DIAGNOSTICS & TELEMETRY
          </div>
          <TerminalText
            lines={[
              "INITIALIZING CYBER QUIZ PROTOCOL v1.0.0...",
              "NETWORK INTERFACE: ACTIVE // AUTHORITATIVE ENGINE LOADED",
              "CRYPTOGRAPHIC SEED GENERATOR: READY",
              "AWAITING PARTICIPANT SESSIONS...",
            ]}
            speed={25}
          />
        </div>
      </div>
    </div>
  );
}
