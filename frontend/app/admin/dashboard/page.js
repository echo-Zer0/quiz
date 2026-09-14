"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Edit, Trash2, Send, Play, BarChart2, QrCode, X, Check, Copy } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi } from "@/lib/api";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [publishingId, setPublishingId] = useState(null);

  // QR Modal state
  const [activeQrData, setActiveQrData] = useState(null);

  const loadQuizzes = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchApi("/api/quizzes");
      setQuizzes(data);
    } catch (err) {
      if (err.message.includes("401") || err.message.includes("token")) {
        router.push("/admin/login");
      } else {
        setError(err.message || "Failed to load quizzes.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleDelete = async (quizId) => {
    if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) {
      return;
    }

    try {
      await fetchApi(`/api/quizzes/${quizId}`, { method: "DELETE" });
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handlePublish = async (quizId) => {
    setPublishingId(quizId);
    try {
      const result = await fetchApi(`/api/quizzes/${quizId}/publish`, { method: "POST" });
      setActiveQrData(result);
      await loadQuizzes();
    } catch (err) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const filteredQuizzes = quizzes.filter((q) => {
    if (activeTab === "all") return true;
    return q.status === activeTab;
  });

  const getStatusBadge = (status) => {
    const badges = {
      draft: "text-amber-400 border-amber-500/40 bg-amber-950/30",
      published: "text-cyan-400 border-cyan-500/40 bg-cyan-950/30",
      running: "text-emerald-400 border-emerald-500/40 bg-emerald-950/30 animate-pulse",
      ended: "text-slate-400 border-slate-700 bg-slate-900/40",
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest border ${badges[status] || ""}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-8 w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-6">
        <div>
          <GlitchText
            text="CYBER QUIZ CONTROL PANEL"
            as="h1"
            className="text-2xl sm:text-3xl font-black text-cyan-400 glow-cyan tracking-wider"
          />
          <p className="text-xs font-mono text-slate-400 mt-1">
            Authoritative session management &bull; Quiz designer &bull; Real-time tournament monitor
          </p>
        </div>

        <Link href="/admin/quiz/new">
          <CyberButton variant="green" size="md" icon={Plus}>
            CREATE NEW QUIZ
          </CyberButton>
        </Link>
      </div>

      {/* Tabs Filter */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: "all", label: "ALL QUIZZES" },
          { id: "draft", label: "DRAFTS" },
          { id: "published", label: "PUBLISHED" },
          { id: "running", label: "RUNNING" },
          { id: "ended", label: "COMPLETED" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors cyber-clip ${
              activeTab === tab.id
                ? "bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-bold glow-cyan"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
            }`}
          >
            {tab.label} ({quizzes.filter((q) => (tab.id === "all" ? true : q.status === tab.id)).length})
          </button>
        ))}
      </div>

      {error && <ErrorMessage message={error} onRetry={loadQuizzes} />}

      {/* Quizzes List */}
      {loading ? (
        <div className="py-16 text-center font-mono text-cyan-400 text-sm animate-pulse">
          &gt; QUERYING AUTHORITATIVE DATABASE CLUSTER...
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="p-12 text-center border border-cyan-500/20 bg-black/40 space-y-4">
          <p className="font-mono text-sm text-slate-400">
            &gt; NO QUIZZES FOUND UNDER STATUS: [{activeTab.toUpperCase()}]
          </p>
          <Link href="/admin/quiz/new">
            <CyberButton variant="cyan" size="sm" icon={Plus}>
              INITIALIZE YOUR FIRST QUIZ
            </CyberButton>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => (
            <CyberCard
              key={quiz.id}
              title={quiz.title}
              badge={`${quiz.question_count} QUESTIONS`}
              glowColor={quiz.status === "running" ? "green" : quiz.status === "published" ? "cyan" : "purple"}
              headerRight={getStatusBadge(quiz.status)}
              className="flex flex-col justify-between"
            >
              <div className="space-y-4">
                <p className="text-xs font-mono text-slate-300 line-clamp-2 min-h-[32px]">
                  {quiz.description || "No sector description provided."}
                </p>

                <div className="text-[10px] font-mono text-slate-400 space-y-0.5 border-t border-slate-900 pt-2">
                  <div>CREATED: {new Date(quiz.created_at).toLocaleDateString()}</div>
                  {quiz.published_at && (
                    <div>PUBLISHED: {new Date(quiz.published_at).toLocaleDateString()}</div>
                  )}
                </div>

                {/* Actions Grid */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-cyan-500/20">
                  {/* Edit action */}
                  {quiz.status === "draft" && (
                    <Link href={`/admin/quiz/${quiz.id}/edit`}>
                      <CyberButton size="sm" variant="outline" icon={Edit}>
                        EDIT
                      </CyberButton>
                    </Link>
                  )}

                  {/* Publish action */}
                  {quiz.status === "draft" && (
                    <CyberButton
                      size="sm"
                      variant="cyan"
                      loading={publishingId === quiz.id}
                      onClick={() => handlePublish(quiz.id)}
                      icon={Send}
                    >
                      PUBLISH
                    </CyberButton>
                  )}

                  {/* Control Session (if published or running) */}
                  {(quiz.status === "published" || quiz.status === "running") && (
                    <CyberButton
                      size="sm"
                      variant="green"
                      onClick={async () => {
                        // Find active session for quiz
                        try {
                          const res = await fetchApi(`/api/quizzes/${quiz.id}/publish`, { method: "POST" });
                          router.push(`/admin/session/${res.session_id}`);
                        } catch (err) {
                          alert(`Unable to access session: ${err.message}`);
                        }
                      }}
                      icon={Play}
                    >
                      SESSION CONTROL
                    </CyberButton>
                  )}

                  {/* Delete action */}
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    title="Delete Quiz"
                    className="p-2 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/60 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CyberCard>
          ))}
        </div>
      )}

      {/* Published QR Modal Display */}
      {activeQrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setActiveQrData(null)}
              className="absolute -top-3 -right-3 z-10 p-2 bg-black border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <QRCodeDisplay
              url={activeQrData.join_url}
              roomCode={activeQrData.room_code}
              size={240}
            />

            <div className="mt-4 flex gap-3">
              <CyberButton
                size="md"
                variant="green"
                className="w-full"
                onClick={() => router.push(`/admin/session/${activeQrData.session_id}`)}
                icon={Play}
              >
                OPEN SESSION CONTROL ARENA
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
