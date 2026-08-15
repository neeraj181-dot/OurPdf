import React from "react";
import { X, Mail, Calendar, Shield, LogOut, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProfile } from "../lib/api";
import { soundEffects } from "../lib/audio";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
}) => {
  if (!isOpen) return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const planLabel = user.plan === "pro" ? "Pro" : "Free";
  const planColor = user.plan === "pro" ? "text-[#1DB954]" : "text-zinc-400";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans text-zinc-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-sm bg-[#18181c]/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-zinc-800/80 bg-gradient-to-b from-zinc-800/40 to-transparent relative">
            <button
              onClick={() => {
                soundEffects.playClick();
                onClose();
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4">
              {/* Avatar */}
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-14 h-14 rounded-xl border-2 border-zinc-700 object-cover bg-zinc-800"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1DB954] to-emerald-700 flex items-center justify-center text-lg font-bold text-white border-2 border-zinc-700">
                  {initials}
                </div>
              )}
              <div>
                <h2 className="text-base font-bold text-zinc-100">{user.name}</h2>
                <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6 space-y-3">
            {/* Plan Badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${planColor}`} />
                <span className="text-xs font-semibold text-zinc-200">Account Plan</span>
              </div>
              <span className={`text-xs font-bold ${planColor} uppercase`}>{planLabel}</span>
            </div>

            {/* AI Credits */}
            {user.aiCredits !== undefined && user.maxAiCredits !== undefined && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-200">AI Credits</span>
                  <span className="text-xs text-zinc-400">
                    {user.aiCredits} / {user.maxAiCredits}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1DB954] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (user.aiCredits / user.maxAiCredits) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Account Info */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <Calendar className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-400">
                Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <Shield className="w-4 h-4 text-[#1DB954]" />
              <span className="text-xs text-zinc-400">
                {user.is_active ? "Account Active" : "Account Inactive"}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                soundEffects.playClick();
                onLogout();
                onClose();
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-rose-500/20 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
