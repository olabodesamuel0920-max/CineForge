"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Film, Mail, Lock, Sparkles, ArrowRight, AlertCircle, CheckCircle, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import RightsSafetyNotice from '@/components/RightsSafetyNotice';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Tab/flow selections
  const [isSignUp, setIsSignUp] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  
  // Loading & notification states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if supabase is initialized in active environment
  const isSupabaseConfigured = !!supabase;

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.push('/projects');
        }
      });
    }
  }, [router]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    if (!supabase) {
      setError('The authentication database connection is offline. Please proceed via Guest Mode.');
      return;
    }

    setLoading(true);

    try {
      if (useMagicLink) {
        // Send a passwordless Magic Link
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/projects`
          }
        });
        if (otpError) throw otpError;
        setSuccess('Authentication link dispatched successfully! Verify your email to access the studio.');
      } else {
        if (!password) {
          setError('Password is required for standard authentication.');
          setLoading(false);
          return;
        }

        if (isSignUp) {
          // Account registration
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password
          });
          if (signUpError) throw signUpError;
          setSuccess('Account registration dispatched! Please check your email inbox to verify your credentials.');
        } else {
          // Sign In
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          if (signInError) throw signInError;
          setSuccess('Credential access authorized. Accessing project database...');
          setTimeout(() => {
            router.push('/projects');
          }, 1200);
        }
      }
    } catch (err) {
      setError((err as Error).message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    router.push('/projects');
  };

  return (
    <div className="flex-1 bg-space-black relative flex items-center justify-center py-16 px-4 select-none">
      {/* Background radial neon glows */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-brand-violet/5 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.5s' }}></div>

      <div className="max-w-md w-full flex flex-col gap-6 relative z-10">
        
        {/* Auth card */}
        <div className="glass-panel rounded-xl p-8 border border-white/5 bg-space-card/85 shadow-[0_0_40px_rgba(0,243,255,0.03)] relative overflow-hidden flex flex-col gap-6">
          
          {/* Aesthetic Corner Detailing */}
          <div className="absolute top-4 left-4 w-2 h-2 border-t border-l border-white/10"></div>
          <div className="absolute top-4 right-4 w-2 h-2 border-t border-r border-white/10"></div>
          
          {/* Header Title */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 rounded-full bg-gradient-to-tr from-brand-cyan to-brand-violet text-space-black mb-1 shadow-[0_0_15px_rgba(0,243,255,0.25)]">
              <Film className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-wider text-white font-mono uppercase">
              Cine<span className="text-brand-cyan text-glow-cyan">Forge</span> Access Node
            </h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
              {isSignUp ? 'Establish Identity Keys' : 'Authorize Core Connection'}
            </p>
          </div>

          {/* Feedback states */}
          {error && (
            <div className="p-3.5 rounded-lg bg-brand-magenta/10 border border-brand-magenta/25 text-[11px] text-brand-magenta flex items-start gap-2.5 animate-fadeIn font-mono leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-lg bg-brand-green/10 border border-brand-green/25 text-[11px] text-brand-green flex items-start gap-2.5 animate-fadeIn font-mono leading-relaxed">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-brand-cyan" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. pilot@cineforge.io"
                disabled={loading}
                className="w-full bg-[#050508] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan transition-colors"
                required
              />
            </div>

            {/* Password Field (Only when not using Magic Link) */}
            {!useMagicLink && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400 font-mono uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-brand-violet" /> Password Key
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={loading}
                  className="w-full bg-[#050508] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-cyan transition-colors"
                  required={!useMagicLink}
                />
              </div>
            )}

            {/* Auth options switcher (Standard Password vs Magic Link) */}
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 mt-1 pl-1">
              <button
                type="button"
                onClick={() => {
                  setUseMagicLink(!useMagicLink);
                  setError(null);
                  setSuccess(null);
                }}
                className="hover:text-brand-cyan transition-colors hover:underline cursor-pointer"
              >
                {useMagicLink ? 'Use Password Sign-in' : 'Use Passwordless Magic Link'}
              </button>

              {!useMagicLink && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-brand-violet hover:text-brand-magenta transition-colors hover:underline cursor-pointer font-bold"
                >
                  {isSignUp ? 'Already registered? Login' : 'Create New Account'}
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-violet hover:from-brand-cyan hover:to-brand-magenta text-space-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,243,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  {isSignUp ? 'Generate Identity' : 'Establish Connection'}{' '}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Guest Mode Fallback Separator */}
          <div className="relative flex items-center justify-center my-1 font-mono text-[9px] text-gray-600 uppercase tracking-widest">
            <div className="absolute left-0 right-0 h-[1px] bg-white/5"></div>
            <span className="bg-[#0b0c10] px-3 z-10">OR GUEST BYPASS</span>
          </div>

          {/* Continue as Guest Button */}
          <button
            onClick={handleGuestMode}
            className="w-full py-3 rounded-lg border border-white/10 hover:border-brand-cyan/40 bg-white/[0.01] hover:bg-white/[0.03] text-gray-300 hover:text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-brand-cyan" />
            Continue as Guest
          </button>

          {/* Database Diagnostics Footer */}
          <div className="border-t border-white/5 pt-4 mt-1 flex items-center justify-between font-mono text-[9px]">
            <span className="text-gray-500">DATABASE INTERFACE:</span>
            {isSupabaseConfigured ? (
              <span className="text-brand-green font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse"></span>
                CLOUD CONNECTED
              </span>
            ) : (
              <span className="text-brand-amber font-bold flex items-center gap-1" title="Supabase configuration keys missing in .env.local">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse"></span>
                LOCAL BYPASS ACTIVE
              </span>
            )}
          </div>

        </div>

        <RightsSafetyNotice />
      </div>
    </div>
  );
}
