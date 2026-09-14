"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import QuizEditor from "@/components/QuizEditor";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi } from "@/lib/api";

export default function EditQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.quizId;

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quizId) return;

    async function loadQuiz() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchApi(`/api/quizzes/${quizId}`);
        setQuiz(data);
      } catch (err) {
        if (err.message.includes("401") || err.message.includes("token")) {
          router.push("/admin/login");
        } else {
          setError(err.message || "Failed to load quiz details.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [quizId, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-cyan-400 text-sm animate-pulse">
        &gt; RETRIEVING QUIZ RECORD FROM CLUSTER...
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <ErrorMessage message={error || "Quiz not found."} />
      </div>
    );
  }

  return <QuizEditor initialQuiz={quiz} isEditing={true} />;
}
