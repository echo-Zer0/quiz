"use client";

import React from "react";
import { Trophy, Award, ShieldAlert, Zap } from "lucide-react";

export default function Leaderboard({
  leaderboard = [],
  highlightParticipantId = null,
  compact = false,
}) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="p-6 text-center border border-cyan-500/20 bg-cyan-950/10 font-mono text-sm text-slate-400">
        &gt; STANDBY: NO PARTICIPANT SCORES RECORDED YET
      </div>
    );
  }

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="flex items-center gap-1 font-bold text-amber-400 glow-yellow">
          <Trophy className="w-4 h-4 text-amber-400" /> #1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center gap-1 font-bold text-cyan-300 glow-cyan">
          <Award className="w-4 h-4 text-cyan-400" /> #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center gap-1 font-bold text-purple-400 glow-purple">
          <Award className="w-4 h-4 text-purple-400" /> #3
        </span>
      );
    }
    return <span className="text-slate-400 font-mono">#{rank}</span>;
  };

  return (
    <div className="w-full overflow-hidden border border-cyan-500/30 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-2.5 bg-cyan-950/40 border-b border-cyan-500/30">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 uppercase tracking-wider font-bold">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>LIVE LEADERBOARD</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {leaderboard.length} PARTICIPANTS
        </span>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40 uppercase tracking-wider text-[11px]">
              <th className="py-2 px-3 w-14">RANK</th>
              <th className="py-2 px-3">HACKER / USER</th>
              <th className="py-2 px-3 text-right">SCORE</th>
              {!compact && <th className="py-2 px-3 text-center">CORRECT</th>}
              {!compact && <th className="py-2 px-3 text-center">WRONG</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60">
            {leaderboard.map((entry) => {
              const isHighlighted = entry.participant_id === highlightParticipantId;
              return (
                <tr
                  key={entry.participant_id}
                  className={`transition-colors duration-150 ${
                    isHighlighted
                      ? "bg-cyan-500/20 text-cyan-200 border-l-2 border-cyan-400"
                      : "hover:bg-cyan-950/20 text-slate-300"
                  }`}
                >
                  <td className="py-2.5 px-3 font-semibold">
                    {getRankBadge(entry.rank)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`font-semibold ${isHighlighted ? "text-cyan-300 glow-cyan" : "text-white"}`}>
                      {entry.username}
                    </span>
                    {isHighlighted && (
                      <span className="ml-2 text-[10px] text-cyan-400 uppercase tracking-widest border border-cyan-500/40 px-1 py-0.2">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-cyan-400 glow-cyan">
                    {entry.score}
                  </td>
                  {!compact && (
                    <td className="py-2.5 px-3 text-center text-emerald-400">
                      {entry.correct_count}
                    </td>
                  )}
                  {!compact && (
                    <td className="py-2.5 px-3 text-center text-rose-400">
                      {entry.wrong_count}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
