"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, KeyRound, User, Lock, ArrowRight, Check } from "lucide-react";
import CyberButton from "@/components/CyberButton";
import CyberCard from "@/components/CyberCard";
import GlitchText from "@/components/GlitchText";
import ErrorMessage from "@/components/ErrorMessage";
import { fetchApi } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please provide both username and password.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isRegister) {
        // Register creator
        await fetchApi("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ username: username.trim(), password }),
        });
        setSuccessMsg("Creator registered successfully! Logging in...");
      }

      // Login creator
      const tokenRes = await fetchApi("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      localStorage.setItem("cyber_creator_token", tokenRes.access_token);
      localStorage.setItem("cyber_creator_user", tokenRes.username);
      localStorage.setItem("cyber_creator_id", tokenRes.creator_id);

      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/60 border border-purple-500/40 text-purple-400 font-mono text-xs tracking-widest uppercase">
            <KeyRound className="w-3.5 h-3.5 animate-pulse" />
            <span>GAME MASTER AUTHENTICATION</span>
          </div>

          <GlitchText
            text={isRegister ? "REGISTER CREATOR" : "CREATOR LOGIN"}
            as="h2"
            className="text-3xl font-black text-cyan-400 glow-cyan tracking-wider"
          />

          <p className="text-xs font-mono text-slate-400">
            Secure SHA-256 / Bcrypt credentials verification
          </p>
        </div>

        <CyberCard
          title={isRegister ? "NEW CREATOR ENROLLMENT" : "ADMIN CREDENTIALS"}
          badge="AUTH PROTOCOL"
          glowColor="purple"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {successMsg && (
              <div className="p-3 border border-emerald-500/50 bg-emerald-950/30 text-emerald-400 font-mono text-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>USERNAME</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. cyber_master"
                autoComplete="username"
                className="w-full bg-black/70 border border-cyan-500/40 px-4 py-2.5 font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.4)] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>PASSWORD</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full bg-black/70 border border-cyan-500/40 px-4 py-2.5 font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,240,255,0.4)] text-sm"
              />
            </div>

            {error && <ErrorMessage message={error} />}

            <CyberButton
              type="submit"
              size="md"
              variant="purple"
              loading={loading}
              className="w-full mt-2"
              icon={ArrowRight}
            >
              {isRegister ? "CREATE CREATOR ACCOUNT" : "AUTHENTICATE & ENTER"}
            </CyberButton>

            <div className="pt-3 text-center border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError("");
                  setSuccessMsg("");
                }}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider"
              >
                {isRegister
                  ? "Already have an account? Sign In"
                  : "Need a creator account? Register here"}
              </button>
            </div>
          </form>
        </CyberCard>
      </div>
    </div>
  );
}
