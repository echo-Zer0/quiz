"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Trophy, Target, Zap, Clock, CheckCircle2, XCircle, AlertCircle, Home, ArrowLeft, Lock, Shield } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi, getWsBaseUrl } from "@/lib/api";

export default function ParticipantResultsPage() {
  const params = useParams();
  const router = useRouter();
  const participantId = params.participantId;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadResult = async () => {
    try {
      const data = await fetchApi(`/api/participants/${participantId}/result`);
      setResult(data);

      // Fire celebratory cyber confetti if score > 0 and not frozen
      if (!data.is_frozen && data.total_score > 0) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#00f0ff", "#00ff66", "#9d00ff", "#ffffff"],
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load results summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!participantId) return;
    setLoading(true);
    setError("");
    loadResult();
  }, [participantId]);

  // Polling when frozen to detect when admin ends the quiz
  useEffect(() => {
    if (!result?.is_frozen) return;
    const interval = setInterval(async () => {
      try {
        const data = await fetchApi(`/api/participants/${participantId}/result`);
        if (!data.is_frozen) {
          setResult(data);
          if (data.total_score > 0) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ["#00f0ff", "#00ff66", "#9d00ff", "#ffffff"],
            });
          }
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [result?.is_frozen, participantId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-cyan-400 text-sm animate-pulse">
        &gt; CALCULATING FINAL SCORES & COMPILATION TELEMETRY...
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <ErrorMessage message={error || "Result record unavailable."} />
        <Link href="/">
          <CyberButton variant="outline" className="mt-4">
            RETURN TO LANDING PAGE
          </CyberButton>
        </Link>
      </div>
    );
  }

  if (result.is_frozen) {
    return (
      <div className="flex-1 max-w-2xl mx-auto px-4 py-12 space-y-6 w-full flex flex-col justify-center items-center">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-950/60 border border-amber-500/40 text-amber-400 font-mono text-xs tracking-widest uppercase">
            <Lock className="w-3.5 h-3.5 animate-pulse" />
            <span>SUBMISSION LOCKED // ARENA FROZEN</span>
          </div>

          <GlitchText
            text="RESPONSES ENCRYPTED & SAVED"
            as="h2"
            className="text-2xl sm:text-4xl font-black text-cyan-400 glow-cyan tracking-wider"
          />

          <p className="text-xs font-mono text-slate-300">
            Agent: <span className="text-cyan-300 font-bold glow-cyan">{result.username}</span> &bull; Target:{" "}
            <span className="text-white font-bold">{result.quiz_title}</span>
          </p>
        </div>

        <CyberCard
          title="TOURNAMENT PROTOCOL: STANDBY"
          badge="AWAITING GAME MASTER"
          glowColor="purple"
          className="space-y-6 w-full"
        >
          <div className="p-4 bg-purple-950/20 border border-purple-500/30 font-mono text-xs space-y-3">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
              <Shield className="w-5 h-5 text-purple-400 animate-pulse" />
              <span>SCORES TEMPORARILY FROZEN</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Your responses have been authoritatively recorded on the server. To maintain tournament integrity among active competitors, the live scoreboard and answer keys are locked.
            </p>
            <div className="p-3 bg-black/60 border border-purple-500/20 text-cyan-300 space-y-1">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">&gt; SYSTEM STATUS</div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>STANDBY: AWAITING GAME MASTER TO END THE QUIZ</span>
              </div>
              <div className="text-[11px] text-slate-400">
                This screen will automatically unlock and reveal your score, rank, and mission debrief the instant the game master ends the tournament.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-black/60 border border-cyan-500/20 font-mono text-xs">
            <div>
              <div className="text-slate-400 uppercase text-[10px]">CALLSIGN</div>
              <div className="text-cyan-300 font-bold truncate">{result.username}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase text-[10px]">STATUS</div>
              <div className="text-amber-400 font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>LOCKED IN</span>
              </div>
            </div>
          </div>
        </CyberCard>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto px-4 py-10 space-y-8 w-full">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/60 border border-cyan-400/40 text-cyan-400 font-mono text-xs tracking-widest uppercase">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>MISSION DEBRIEF // FINAL RESULTS</span>
        </div>

        <GlitchText
          text="QUIZ COMPLETE"
          as="h1"
          className="text-3xl sm:text-5xl font-black text-cyan-400 glow-cyan tracking-wider"
        />

        <p className="text-xs sm:text-sm font-mono text-slate-300">
          Agent: <span className="text-cyan-300 font-bold">{result.username}</span> &bull; Target:{" "}
          <span className="text-white font-bold">{result.quiz_title}</span>
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* Score */}
        <CyberCard glowColor="cyan" className="p-3 text-center col-span-2 sm:col-span-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase">FINAL SCORE</div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-400 glow-cyan my-1">
            {result.total_score}
          </div>
          <div className="text-[10px] font-mono text-slate-400">POINTS</div>
        </CyberCard>

        {/* Rank */}
        <CyberCard glowColor="purple" className="p-3 text-center col-span-2 sm:col-span-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase">RANKING</div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-purple-400 glow-purple my-1">
            #{result.rank}
          </div>
          <div className="text-[10px] font-mono text-slate-400">OF {result.total_participants}</div>
        </CyberCard>

        {/* Accuracy */}
        <CyberCard glowColor="green" className="p-3 text-center">
          <div className="text-[10px] font-mono text-slate-400 uppercase">ACCURACY</div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 glow-green my-1">
            {result.accuracy_percentage}%
          </div>
          <div className="text-[10px] font-mono text-slate-400">HIT RATE</div>
        </CyberCard>

        {/* Correct */}
        <CyberCard glowColor="green" className="p-3 text-center">
          <div className="text-[10px] font-mono text-slate-400 uppercase">CORRECT</div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 my-1">
            {result.correct_count}
          </div>
          <div className="text-[10px] font-mono text-slate-400">ANSWERS</div>
        </CyberCard>

        {/* Wrong */}
        <CyberCard glowColor="red" className="p-3 text-center">
          <div className="text-[10px] font-mono text-slate-400 uppercase">WRONG</div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-rose-400 my-1">
            {result.wrong_count}
          </div>
          <div className="text-[10px] font-mono text-slate-400">FAILED</div>
        </CyberCard>

        {/* Avg Response Time */}
        <CyberCard glowColor="cyan" className="p-3 text-center">
          <div className="text-[10px] font-mono text-slate-400 uppercase">AVG SPEED</div>
          <div className="text-xl sm:text-2xl font-mono font-black text-cyan-300 my-1">
            {(result.avg_response_time_ms / 1000).toFixed(2)}s
          </div>
          <div className="text-[10px] font-mono text-slate-400">LATENCY</div>
        </CyberCard>
      </div>

      {/* Detailed Answer History */}
      <CyberCard
        title="DETAILED INCIDENT & ANSWER TELEMETRY"
        badge={`${result.answer_history?.length || 0} CHALLENGES`}
        glowColor="cyan"
      >
        <div className="space-y-4">
          <p className="text-xs font-mono text-slate-400">
            &gt; Correct answers are verified and decrypted exclusively after the quiz session terminates.
          </p>

          <div className="space-y-3">
            {result.answer_history?.map((item, idx) => (
              <div
                key={item.question_id || idx}
                className={`p-4 border font-mono text-xs space-y-2 transition-colors ${
                  item.is_correct
                    ? "border-emerald-500/30 bg-emerald-950/20"
                    : "border-rose-500/30 bg-rose-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="text-slate-500">#{idx + 1}</span>
                    <span>{item.question_text}</span>
                  </div>

                  <span
                    className={`px-2 py-0.5 uppercase tracking-widest font-bold text-[10px] border ${
                      item.is_correct
                        ? "text-emerald-400 border-emerald-500/50 bg-emerald-950/40"
                        : "text-rose-400 border-rose-500/50 bg-rose-950/40"
                    }`}
                  >
                    {item.is_correct ? "CORRECT" : "WRONG"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-500">YOUR ANSWER: </span>
                    <span className={item.is_correct ? "text-emerald-300 font-semibold" : "text-rose-300 font-semibold"}>
                      {item.selected_option_text || "Unanswered"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500">CORRECT ANSWER: </span>
                    <span className="text-emerald-400 font-bold">
                      {item.correct_option_text}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
                  <span>POINTS EARNED: +{item.points}</span>
                  <span>RESPONSE TIME: {item.response_time_ms ? `${(item.response_time_ms / 1000).toFixed(2)}s` : "Timeout"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CyberCard>

      {/* Return Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/">
          <CyberButton size="md" variant="cyan" icon={Zap}>
            JOIN NEXT QUIZ
          </CyberButton>
        </Link>
        <Link href="/">
          <CyberButton size="md" variant="outline" icon={Home}>
            BACK TO ARENA HOME
          </CyberButton>
        </Link>
      </div>
    </div>
  );
}
