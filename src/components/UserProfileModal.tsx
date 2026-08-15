import React from "react";
import {
  X,
  User,
  Mail,
  Zap,
  Sparkles,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  Crown,
  Calendar,
  CreditCard,
  Flame,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { UserProfile } from "../types";
import { upgradeUserPlan } from "../lib/auth";
import { soundEffects } from "../lib/audio";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUserUpdate: (user: UserProfile) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdate,
  onLogout,
}) => {
  if (!isOpen) return null;

  const isPro = user.plan === "pro";
  const creditPercent = Math.round((user.aiCredits / user.maxAiCredits) * 100);

  const handleUpgrade = () => {
    soundEffects.playSuccess();
    // Fire celebratory confetti burst
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#1DB954", "#ffffff", "#1ed760"],
    });

    const updated = upgradeUserPlan(user);
    onUserUpdate(updated);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#18181c] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-zinc-100"
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

          {/* Header Cover Banner */}
          <div className="h-24 bg-gradient-to-r from-[#1DB954]/20 via-emerald-900/30 to-zinc-900 border-b border-zinc-800/80 relative">
            <div className="absolute top-4 left-5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-zinc-700/80 text-[11px] font-semibold text-zinc-300 backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1DB954]" />
              <span>Easy PDF Account</span>
            </div>
          </div>

          {/* User Profile Info Section */}
          <div className="px-6 pb-6 relative -mt-10">
            <div className="flex items-end justify-between mb-4">
              <div className="relative">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-20 h-20 rounded-2xl border-4 border-[#18181c] object-cover shadow-xl bg-zinc-800"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl border-4 border-[#18181c] bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xl shadow-xl">
                    {user.name.charAt(0)}
                  </div>
                )}
                {isPro && (
                  <div
                    className="absolute -bottom-1 -right-1 bg-[#1DB954] text-black p-1 rounded-lg shadow-md"
                    title="Pro Subscriber"
                  >
                    <Crown className="w-3.5 h-3.5 fill-black stroke-black" />
                  </div>
                )}
              </div>

              {/* Plan Badge */}
              <div>
                {isPro ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/40 text-[#1DB954] text-xs font-bold shadow-[0_0_15px_rgba(29,185,84,0.15)]">
                    <Crown className="w-3.5 h-3.5 fill-[#1DB954]" /> PRO MEMBER
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold">
                    FREE PLAN
                  </span>
                )}
              </div>
            </div>

            {/* Name & Details */}
            <h2 className="text-xl font-bold text-zinc-100">{user.name}</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                {user.email}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Member since {user.joinDate}
              </span>
            </div>

            {/* AI Credits Meter Box */}
            <div className="mt-5 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1DB954]" /> AI Intelligence Credits
                </span>
                <span className="font-mono text-zinc-300 font-medium">
                  {user.aiCredits} / {user.maxAiCredits}
                </span>
              </div>

              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1DB954] to-emerald-400 transition-all duration-500 rounded-full"
                  style={{ width: `${creditPercent}%` }}
                ></div>
              </div>

              <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
                <span>Resets monthly • High-Speed Gemini 3.6 Flash</span>
                <span className="text-[#1DB954] font-semibold">{creditPercent}% available</span>
              </div>
            </div>

            {/* Upgrade Banner (for Free Users) */}
            {!isPro && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[#1DB954]/20 via-zinc-900 to-zinc-900 border border-[#1DB954]/40 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-zinc-100 flex items-center gap-1">
                    <Flame className="w-4 h-4 text-[#1DB954]" /> Upgrade to Pro Studio
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Unlock 1,000 AI Credits, Batch Merging & High Res OCR.
                  </div>
                </div>
                <button
                  onClick={handleUpgrade}
                  className="shrink-0 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs px-3.5 py-2 rounded-lg transition-all cursor-pointer shadow-lg"
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* Features Included List */}
            <div className="mt-5 space-y-2">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Plan Benefits Included
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" /> Unlimited PDF Tools
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" /> Smart AI Summaries
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" /> PDF AI Chat Companion
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1DB954]" /> OCR & Multilingual Translate
                </div>
              </div>
            </div>

            {/* Actions: Logout Button */}
            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => {
                  soundEffects.playClick();
                  onLogout();
                  onClose();
                }}
                className="flex items-center gap-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out of Studio</span>
              </button>

              <button
                onClick={onClose}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
