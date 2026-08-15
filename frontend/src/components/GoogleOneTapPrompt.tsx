import React, { useState } from "react";
import { X, Sparkles, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../lib/api";
import { demoGoogleSignIn } from "../lib/auth";
import { soundEffects } from "../lib/audio";

interface GoogleOneTapPromptProps {
  onAuthSuccess: (user: UserProfile) => void;
}

/**
 * Floating "Google One Tap" style prompt for unauthenticated users.
 *
 * TODO: PRODUCTION — Replace with real Google Identity Services One Tap.
 * See: https://developers.google.com/identity/gsi/web/guides/display-google-one-tap
 * This is currently a demo UI that simulates the experience.
 */
export const GoogleOneTapPrompt: React.FC<GoogleOneTapPromptProps> = ({ onAuthSuccess }) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleSignIn = () => {
    soundEffects.playSuccess();
    const res = demoGoogleSignIn("demo.user@gmail.com", "Demo User");
    if (res.user) {
      onAuthSuccess(res.user);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="fixed top-16 right-6 z-40 w-80 bg-[#1e1e24]/95 border border-zinc-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl font-sans text-zinc-100"
      >
        <button
          onClick={() => {
            soundEffects.playClick();
            setDismissed(true);
          }}
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <div>
            <div className="text-xs font-bold text-zinc-100">Sign in with Google <span className="text-[10px] text-zinc-500 font-normal">(Demo)</span></div>
            <div className="text-[10px] text-zinc-400">PDFora Studio</div>
          </div>
        </div>

        <p className="text-xs text-zinc-300 mb-3 leading-snug">
          Sign in to save documents to cloud storage and access processing history.
        </p>

        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-2 bg-[#4285F4] hover:bg-[#3367D6] text-white font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer shadow-md"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Continue with Google</span>
        </button>

        <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#1DB954]" /> Client-Side Security
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="hover:underline text-zinc-400"
          >
            Not now
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
