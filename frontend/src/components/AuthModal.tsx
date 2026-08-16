import React, { useState, useEffect } from "react";
import { X, Lock, Mail, User as UserIcon, ShieldCheck } from "lucide-react";
import { apiLogin, apiRegister, UserProfile } from "../lib/api";
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
      setErrorMsg(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans text-white">
      <div className="bg-[#181818] w-full max-w-md rounded-2xl border border-zinc-800 p-6 shadow-2xl relative flex flex-col gap-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5">
          <img
            src="/ourpdf-icon.png"
            alt="OurPDF"
            className="w-11 h-11 rounded-xl object-contain bg-zinc-900 shadow-md border border-zinc-800 p-1"
          />
          <div>
            <h2 className="text-lg font-bold text-white">
              {customTitle || (isRegisterMode ? "Create Free OurPDF Account" : "Sign In to OurPDF")}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {customSubtitle ||
                (isRegisterMode
                  ? "Save documents, view processing history & access cloud storage."
                  : "Access your saved documents and cloud history.")}
            </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
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
                  className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2.5 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
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
                className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2.5 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
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
                className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2.5 rounded-lg border border-zinc-800 focus:border-[#1DB954] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold py-3 rounded-full transition-all cursor-pointer shadow-lg disabled:opacity-50"
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
