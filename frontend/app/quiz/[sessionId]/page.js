"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Shield,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Trophy,
  FastForward,
  Lock,
  Clock,
  Check,
  Flag
} from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import CountdownTimer from "@/components/CountdownTimer";
import OptionButton from "@/components/OptionButton";
import Leaderboard from "@/components/Leaderboard";
import AntiCheatOverlay from "@/components/AntiCheatOverlay";
import GlitchText from "@/components/GlitchText";
import { getWsBaseUrl, fetchApi } from "@/lib/api";
import { getParticipantCookie, saveParticipantCookie } from "@/lib/cookies";

export default function ActiveQuizPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [participantId, setParticipantId] = useState("");
  const [username, setUsername] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(1);
  const [savedAnswers, setSavedAnswers] = useState({}); // question_id -> option_id
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [saveToast, setSaveToast] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [confirmFinishModal, setConfirmFinishModal] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);

  // Global total timer state
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [totalTimeLimit, setTotalTimeLimit] = useState(600); // 10 mins default

  const wsRef = useRef(null);

  // Load question by index
  const loadQuestionByIndex = async (index, pId) => {
    try {
      const activePid = pId || participantId;
      if (!activePid) return;
      const data = await fetchApi(`/api/participants/${activePid}/question/${index}`);
      setCurrentQuestion(data);
      setCurrentIndex(index);
      setTotalQuestions(data.total_questions || totalQuestions);

      // If already answered, sync savedAnswers map
      if (data.already_answered && data.selected_option_id) {
        setSavedAnswers((prev) => ({
          ...prev,
          [data.question_id]: data.selected_option_id,
        }));
      }
    } catch (err) {
      console.error("Error loading question:", err);
    }
  };

  // Sync overview of which questions are answered
  const loadQuestionsOverview = async (pId) => {
    try {
      const activePid = pId || participantId;
      if (!activePid || !sessionId) return;
      const list = await fetchApi(`/api/sessions/${sessionId}/questions-overview/${activePid}`);
      const map = {};
      if (Array.isArray(list)) {
        list.forEach((item) => {
          if (item.selected_option_id) {
            map[item.question_id] = item.selected_option_id;
          }
        });
      }
      setSavedAnswers((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.error("Overview error:", e);
    }
  };

  useEffect(() => {
    let pId = typeof window !== "undefined" ? sessionStorage.getItem("cyber_participant_id") : null;
    let uName = typeof window !== "undefined" ? sessionStorage.getItem("cyber_username") : null;

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

      // Check persistent cookies if session storage is blank (e.g. fresh tab or browser restart)
      const cookieData = getParticipantCookie(sessionId);
      if ((!pId || !uName) && cookieData) {
        pId = pId || cookieData.participant_id;
        uName = uName || cookieData.username;
        sessionStorage.setItem("cyber_participant_id", pId);
        sessionStorage.setItem("cyber_username", uName);
      }

      // Keep cookie fresh and active
      if (pId && uName) {
        saveParticipantCookie(sessionId, {
          participant_id: pId,
          username: uName,
          session_id: sessionId,
        });
      }
    }

    if (!pId || !sessionId) {
      router.push("/");
      return;
    }

    setParticipantId(pId);
    setUsername(uName || "Hacker");

    if (typeof window !== "undefined") {
      if (sessionStorage.getItem(`cyber_frozen_${sessionId}`) === "true") {
        setIsFrozen(true);
      }
    }

    // Fetch initial session timing and status
    fetchApi(`/api/sessions/id/${sessionId}`)
      .then((sess) => {
        if (sess.status === "ended") {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(`cyber_frozen_${sessionId}`);
          }
          router.push(`/results/${pId}?pid=${pId}&u=${encodeURIComponent(uName || "Hacker")}`);
          return;
        }
        if (sess.started_at) {
          setSessionStartedAt(sess.started_at);
        }
        if (sess.total_time_limit) {
          setTotalTimeLimit(sess.total_time_limit);
        }
        if (sess.total_questions) {
          setTotalQuestions(sess.total_questions);
        }
      })
      .catch((e) => console.error("Session fetch error:", e));

    // Load initial question and answered overview
    loadQuestionByIndex(0, pId);
    loadQuestionsOverview(pId);

    // Establish WebSocket connection
    function connectWs() {
      const wsUrl = `${getWsBaseUrl()}/ws/participant/${sessionId}/${pId}?username=${encodeURIComponent(uName || "Hacker")}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setReconnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "quiz_started") {
            if (msg.data.started_at) setSessionStartedAt(msg.data.started_at);
            if (msg.data.total_time_limit) setTotalTimeLimit(msg.data.total_time_limit);
            if (msg.data.question) {
              setCurrentQuestion(msg.data.question);
            }
          } else if (msg.event === "question_started") {
            setCurrentQuestion(msg.data);
            if (msg.data.already_answered && msg.data.selected_option_id) {
              setSavedAnswers((prev) => ({
                ...prev,
                [msg.data.question_id]: msg.data.selected_option_id,
              }));
            }
          } else if (msg.event === "answer_result") {
            // Confirmation that selection is stored safely
            setSavingAnswer(false);
            setSaveToast("SELECTION RECORDED IN SECURE BUFFER");
            setTimeout(() => setSaveToast(""), 2500);
          } else if (msg.event === "leaderboard_updated") {
            setLeaderboard(msg.data.leaderboard || []);
          } else if (msg.event === "admin_advance_question") {
            // Admin triggered room-wide advancement to next question
            setCurrentIndex((prev) => {
              const nextIdx = prev + 1;
              loadQuestionByIndex(nextIdx, pId);
              return nextIdx;
            });
          } else if (msg.event === "quiz_ended") {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(`cyber_frozen_${sessionId}`);
            }
            router.push(`/results/${pId}?pid=${pId}&u=${encodeURIComponent(uName || "Hacker")}`);
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setReconnecting(true);
        setTimeout(connectWs, 2000);
      };
    }

    connectWs();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [sessionId, router]);

  // Handle selecting or changing an option (traversal allowed)
  const handleSelectOption = (optionId) => {
    if (timeExpired || !currentQuestion) return;

    // Update local state immediately for instant feedback
    setSavedAnswers((prev) => ({
      ...prev,
      [currentQuestion.question_id]: optionId,
    }));
    setSavingAnswer(true);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: "submit_answer",
          data: {
            question_id: currentQuestion.question_id,
            selected_option_id: optionId,
          },
        })
      );
    } else {
      fetchApi(`/api/participants/${participantId}/answer`, {
        method: "POST",
        body: JSON.stringify({
          question_id: currentQuestion.question_id,
          selected_option_id: optionId,
        }),
      })
        .then(() => {
          setSavingAnswer(false);
          setSaveToast("SELECTION RECORDED");
          setTimeout(() => setSaveToast(""), 2500);
        })
        .catch((err) => {
          setSavingAnswer(false);
          alert(err.message);
        });
    }
  };

  // Traversal: Previous question
  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      loadQuestionByIndex(prevIdx);
    }
  };

  // Traversal: Next question
  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      const nextIdx = currentIndex + 1;
      loadQuestionByIndex(nextIdx);
    } else {
      // Last question: prompt review/finish
      setConfirmFinishModal(true);
    }
  };

  // Jump to arbitrary question index
  const handleJumpToQuestion = (index) => {
    loadQuestionByIndex(index);
  };

  // Polling fallback when frozen to immediately detect admin ending quiz
  useEffect(() => {
    if (!isFrozen || !sessionId || !participantId) return;
    const interval = setInterval(async () => {
      try {
        const sess = await fetchApi(`/api/sessions/id/${sessionId}`);
        if (sess.status === "ended") {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem(`cyber_frozen_${sessionId}`);
          }
          router.push(`/results/${participantId}?pid=${participantId}&u=${encodeURIComponent(username || "Hacker")}`);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [isFrozen, sessionId, participantId, username, router]);

  // Global Timer Expiration: Freeze arena, do NOT reveal scores until admin ends quiz
  const handleGlobalTimerExpire = () => {
    setTimeExpired(true);
    setIsFrozen(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`cyber_frozen_${sessionId}`, "true");
    }
  };

  // Finish and Submit Early: Freeze arena, do NOT reveal scores until admin ends quiz
  const handleFinishQuiz = () => {
    setConfirmFinishModal(false);
    setIsFrozen(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`cyber_frozen_${sessionId}`, "true");
    }
  };

  const currentSelectedOptionId = currentQuestion ? savedAnswers[currentQuestion.question_id] : null;

  if (isFrozen) {
    const answeredCount = Object.keys(savedAnswers).length;
    return (
      <div
        className="flex-1 flex flex-col justify-center items-center px-4 py-12 max-w-2xl mx-auto w-full space-y-6 quiz-no-copy select-none"
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onSelectStart={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
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
            Agent: <span className="text-cyan-300 font-bold glow-cyan">{username}</span>
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
              Your responses have been authoritatively recorded on the server. To maintain tournament integrity among active competitors, the scoreboard, answer keys, and point breakdowns remain locked.
            </p>
            <div className="p-3 bg-black/60 border border-purple-500/20 text-cyan-300 space-y-1">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">&gt; SYSTEM STATUS</div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>STANDBY: AWAITING GAME MASTER TO END THE QUIZ</span>
              </div>
              <div className="text-[11px] text-slate-400">
                The scoreboard will automatically unlock and reveal your rank, score, and complete challenge debrief the instant the game master ends the tournament.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-black/60 border border-cyan-500/20 font-mono text-xs">
            <div>
              <div className="text-slate-400 uppercase text-[10px]">CALLSIGN</div>
              <div className="text-cyan-300 font-bold truncate">{username}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase text-[10px]">CHALLENGES COMPLETED</div>
              <div className="text-emerald-400 font-bold">
                {answeredCount} / {totalQuestions} SECTORS
              </div>
            </div>
          </div>

          <div className="p-3 bg-black/40 border border-cyan-500/20 text-center font-mono text-[11px] text-slate-400">
            &gt; Do not close this window. Your connection to the Game Master engine is live.
          </div>
        </CyberCard>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col justify-between items-center px-4 py-6 max-w-5xl mx-auto w-full relative quiz-no-copy select-none"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onSelectStart={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <AntiCheatOverlay active={true} />

      {/* Reconnection Banner */}
      {reconnecting && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-rose-950/90 border-b border-rose-500 text-rose-300 py-1.5 text-center font-mono text-xs animate-pulse">
          &gt; CONNECTION LOST. RECONNECTING TO GAME SERVER AUTHORITATIVE ENGINE...
        </div>
      )}

      {/* Time Expired Overlay */}
      {timeExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="p-8 border-2 border-rose-500 bg-[#0b1120] text-center font-mono space-y-4 shadow-[0_0_30px_rgba(255,0,85,0.8)]">
            <Clock className="w-12 h-12 text-rose-400 mx-auto animate-spin" />
            <h2 className="text-2xl font-black text-rose-400 glow-red uppercase tracking-wider">
              GLOBAL TIME LIMIT TERMINATED
            </h2>
            <p className="text-xs text-slate-300">
              Submissions are now closed. Compiling final rankings and revealing answer keys...
            </p>
          </div>
        </div>
      )}

      {/* Top HUD: Agent Info, Global Total Timer, and Leaderboard Toggle */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-cyan-950/60 border border-cyan-500/40 font-mono text-xs text-cyan-300">
            AGENT: <span className="font-bold text-white">{username}</span>
          </div>
          <div className="font-mono text-xs text-slate-400">
            SECTOR <span className="text-cyan-400 font-bold">{currentIndex + 1}</span> OF{" "}
            <span className="text-cyan-400 font-bold">{totalQuestions}</span>
          </div>
        </div>

        {/* PROMINENT GLOBAL COUNTDOWN TIMER */}
        <div>
          <CountdownTimer
            key={`global-${sessionStartedAt || 'local'}`}
            timeLimit={totalTimeLimit}
            serverStartedAt={sessionStartedAt}
            onExpire={handleGlobalTimerExpire}
            label="GLOBAL BATTLE ARENA TIMER"
          />
        </div>

        <div className="flex items-center gap-2">
          <CyberButton
            size="sm"
            variant="outline"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            icon={Trophy}
          >
            {showLeaderboard ? "HIDE RANKS" : "LEADERBOARD"}
          </CyberButton>

          <CyberButton
            size="sm"
            variant="red"
            onClick={() => setConfirmFinishModal(true)}
            icon={Flag}
          >
            FINISH
          </CyberButton>
        </div>
      </div>

      {/* Live Leaderboard Dropdown */}
      {showLeaderboard && (
        <div className="w-full mb-4 animate-fadeIn">
          <Leaderboard
            leaderboard={leaderboard}
            highlightParticipantId={participantId}
            compact={true}
          />
        </div>
      )}

      {/* QUESTION NAVIGATOR (Sector selector pills for free traversal) */}
      <div className="w-full mb-5 overflow-x-auto pb-2">
        <div className="flex items-center justify-center gap-2 min-w-max mx-auto">
          {Array.from({ length: totalQuestions }).map((_, idx) => {
            const isCurrent = idx === currentIndex;
            // Check if this question has a recorded answer
            const isAnswered = currentQuestion?.total_questions
              ? Boolean(Object.values(savedAnswers)[idx]) || (idx === currentIndex && Boolean(currentSelectedOptionId))
              : false;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleJumpToQuestion(idx)}
                className={`w-9 h-9 font-mono text-xs font-bold transition-all cyber-clip flex items-center justify-center relative ${
                  isCurrent
                    ? "bg-cyan-400 text-black border-2 border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.8)] scale-110"
                    : isAnswered
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/60 hover:bg-emerald-900/40"
                    : "bg-black/60 text-slate-400 border border-slate-800 hover:border-cyan-500/50 hover:text-white"
                }`}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
                {isAnswered && !isCurrent && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card */}
      {currentQuestion ? (
        <div className="w-full space-y-6 my-auto">
          <CyberCard
            title={`SECTOR ${currentIndex + 1} // CHALLENGE`}
            badge={currentSelectedOptionId ? "SELECTION SAVED" : "AWAITING CHOICE"}
            glowColor={currentSelectedOptionId ? "green" : "cyan"}
            headerRight={
              <div className="font-mono text-xs text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>SERVER-AUTHORITATIVE LOCK</span>
              </div>
            }
          >
            {/* Question Text */}
            <div className="p-5 bg-black/70 border border-cyan-500/30 text-base sm:text-lg md:text-xl font-mono text-white font-semibold leading-relaxed mb-6">
              {currentQuestion.question_text}
            </div>

            {/* Dynamic Options List */}
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = currentSelectedOptionId === opt.id;
                return (
                  <OptionButton
                    key={opt.id}
                    index={idx}
                    optionText={opt.option_text}
                    selected={isSelected}
                    disabled={timeExpired}
                    onClick={() => handleSelectOption(opt.id)}
                  />
                );
              })}
            </div>

            {/* Discreet Selection Status Banner (WITHOUT exposing correct/wrong!) */}
            <div className="mt-5 flex items-center justify-between p-3 bg-black/50 border border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2">
                {currentSelectedOptionId ? (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span className={currentSelectedOptionId ? "text-cyan-300 font-semibold" : "text-slate-400"}>
                  {currentSelectedOptionId
                    ? "Option selected. You may change your choice anytime before the global timer ends."
                    : "No choice selected yet. Click an option above to record your response."}
                </span>
              </div>

              {saveToast && (
                <span className="text-emerald-400 font-bold animate-pulse text-[11px] uppercase tracking-wider">
                  {saveToast}
                </span>
              )}
            </div>
          </CyberCard>

          {/* PREVIOUS & NEXT QUESTION TRAVERSAL CONTROLS */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <CyberButton
              size="md"
              variant="outline"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              icon={ArrowLeft}
            >
              PREVIOUS QUESTION
            </CyberButton>

            <div className="text-xs font-mono text-slate-400 hidden sm:block">
              {Object.keys(savedAnswers).length} of {totalQuestions} answered
            </div>

            <CyberButton
              size="md"
              variant={currentIndex === totalQuestions - 1 ? "green" : "cyan"}
              onClick={handleNext}
              icon={currentIndex === totalQuestions - 1 ? Flag : ArrowRight}
            >
              {currentIndex === totalQuestions - 1 ? "REVIEW & FINISH" : "NEXT QUESTION"}
            </CyberButton>
          </div>
        </div>
      ) : (
        <div className="text-center font-mono text-cyan-400 text-sm py-16 animate-pulse">
          &gt; CONNECTING TO QUESTION SECTOR...
        </div>
      )}

      {/* Confirmation Modal to Finish Quiz Early */}
      {confirmFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-6 bg-[#0b1120] border-2 border-cyan-500 shadow-[0_0_30px_rgba(0,240,255,0.6)] space-y-4 font-mono">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg">
              <Flag className="w-5 h-5 text-cyan-400 glow-cyan" />
              <span>CONFIRM MISSION CONCLUSION</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You have answered <span className="text-cyan-300 font-bold">{Object.keys(savedAnswers).length}</span> of{" "}
              <span className="text-white font-bold">{totalQuestions}</span> questions. Are you ready to finalize your submission and decrypt results?
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <CyberButton
                size="sm"
                variant="outline"
                onClick={() => setConfirmFinishModal(false)}
              >
                RETURN TO QUIZ
              </CyberButton>

              <CyberButton
                size="sm"
                variant="green"
                onClick={handleFinishQuiz}
                icon={Check}
              >
                SUBMIT FINAL QUIZ
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="w-full text-center pt-4 text-[10px] font-mono text-slate-400">
        &gt; ANSWER KEYS DECRYPTED ONLY UPON SESSION TERMINATION &bull; TRAVERSAL ENABLED
      </div>
    </div>
  );
}
