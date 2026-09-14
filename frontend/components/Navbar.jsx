"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, Terminal, LogOut, User, Cpu } from "lucide-react";
import CyberButton from "./CyberButton";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [creatorUser, setCreatorUser] = useState(null);

  useEffect(() => {
    const user = localStorage.getItem("cyber_creator_user");
    if (user) {
      setCreatorUser(user);
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("cyber_creator_token");
    localStorage.removeItem("cyber_creator_user");
    setCreatorUser(null);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-500/20 bg-black/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative p-2 bg-cyan-950/60 border border-cyan-500/50 group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(0,240,255,0.5)] transition-all">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
          </div>
          <div>
            <div className="font-mono font-black text-base tracking-widest text-cyan-400 glow-cyan">
              CYBER
            </div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              SECURITY PROTOCOL v1.0
            </div>
          </div>
        </Link>

        {/* Right Navigation */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <CyberButton size="sm" variant="outline">
              JOIN ROOM
            </CyberButton>
          </Link>

          {creatorUser ? (
            <div className="flex items-center gap-2">
              <Link href="/admin/dashboard">
                <CyberButton size="sm" variant="cyan" icon={Cpu}>
                  DASHBOARD [{creatorUser}]
                </CyberButton>
              </Link>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/admin/login">
              <CyberButton size="sm" variant="purple" icon={User}>
                CREATOR PORTAL
              </CyberButton>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
