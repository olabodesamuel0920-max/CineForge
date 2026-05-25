"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Film, KeyRound, Sparkles, ChevronRight } from 'lucide-react';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';

export default function AuthPlaceholderPage() {
  const router = useRouter();

  const handleProceed = () => {
    // Proceed directly to projects dashboard
    router.push('/projects');
  };

  return (
    <div className="flex-1 bg-space-black relative flex items-center justify-center py-16 px-4">
      {/* Background neon glows */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-brand-violet/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full flex flex-col gap-6 relative z-10">
        
        {/* Auth card */}
        <div className="glass-panel-glow rounded-xl p-8 border border-brand-cyan/20 bg-space-card/80 shadow-[0_0_30px_rgba(0,243,255,0.05)] relative overflow-hidden flex flex-col gap-6">
          {/* Top aesthetic corner ticks */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/20"></div>
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/20"></div>

          {/* Icon Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 rounded-full bg-gradient-to-tr from-brand-cyan to-brand-violet text-space-black mb-1">
              <Film className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-wide text-white font-mono">
              CINE<span className="text-brand-cyan">FORGE</span> CORE ACCESS
            </h2>
            <p className="text-xs text-brand-cyan/70 font-mono tracking-wider">
              EDITDNA SYSTEM IDENTITY
            </p>
          </div>

          <div className="border-t border-b border-white/5 py-4 my-2 flex flex-col gap-3 font-mono text-[11px] text-gray-400">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-cyan shrink-0" />
              <span>Authentication Node: <strong className="text-gray-200">Local Bypass Mode</strong></span>
            </div>
            <p className="leading-relaxed text-gray-400 pl-6 border-l border-white/10">
              For Phase 1A, Supabase cloud integrations are inactive. The platform is running client-side using localStorage persistence registers.
            </p>
          </div>

          <button
            onClick={handleProceed}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,243,255,0.15)] cursor-pointer"
          >
            Authorize Connection <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <RightsSafetyNotice />
      </div>
    </div>
  );
}
