import React, { useState } from "react";
import {
  Sparkles,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
  FileText,
  User,
  Plus,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../types";
import { loginUser, signupUser, loginWithGoogle, DEMO_USERS } from "../lib/auth";
import { soundEffects } from "../lib/audio";

interface LoginPageProps {
  onAuthSuccess: (user: UserProfile) => void;
  onContinueAsGuest?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onAuthSuccess,
  onContinueAsGuest,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Google Account Picker State
  const [showGoogleAccountPicker, setShowGoogleAccountPicker] = useState(false);
  const [isCustomGoogleAccount, setIsCustomGoogleAccount] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");

  const handleGoogleSignIn = (selectedEmail?: string, selectedName?: string) => {
    soundEffects.playClick();
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      const res = loginWithGoogle(selectedEmail, selectedName);
      if (res.user) {
        soundEffects.playSuccess();
        setSuccessMsg(`Signed in with Google as ${res.user.email}`);
        setTimeout(() => {
          onAuthSuccess(res.user!);
        }, 500);
      }
      setIsLoading(false);
    }, 400);
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail || !customGoogleEmail.includes("@")) {
      return;
    }
    setShowGoogleAccountPicker(false);
    handleGoogleSignIn(customGoogleEmail, customGoogleName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      if (isSignUp) {
        const res = signupUser(name, email, password);
        if (res.success && res.user) {
          soundEffects.playSuccess();
          setSuccessMsg(res.message || "Account created!");
          setTimeout(() => onAuthSuccess(res.user!), 600);
        } else {
          setError(res.message || "Failed to create account.");
        }
      } else {
        const res = loginUser(email, password);
        if (res.success && res.user) {
          soundEffects.playSuccess();
          setSuccessMsg(res.message || "Signed in successfully!");
          setTimeout(() => onAuthSuccess(res.user!), 600);
        } else {
          setError(res.message || "Invalid email or password.");
        }
      }
      setIsLoading(false);
    }, 400);
  };

  const handleDemoLogin = (key: "pro" | "free") => {
    soundEffects.playClick();
    setIsLoading(true);
    const demo = DEMO_USERS[key];
    setTimeout(() => {
      const res = loginUser(demo.email, "password123");
      if (res.user) {
        soundEffects.playSuccess();
        onAuthSuccess(res.user);
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-full w-full bg-[#121215] flex flex-col items-center justify-center p-4 sm:p-8 font-sans text-zinc-100 relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#1DB954]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphism Auth Card */}
      <div className="w-full max-w-4xl bg-[#18181c]/95 border border-zinc-800/90 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 relative z-10 backdrop-blur-xl">
        
        {/* Left Side: Login Form & Sign In With Google */}
        <div className="p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Header / Brand */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#1DB954] flex items-center justify-center text-black font-bold shadow-[0_0_20px_rgba(29,185,84,0.3)]">
                <FileText className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-zinc-100">Easy PDF Studio</h1>
                <p className="text-xs text-zinc-400">Pure Client-Side Document Intelligence</p>
              </div>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100 mb-1">
              {isSignUp ? "Create Your Account" : "Welcome Back"}
            </h2>
            <p className="text-xs text-zinc-400 mb-6">
              {isSignUp
                ? "Sign up to unlock 1,000 AI Credits & all PDF tools"
                : "Sign in to manage your documents & AI analysis"}
            </p>

            {/* Notifications */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-[#1DB954]/15 border border-[#1DB954]/40 text-[#1DB954] text-xs font-semibold">
                {successMsg}
              </div>
            )}

            {/* Official Google Sign In Button */}
            <div className="space-y-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  setShowGoogleAccountPicker(true);
                }}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-800 font-bold text-xs py-3 px-4 rounded-xl border border-zinc-300 transition-all cursor-pointer shadow-md group relative overflow-hidden active:scale-[0.99]"
              >
                {/* Google Multicolor SVG Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Continue with Google</span>
              </button>

              {/* 1-Click Demo Login Shortcuts */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("pro")}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 hover:bg-[#1DB954]/20 border border-zinc-800 text-xs transition-colors cursor-pointer text-left"
                >
                  <span className="font-semibold text-zinc-200">Demo (Alex)</span>
                  <span className="text-[10px] bg-[#1DB954]/20 text-[#1DB954] font-bold px-1.5 py-0.5 rounded">PRO</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin("free")}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs transition-colors cursor-pointer text-left"
                >
                  <span className="font-semibold text-zinc-200">Demo (Sarah)</span>
                  <span className="text-[10px] bg-zinc-700 text-zinc-300 font-bold px-1.5 py-0.5 rounded">FREE</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <span className="relative bg-[#18181c] px-3 text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Or sign in with email
              </span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignUp && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@easypdf.io"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(29,185,84,0.2)] disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>{isSignUp ? "Create Studio Account" : "Sign In to Studio"}</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-xs text-zinc-400 hover:text-[#1DB954] font-medium transition-colors"
              >
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Create one"}
              </button>
            </div>
          </div>

          {/* Footer Guest Link */}
          {onContinueAsGuest && (
            <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
              <span>Client-Side Security</span>
              <button
                onClick={onContinueAsGuest}
                className="text-zinc-400 hover:text-zinc-200 font-medium transition-colors cursor-pointer"
              >
                Continue as Guest →
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Visual Showcase Banner */}
        <div className="bg-gradient-to-br from-[#1DB954]/20 via-zinc-900 to-black p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-zinc-800 relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] text-xs font-bold mb-6">
              <Sparkles className="w-3.5 h-3.5" /> PRO DOCUMENT INTELLIGENCE
            </div>

            <h3 className="text-2xl font-bold text-zinc-100 leading-tight tracking-tight mb-3">
              Fast, Private & Powerful PDF Tools in Your Browser
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Everything happens directly inside your web browser. No server uploads required for PDF processing.
            </p>

            {/* Highlights checklist */}
            <div className="space-y-3.5">
              <div className="flex items-start gap-3 text-xs text-zinc-300">
                <div className="w-5 h-5 rounded-md bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-100">1,000 AI Credits</span>
                  <p className="text-zinc-400 text-[11px]">Summarize, chat with PDFs & extract key data instantly</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs text-zinc-300">
                <div className="w-5 h-5 rounded-md bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-100">100% Privacy Guarantee</span>
                  <p className="text-zinc-400 text-[11px]">Your sensitive documents stay local to your computer</p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs text-zinc-300">
                <div className="w-5 h-5 rounded-md bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-100">Complete PDF Studio</span>
                  <p className="text-zinc-400 text-[11px]">Merge, organize, watermark, annotate & convert PDFs</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-zinc-800/80 flex items-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-[#1DB954]" />
            <span>End-to-End Client Encryption Active</span>
          </div>
        </div>
      </div>

      {/* Dynamic Google OAuth Account Selector Modal */}
      <AnimatePresence>
        {showGoogleAccountPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#1e1e24] border border-zinc-700 rounded-2xl p-6 shadow-2xl text-zinc-100 font-sans"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                  <span className="font-bold text-sm">Sign in with Google</span>
                </div>
                <button
                  onClick={() => {
                    setShowGoogleAccountPicker(false);
                    setIsCustomGoogleAccount(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>

              {!isCustomGoogleAccount ? (
                <>
                  <p className="text-xs text-zinc-400 mb-4">Choose an account to continue to Easy PDF Studio:</p>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setShowGoogleAccountPicker(false);
                        handleGoogleSignIn("alex.google@gmail.com", "Alex Rivera");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-left transition-colors cursor-pointer border border-zinc-700/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#4285F4] text-white font-bold flex items-center justify-center text-xs">
                          A
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-100">Alex Rivera</div>
                          <div className="text-[11px] text-zinc-400">alex.google@gmail.com</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>

                    <button
                      onClick={() => {
                        setShowGoogleAccountPicker(false);
                        handleGoogleSignIn("sarah.google@gmail.com", "Sarah Chen");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-left transition-colors cursor-pointer border border-zinc-700/60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#EA4335] text-white font-bold flex items-center justify-center text-xs">
                          S
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-zinc-100">Sarah Chen</div>
                          <div className="text-[11px] text-zinc-400">sarah.google@gmail.com</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>

                    {/* New User Option: Sign in with ANY Google Account */}
                    <button
                      onClick={() => setIsCustomGoogleAccount(true)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-left transition-colors cursor-pointer border border-zinc-700/80 text-[#4285F4] font-semibold text-xs mt-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <Plus className="w-4 h-4 text-[#4285F4]" />
                        <span>Use another Google account...</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </button>
                  </div>
                </>
              ) : (
                /* Custom Google Account Form for ANY New User */
                <form onSubmit={handleCustomGoogleSubmit} className="space-y-3">
                  <p className="text-xs text-zinc-400 mb-2">Enter your Google Account details:</p>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Google Email</label>
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#4285F4]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Display Name (Optional)</label>
                    <input
                      type="text"
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#4285F4]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomGoogleAccount(false)}
                      className="flex-1 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-xl"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 text-xs font-bold text-white bg-[#4285F4] hover:bg-[#3367D6] rounded-xl transition-all shadow-md"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
