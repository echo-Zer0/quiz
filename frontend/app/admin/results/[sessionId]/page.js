"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft, Users, CheckCircle2, XCircle, Clock, ChevronRight, Eye } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi } from "@/lib/api";

export default function AdminResultsDebriefPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    async function loadAdminResults() {
      setLoading(true);
      setError("");
      try {
        const res = await fetchApi(`/api/results/admin/${sessionId}`);
        setData(res);
        if (res.participants_detail?.length > 0) {
          setSelectedParticipant(res.participants_detail[0]);
        }
      } catch (err) {
        if (err.message.includes("401") || err.message.includes("token")) {
          router.push("/admin/login");
        } else {
          setError(err.message || "Failed to load session debrief.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadAdminResults();
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-cyan-400 text-sm animate-pulse">
        &gt; RETRIEVING FULL TOURNAMENT TELEMETRY FROM BACKEND...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <ErrorMessage message={error || "Results record unavailable."} />
        <Link href="/admin/dashboard">
          <CyberButton variant="outline" className="mt-4">
            RETURN TO DASHBOARD
          </CyberButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-6">
        <div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan-400 hover:text-cyan-300 mb-2 uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN TO DASHBOARD</span>
          </Link>
          <GlitchText
            text="MISSION DEBRIEF // TOURNAMENT RESULTS"
            as="h1"
            className="text-2xl sm:text-3xl font-black text-cyan-400 glow-cyan tracking-wider"
          />
          <p className="text-xs font-mono text-slate-300 mt-1">
            QUIZ: <span className="text-white font-bold">{data.quiz_title}</span> &bull; ROOM:{" "}
            <span className="text-cyan-300 font-bold tracking-widest">{data.room_code}</span> &bull; PARTICIPANTS:{" "}
            <span className="text-emerald-400 font-bold">{data.total_participants}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard">
            <CyberButton size="md" variant="purple">
              LAUNCH NEXT QUIZ
            </CyberButton>
          </Link>
        </div>
      </div>

      {/* Split View: Leaderboard Ranking & Selected Participant Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Final Leaderboard Standings */}
        <div className="lg:col-span-5 space-y-4">
          <CyberCard
            title="FINAL STANDINGS"
            badge={`${data.total_participants} PARTICIPANTS`}
            glowColor="cyan"
          >
            <div className="space-y-2">
              {data.leaderboard?.map((entry) => {
                const isSelected = selectedParticipant?.participant_id === entry.participant_id;
                const detail = data.participants_detail?.find(
                  (p) => p.participant_id === entry.participant_id
                );

                return (
                  <button
                    key={entry.participant_id}
                    onClick={() => detail && setSelectedParticipant(detail)}
                    className={`w-full text-left p-3 border font-mono text-xs transition-all flex items-center justify-between cyber-clip ${
                      isSelected
                        ? "bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                        : "bg-black/50 border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:bg-cyan-950/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 flex items-center justify-center font-bold text-xs ${
                          entry.rank === 1
                            ? "bg-amber-400 text-black"
                            : entry.rank === 2
                            ? "bg-cyan-400 text-black"
                            : entry.rank === 3
                            ? "bg-purple-400 text-black"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-white">{entry.username}</div>
                        <div className="text-[10px] text-slate-400">
                          {entry.correct_count} Correct &bull; {entry.wrong_count} Wrong
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-cyan-400 text-sm glow-cyan">
                        {entry.score} PTS
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        {detail ? `${detail.accuracy_percentage}% ACC` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CyberCard>
        </div>

        {/* Right Column: Individual Participant Telemetry Breakdown */}
        <div className="lg:col-span-7 space-y-6">
          {selectedParticipant ? (
            <CyberCard
              title={`AGENT TELEMETRY: ${selectedParticipant.username.toUpperCase()}`}
              badge={`RANK #${selectedParticipant.rank}`}
              glowColor="purple"
            >
              <div className="space-y-6">
                {/* Agent Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                  <div className="p-3 bg-black/60 border border-purple-500/30">
                    <div className="text-[10px] text-slate-400 uppercase">SCORE</div>
                    <div className="text-xl font-bold text-cyan-300 mt-1">
                      {selectedParticipant.total_score}
                    </div>
                  </div>
                  <div className="p-3 bg-black/60 border border-purple-500/30">
                    <div className="text-[10px] text-slate-400 uppercase">ACCURACY</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">
                      {selectedParticipant.accuracy_percentage}%
                    </div>
                  </div>
                  <div className="p-3 bg-black/60 border border-purple-500/30">
                    <div className="text-[10px] text-slate-400 uppercase">AVG SPEED</div>
                    <div className="text-xl font-bold text-purple-400 mt-1">
                      {(selectedParticipant.avg_response_time_ms / 1000).toFixed(2)}s
                    </div>
                  </div>
                  <div className="p-3 bg-black/60 border border-purple-500/30">
                    <div className="text-[10px] text-slate-400 uppercase">FASTEST</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {(selectedParticipant.fastest_response_time_ms / 1000).toFixed(2)}s
                    </div>
                  </div>
                </div>

                {/* Question by Question Answer Details */}
                <div className="space-y-3">
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-purple-500/20 pb-1">
                    INDIVIDUAL INCIDENT RESPONSES
                  </div>

                  {selectedParticipant.answer_history?.map((ans, idx) => (
                    <div
                      key={ans.question_id || idx}
                      className={`p-3 border font-mono text-xs space-y-1.5 ${
                        ans.is_correct
                          ? "border-emerald-500/30 bg-emerald-950/10"
                          : "border-rose-500/30 bg-rose-950/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-white">
                          #{idx + 1}. {ans.question_text}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                            ans.is_correct
                              ? "text-emerald-400 border-emerald-500/40"
                              : "text-rose-400 border-rose-500/40"
                          }`}
                        >
                          {ans.is_correct ? "CORRECT" : "WRONG"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-slate-500">GIVEN: </span>
                          <span className={ans.is_correct ? "text-emerald-300" : "text-rose-300"}>
                            {ans.selected_option_text || "Unanswered"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">KEY: </span>
                          <span className="text-emerald-400 font-bold">{ans.correct_option_text}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                        <span>POINTS: +{ans.points}</span>
                        <span>LATENCY: {ans.response_time_ms ? `${(ans.response_time_ms / 1000).toFixed(2)}s` : "N/A"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CyberCard>
          ) : (
            <div className="p-12 text-center border border-slate-800 font-mono text-sm text-slate-400">
              &gt; SELECT A PARTICIPANT FROM THE LEFT ROSTER TO VIEW INCIDENT TELEMETRY
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
