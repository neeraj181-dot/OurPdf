import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AuthMode, UserProfile } from "../types";
import { loginUser, signupUser, loginWithGoogle, DEMO_USERS } from "../lib/auth";
import { soundEffects } from "../lib/audio";


interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = "login",
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleModeSwitch = (newMode: AuthMode) => {
    soundEffects.playClick();
    setError(null);
    setSuccessMsg(null);
    setMode(newMode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    setTimeout(() => {
      if (mode === "login") {
        const res = loginUser(email, password);
        if (res.success && res.user) {
          soundEffects.playSuccess();
          setSuccessMsg(res.message || "Logged in successfully!");
          setTimeout(() => {
            onAuthSuccess(res.user!);
            onClose();
          }, 600);
        } else {
          setError(res.message || "Invalid credentials");
        }
      } else if (mode === "signup") {
        const res = signupUser(name, email, password);
        if (res.success && res.user) {
          soundEffects.playSuccess();
          setSuccessMsg(res.message || "Account created successfully!");
          setTimeout(() => {
            onAuthSuccess(res.user!);
            onClose();
          }, 600);
        } else {
          setError(res.message || "Could not create account");
        }
      } else if (mode === "forgot") {
        soundEffects.playSuccess();
        setSuccessMsg(`Password reset instructions sent to ${email || "your email"}.`);
        setTimeout(() => {
          setMode("login");
        }, 1800);
      }
      setIsSubmitting(false);
    }, 400);
  };

  const handleDemoLogin = (demoKey: "pro" | "free") => {
    soundEffects.playClick();
    setIsSubmitting(true);
    const demoUser = DEMO_USERS[demoKey];
    setEmail(demoUser.email);
    setPassword("password123");

    setTimeout(() => {
      const res = loginUser(demoUser.email, "password123");
      if (res.user) {
        soundEffects.playSuccess();
        setSuccessMsg(`Logged in as ${res.user.name} (${res.user.plan.toUpperCase()})`);
        setTimeout(() => {
          onAuthSuccess(res.user!);
          onClose();
        }, 500);
      }
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#18181c]/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-zinc-100"
        >
          {/* Close Button */}
          <button
            onClick={() => {
              soundEffects.playClick();
              onClose();
            }}
            className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Top Banner / Brand Header */}
          <div className="p-6 pb-4 border-b border-zinc-800/80 bg-gradient-to-b from-zinc-800/40 to-transparent text-center relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/30 text-[#1DB954] mb-3 shadow-[0_0_20px_rgba(29,185,84,0.15)]">
              <Sparkles className="w-6 h-6 stroke-[2.2]" />
            </div>
            <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight flex items-center justify-center gap-2">
              Easy PDF <span className="text-[#1DB954] text-sm font-semibold px-2 py-0.5 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30">Studio Pro</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {mode === "login" && "Sign in to access your PDF workspace & AI documents"}
              {mode === "signup" && "Create an account to unlock unlimited AI & PDF tools"}
              {mode === "forgot" && "Reset your password to recover account access"}
            </p>
          </div>

          {/* Quick 1-Click Demo Logins */}
          <div className="px-6 pt-4 pb-2 bg-zinc-900/60 border-b border-zinc-800/60">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1 text-[#1DB954]">
                <Zap className="w-3 h-3 fill-[#1DB954]" /> 1-Click Instant Demo Login
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin("pro")}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800/90 hover:bg-[#1DB954]/20 hover:border-[#1DB954]/50 border border-zinc-700/60 text-xs font-medium transition-all group cursor-pointer text-left"
              >
                <div>
                  <div className="text-zinc-200 font-semibold group-hover:text-[#1DB954]">Alex (PRO)</div>
                  <div className="text-[10px] text-zinc-400">1000 AI Credits</div>
                </div>
                <span className="text-[10px] bg-[#1DB954]/20 text-[#1DB954] font-bold px-1.5 py-0.5 rounded">PRO</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin("free")}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/60 text-xs font-medium transition-all group cursor-pointer text-left"
              >
                <div>
                  <div className="text-zinc-200 font-semibold">Sarah (Free)</div>
                  <div className="text-[10px] text-zinc-400">25 AI Credits</div>
                </div>
                <span className="text-[10px] bg-zinc-700 text-zinc-300 font-bold px-1.5 py-0.5 rounded">FREE</span>
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6">
            {/* Mode Switcher Tabs */}
            {mode !== "forgot" && (
              <div className="flex p-1 mb-5 rounded-xl bg-zinc-900 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("login")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === "login"
                      ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch("signup")}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mode === "signup"
                      ? "bg-[#1DB954] text-black font-bold shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Notifications */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/30 text-[#1DB954] text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Full Name field (Signup only) */}
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@easypdf.io"
                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                  />
                </div>
              </div>

              {/* Password field */}
              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-zinc-300">Password</label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => handleModeSwitch("forgot")}
                        className="text-[11px] text-zinc-400 hover:text-[#1DB954] transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-10 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Checkbox */}
              {mode === "login" && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-[#1DB954] focus:ring-[#1DB954] accent-[#1DB954] cursor-pointer"
                  />
                  <label htmlFor="remember" className="text-xs text-zinc-400 cursor-pointer select-none">
                    Remember me on this device
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(29,185,84,0.2)] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>
                      {mode === "login" && "Sign In to Studio"}
                      {mode === "signup" && "Create Free Account"}
                      {mode === "forgot" && "Send Reset Link"}
                    </span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>

            {/* Back to Login option in Forgot Password */}
            {mode === "forgot" && (
              <button
                onClick={() => handleModeSwitch("login")}
                className="w-full mt-3 text-center text-xs text-zinc-400 hover:text-zinc-200"
              >
                ← Back to Sign In
              </button>
            )}

            {/* Social Logins Divider */}
            {mode !== "forgot" && (
              <>
                <div className="relative my-4 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <span className="relative bg-[#18181c] px-3 text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
                    Or continue with
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playClick();
                      const res = loginWithGoogle();
                      if (res.user) {
                        soundEffects.playSuccess();
                        setSuccessMsg(`Signed in with Google as ${res.user.email}`);
                        setTimeout(() => {
                          onAuthSuccess(res.user!);
                          onClose();
                        }, 500);
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-medium transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="font-semibold text-zinc-100">Google</span>
                  </button>


                  <button
                    type="button"
                    onClick={() => handleDemoLogin("pro")}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-medium transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>
              </>
            )}

            {/* Client Side Guarantee Footer */}
            <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1DB954]" />
              <span>100% Private • End-to-End Client Processing</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
