"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, CheckCircle2, Save, Send, ArrowLeft, AlertCircle } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import ErrorMessage from "@/components/ErrorMessage";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import { fetchApi } from "@/lib/api";

export default function QuizEditor({ initialQuiz = null, isEditing = false }) {
  const router = useRouter();

  const [title, setTitle] = useState(initialQuiz?.title || "");
  const [description, setDescription] = useState(initialQuiz?.description || "");
  const [questions, setQuestions] = useState(
    initialQuiz?.questions?.map((q, qIdx) => ({
      question_text: q.question_text || "",
      time_limit: q.time_limit || 20,
      question_order: qIdx + 1,
      options: q.options?.map((opt, oIdx) => ({
        option_text: opt.option_text || "",
        is_correct: Boolean(opt.is_correct),
        option_order: oIdx + 1,
      })) || [
        { option_text: "", is_correct: true, option_order: 1 },
        { option_text: "", is_correct: false, option_order: 2 },
        { option_text: "", is_correct: false, option_order: 3 },
        { option_text: "", is_correct: false, option_order: 4 },
      ],
    })) || [
      {
        question_text: "",
        time_limit: 20,
        question_order: 1,
        options: [
          { option_text: "", is_correct: true, option_order: 1 },
          { option_text: "", is_correct: false, option_order: 2 },
          { option_text: "", is_correct: false, option_order: 3 },
          { option_text: "", is_correct: false, option_order: 4 },
        ],
      },
    ]
  );

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [qrModalData, setQrModalData] = useState(null);

  // Question manipulation
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: "",
        time_limit: 20,
        question_order: prev.length + 1,
        options: [
          { option_text: "", is_correct: true, option_order: 1 },
          { option_text: "", is_correct: false, option_order: 2 },
          { option_text: "", is_correct: false, option_order: 3 },
          { option_text: "", is_correct: false, option_order: 4 },
        ],
      },
    ]);
  };

  const removeQuestion = (qIndex) => {
    if (questions.length <= 1) {
      alert("A quiz requires at least one question.");
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== qIndex));
  };

  const updateQuestionText = (qIndex, text) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex].question_text = text;
      return next;
    });
  };

  const updateTimeLimit = (qIndex, seconds) => {
    const parsed = Math.max(3, Math.min(300, parseInt(seconds) || 20));
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex].time_limit = parsed;
      return next;
    });
  };

  // Option manipulation
  const addOption = (qIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      const currentOpts = next[qIndex].options;
      if (currentOpts.length >= 8) {
        alert("Maximum 8 options per question permitted.");
        return prev;
      }
      next[qIndex].options.push({
        option_text: "",
        is_correct: false,
        option_order: currentOpts.length + 1,
      });
      return next;
    });
  };

  const removeOption = (qIndex, oIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      if (next[qIndex].options.length <= 3) {
        alert("Every question requires a minimum of 3 dynamic options.");
        return prev;
      }
      const wasCorrect = next[qIndex].options[oIndex].is_correct;
      next[qIndex].options = next[qIndex].options.filter((_, idx) => idx !== oIndex);
      // If removed was correct, set first remaining to correct
      if (wasCorrect && next[qIndex].options.length > 0) {
        next[qIndex].options[0].is_correct = true;
      }
      return next;
    });
  };

  const updateOptionText = (qIndex, oIndex, text) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex].options[oIndex].option_text = text;
      return next;
    });
  };

  const setCorrectOption = (qIndex, oIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex].options.forEach((opt, idx) => {
        opt.is_correct = idx === oIndex;
      });
      return next;
    });
  };

  // Validation
  const validateForm = () => {
    if (!title.trim() || title.trim().length < 3) {
      throw new Error("Quiz title is required (minimum 3 characters).");
    }
    if (questions.length === 0) {
      throw new Error("Add at least one question to the quiz.");
    }
    questions.forEach((q, qIdx) => {
      if (!q.question_text.trim()) {
        throw new Error(`Question #${qIdx + 1} text cannot be empty.`);
      }
      if (q.options.length < 3) {
        throw new Error(`Question #${qIdx + 1} must have at least 3 options.`);
      }
      const filledOpts = q.options.filter((o) => o.option_text.trim());
      if (filledOpts.length < q.options.length) {
        throw new Error(`Question #${qIdx + 1} has empty option choices.`);
      }
      const correctCount = q.options.filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        throw new Error(`Question #${qIdx + 1} must have exactly one correct option marked.`);
      }
    });
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setError("");
    setSaving(true);
    try {
      if (!title.trim()) {
        throw new Error("Title is required to save a draft.");
      }

      const payload = {
        title: title.trim(),
        description: description.trim(),
        questions,
      };

      if (isEditing && initialQuiz?.id) {
        await fetchApi(`/api/quizzes/${initialQuiz.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi("/api/quizzes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  // Publish Quiz
  const handlePublish = async () => {
    setError("");
    setPublishing(true);
    try {
      validateForm();

      let quizId = initialQuiz?.id;

      const payload = {
        title: title.trim(),
        description: description.trim(),
        questions,
      };

      if (isEditing && quizId) {
        await fetchApi(`/api/quizzes/${quizId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        const created = await fetchApi("/api/quizzes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        quizId = created.id;
      }

      // Publish quiz to generate session & room code
      const sessionResult = await fetchApi(`/api/quizzes/${quizId}/publish`, {
        method: "POST",
      });

      setQrModalData(sessionResult);
    } catch (err) {
      setError(err.message || "Validation or publishing failed.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/admin/dashboard")}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan-400 hover:text-cyan-300 mb-2 uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO DASHBOARD</span>
          </button>
          <GlitchText
            text={isEditing ? "EDIT CYBER QUIZ" : "CREATE NEW CYBER QUIZ"}
            as="h1"
            className="text-2xl sm:text-3xl font-black text-cyan-400 glow-cyan tracking-wider"
          />
        </div>

        <div className="flex items-center gap-3">
          <CyberButton
            variant="outline"
            size="md"
            loading={saving}
            onClick={handleSaveDraft}
            icon={Save}
          >
            SAVE DRAFT
          </CyberButton>

          <CyberButton
            variant="green"
            size="md"
            loading={publishing}
            onClick={handlePublish}
            icon={Send}
          >
            PUBLISH QUIZ
          </CyberButton>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Quiz Overview Details */}
      <CyberCard title="SECTOR METADATA" badge="CONFIG" glowColor="cyan">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-widest mb-1.5">
              QUIZ TITLE *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Network Penetration Testing & Defense"
              className="w-full bg-black/70 border border-cyan-500/40 px-4 py-2.5 font-mono text-white text-base focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-widest mb-1.5">
              DESCRIPTION / DIRECTIVE (OPTIONAL)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or instructions for participants..."
              className="w-full bg-black/70 border border-cyan-500/40 px-4 py-2.5 font-mono text-white text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </CyberCard>

      {/* Dynamic Questions Editor */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
          <h2 className="text-lg font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
            <span>QUESTIONS BUFFER ({questions.length})</span>
          </h2>

          <CyberButton size="sm" variant="cyan" onClick={addQuestion} icon={Plus}>
            ADD QUESTION
          </CyberButton>
        </div>

        {questions.map((q, qIndex) => (
          <CyberCard
            key={qIndex}
            title={`QUESTION 0${qIndex + 1}`}
            badge={`${q.options.length} OPTIONS`}
            glowColor="purple"
            headerRight={
              <button
                type="button"
                onClick={() => removeQuestion(qIndex)}
                title="Remove Question"
                className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            }
          >
            <div className="space-y-5">
              {/* Question Text & Time Limit */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    QUESTION PROMPT *
                  </label>
                  <input
                    type="text"
                    value={q.question_text}
                    onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                    placeholder="e.g. Which Wi-Fi security protocol replaced WEP in 2003?"
                    className="w-full bg-black/70 border border-purple-500/40 px-4 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>TIME LIMIT (SEC)</span>
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={q.time_limit}
                    onChange={(e) => updateTimeLimit(qIndex, e.target.value)}
                    className="w-full bg-black/70 border border-purple-500/40 px-3 py-2 text-sm font-mono text-white text-center focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Dynamic Options List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  <span>SELECT THE ONE CORRECT ANSWER RADIO:</span>
                  <span>MINIMUM 3 OPTIONS REQUIRED</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {q.options.map((opt, oIndex) => {
                    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
                    const letter = letters[oIndex] || `${oIndex + 1}`;
                    return (
                      <div
                        key={oIndex}
                        className={`flex items-center gap-2 p-2 border transition-colors ${
                          opt.is_correct
                            ? "border-emerald-500/60 bg-emerald-950/20"
                            : "border-slate-800 bg-black/50"
                        }`}
                      >
                        {/* Radio select correct answer */}
                        <button
                          type="button"
                          onClick={() => setCorrectOption(qIndex, oIndex)}
                          className={`w-7 h-7 shrink-0 flex items-center justify-center font-bold text-xs font-mono border transition-colors ${
                            opt.is_correct
                              ? "bg-emerald-400 text-black border-emerald-300"
                              : "bg-slate-900 text-slate-400 border-slate-700 hover:border-cyan-400"
                          }`}
                          title="Set as correct answer"
                        >
                          {letter}
                        </button>

                        <input
                          type="text"
                          value={opt.option_text}
                          onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                          placeholder={`Option ${letter} text...`}
                          className="flex-1 bg-transparent px-3 py-1 font-mono text-sm text-white placeholder-slate-600 focus:outline-none"
                        />

                        {opt.is_correct && (
                          <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/40">
                            CORRECT
                          </span>
                        )}

                        {q.options.length > 3 && (
                          <button
                            type="button"
                            onClick={() => removeOption(qIndex, oIndex)}
                            title="Remove this option"
                            className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Option button (supports dynamic 3, 4, 5, 6+ options!) */}
                {q.options.length < 8 && (
                  <button
                    type="button"
                    onClick={() => addOption(qIndex)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 uppercase tracking-wider pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ ADD DYNAMIC OPTION ({q.options.length + 1})</span>
                  </button>
                )}
              </div>
            </div>
          </CyberCard>
        ))}

        <div className="flex justify-center pt-4">
          <CyberButton size="md" variant="cyan" onClick={addQuestion} icon={Plus}>
            ADD ANOTHER QUESTION
          </CyberButton>
        </div>
      </div>

      {/* QR Code Modal after publishing */}
      {qrModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md space-y-4">
            <QRCodeDisplay
              url={qrModalData.join_url}
              roomCode={qrModalData.room_code}
              size={240}
            />

            <CyberButton
              size="lg"
              variant="green"
              className="w-full"
              onClick={() => router.push(`/admin/session/${qrModalData.session_id}`)}
              icon={Send}
            >
              LAUNCH SESSION CONTROL ARENA
            </CyberButton>
          </div>
        </div>
      )}
    </div>
  );
}
