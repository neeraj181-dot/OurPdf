import React, { useState, useEffect } from "react";
import { X, Lock, Mail, User as UserIcon, ShieldCheck, Zap } from "lucide-react";
import { apiLogin, apiRegister, UserProfile } from "../lib/api";
import { demoLogin, demoGoogleSignIn, DEMO_USERS } from "../lib/auth";
import { soundEffects } from "../lib/audio";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  initialMode?: "login" | "register";
  customTitle?: string;
  customSubtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "login",
  customTitle,
  customSubtitle,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(initialMode === "register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsRegisterMode(initialMode === "register");
    setErrorMsg(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    soundEffects.playClick();

    try {
      if (isRegisterMode) {
        if (!name.trim()) throw new Error("Please enter your full name.");
        const res = await apiRegister(name, email, password);
        soundEffects.playSuccess();
        onSuccess(res.user);
        onClose();
      } else {
        const res = await apiLogin(email, password);
        soundEffects.playSuccess();
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      // Fallback to demo login if backend is unavailable or fails
      if (!isRegisterMode) {
        const demoRes = demoLogin(email, password);
        if (demoRes.success && demoRes.user) {
          soundEffects.playSuccess();
          onSuccess(demoRes.user);
          onClose();
          return;
        }
      }
      setErrorMsg(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (key: "pro" | "free") => {
    soundEffects.playClick();
    const demo = DEMO_USERS[key];
    const res = demoLogin(demo.email, "password123");
    if (res.user) {
      soundEffects.playSuccess();
      onSuccess(res.user);
      onClose();
    }
  };

  const handleGoogleSignIn = () => {
    soundEffects.playClick();
    const res = demoGoogleSignIn("demo.google@gmail.com", "Google Account User");
    if (res.user) {
      soundEffects.playSuccess();
      onSuccess(res.user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans text-white">
      <div className="bg-[#181818] w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl relative flex flex-col gap-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1DB954] text-black flex items-center justify-center font-bold">
            <Lock className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {customTitle || (isRegisterMode ? "Create Free PDFora Account" : "Sign In to PDFora")}
            </h2>
            <p className="text-xs text-zinc-400">
              {customSubtitle ||
                (isRegisterMode
                  ? "Save documents, view processing history & access cloud storage."
                  : "Access your saved documents and cloud history.")}
            </p>
          </div>
        </div>

        {/* Quick 1-Click Demo Logins */}
        <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1 text-[#1DB954]">
              <Zap className="w-3 h-3 fill-[#1DB954]" /> 1-Click Instant Demo Login
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoLogin("pro")}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-[#1DB954]/20 border border-zinc-700/60 text-xs transition-all cursor-pointer text-left"
            >
              <div>
                <div className="text-zinc-200 font-semibold text-[11px]">Alex (PRO)</div>
                <div className="text-[9px] text-zinc-400">1000 AI Credits</div>
              </div>
              <span className="text-[9px] bg-[#1DB954]/20 text-[#1DB954] font-bold px-1.5 py-0.5 rounded">PRO</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin("free")}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-xs transition-all cursor-pointer text-left"
            >
              <div>
                <div className="text-zinc-200 font-semibold text-[11px]">Sarah (Free)</div>
                <div className="text-[9px] text-zinc-400">25 AI Credits</div>
              </div>
              <span className="text-[9px] bg-zinc-700 text-zinc-300 font-bold px-1.5 py-0.5 rounded">FREE</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              setIsRegisterMode(false);
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              !isRegisterMode
                ? "bg-[#181818] text-white shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              setIsRegisterMode(true);
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              isRegisterMode
                ? "bg-[#181818] text-white shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Register
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-100 text-zinc-800 font-bold text-xs py-2.5 px-4 rounded-xl border border-zinc-300 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Continue with Google</span>
          <span className="text-[9px] text-zinc-400 font-normal">(Demo)</span>
        </button>

        <div className="relative my-1 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <span className="relative bg-[#181818] px-3 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Or sign in with email
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          {isRegisterMode && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-zinc-400 uppercase">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-400 uppercase">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-400 uppercase">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-2.5 rounded-full transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isLoading
                ? "AUTHENTICATING..."
                : isRegisterMode
                ? "CREATE FREE ACCOUNT"
                : "SIGN IN"}
            </span>
          </button>
        </form>

        <p className="text-[11px] text-zinc-400 text-center">
          Optional cloud account. All client-side tools remain 100% free without sign-in.
        </p>
      </div>
    </div>
  );
};
