import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Download,
  LogOut,
  Edit2,
  Check,
  X,
  Lock,
  Calendar,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  UserProfile,
  GoogleDriveStatus,
  apiUpdateProfile,
  apiChangePassword,
  apiGetGoogleDriveStatus,
  apiGetGoogleDriveAuthUrl,
  apiDisconnectGoogleDrive,
} from "../../lib/api";
import { soundEffects } from "../../lib/audio";

interface ProfileWorkspaceProps {
  user: UserProfile | null;
  onUpdateUser: (updated: UserProfile) => void;
  onOpenAuthModal: (mode?: "login" | "register") => void;
  onLogout: () => void;
  onNavigateToDocs: (tab?: "saved" | "downloads" | "recent") => void;
}

export const ProfileWorkspace: React.FC<ProfileWorkspaceProps> = ({
  user,
  onUpdateUser,
  onOpenAuthModal,
  onLogout,
  onNavigateToDocs,
}) => {
  // Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Connected Services State
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus>({ connected: false });
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isDisconnectingDrive, setIsDisconnectingDrive] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Load Google Drive Status on Mount
  useEffect(() => {
    if (user) {
      loadDriveStatus();
    }
  }, [user]);

  // Multi-channel OAuth listeners (postMessage, BroadcastChannel, storage events)
  useEffect(() => {
    const onAuthSuccess = () => {
      soundEffects.playSuccess();
      setIsConnectingDrive(false);
      setDriveSuccess("Google Drive connected successfully!");
      loadDriveStatus();
      setTimeout(() => setDriveSuccess(null), 5000);
    };

    const onAuthError = (errMsg?: string) => {
      setIsConnectingDrive(false);
      setDriveError(errMsg || "Google Drive connection failed.");
    };

    // 1. Window message
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
        onAuthSuccess();
      } else if (event.data?.type === "GOOGLE_DRIVE_AUTH_ERROR") {
        onAuthError(event.data?.error);
      }
    };
    window.addEventListener("message", handleMessage);

    // 2. BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("ourpdf_google_drive");
      bc.onmessage = (event) => {
        if (event.data?.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
          onAuthSuccess();
        } else if (event.data?.type === "GOOGLE_DRIVE_AUTH_ERROR") {
          onAuthError(event.data?.error);
        }
      };
    } catch (e) {}

    // 3. Storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ourpdf_google_drive_auth_event" && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.type === "GOOGLE_DRIVE_AUTH_SUCCESS") {
            onAuthSuccess();
          } else if (data.type === "GOOGLE_DRIVE_AUTH_ERROR") {
            onAuthError(data.error);
          }
        } catch (err) {}
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      if (bc) bc.close();
    };
  }, []);

  const loadDriveStatus = async () => {
    setIsLoadingDrive(true);
    try {
      const status = await apiGetGoogleDriveStatus();
      setDriveStatus(status);
    } catch (err) {
      console.warn("Could not load Google Drive status:", err);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleConnectDrive = async () => {
    soundEffects.playClick();
    setIsConnectingDrive(true);
    setDriveError(null);
    try {
      const authUrl = await apiGetGoogleDriveAuthUrl();
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "GoogleDriveAuth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        window.location.href = authUrl;
        return;
      }

      let checks = 0;
      const maxChecks = 90;
      const pollTimer = setInterval(async () => {
        checks++;

        if (checks % 2 === 0) {
          try {
            const st = await apiGetGoogleDriveStatus();
            if (st.connected) {
              clearInterval(pollTimer);
              setIsConnectingDrive(false);
              soundEffects.playSuccess();
              setDriveSuccess("Google Drive connected successfully!");
              setDriveStatus(st);
              try { popup.close(); } catch(e) {}
              return;
            }
          } catch(e) {}
        }

        if (popup.closed) {
          clearInterval(pollTimer);
          setTimeout(async () => {
            try {
              const st = await apiGetGoogleDriveStatus();
              setIsConnectingDrive(false);
              if (st.connected) {
                soundEffects.playSuccess();
                setDriveSuccess("Google Drive connected successfully!");
                setDriveStatus(st);
              }
            } catch(e) {
              setIsConnectingDrive(false);
            }
          }, 800);
        } else if (checks >= maxChecks) {
          clearInterval(pollTimer);
          setIsConnectingDrive(false);
          setDriveError("Connection timed out. Please try again.");
        }
      }, 1000);
    } catch (err: any) {
      setIsConnectingDrive(false);
      setDriveError(err?.message || "Could not generate Google authorization link.");
    }
  };

  const handleDisconnectDrive = async () => {
    setIsDisconnectingDrive(true);
    setDriveError(null);
    try {
      soundEffects.playClick();
      await apiDisconnectGoogleDrive();
      setDriveStatus({ connected: false });
      setShowDisconnectModal(false);
      setDriveSuccess("Google Drive disconnected.");
      soundEffects.playSuccess();
      setTimeout(() => setDriveSuccess(null), 4000);
    } catch (err: any) {
      setDriveError(err?.message || "Failed to disconnect Google Drive.");
    } finally {
      setIsDisconnectingDrive(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[#18181b] rounded-2xl border border-zinc-800 p-8 max-w-xl mx-auto my-8 text-center text-white shadow-2xl gap-5 font-sans">
        <img
          src="/ourpdf-icon.png"
          alt="OurPDF"
          className="w-16 h-16 rounded-2xl object-contain bg-zinc-900 border border-zinc-800 shadow-inner p-1.5"
        />
        <div>
          <h2 className="text-xl font-bold text-white">Sign In to View Your Profile</h2>
          <p className="text-xs text-zinc-400 max-w-md leading-relaxed mt-1">
            Manage your personal OurPDF workspace, saved documents, download history, and account security.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenAuthModal("login");
            }}
            className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg"
          >
            <Lock className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              onOpenAuthModal("register");
            }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-6 py-2.5 rounded-xl transition-all cursor-pointer border border-zinc-700"
          >
            <span>Create Account</span>
          </button>
        </div>
      </div>
    );
  }

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) {
      setNameError("Name cannot be empty.");
      return;
    }

    setIsUpdatingName(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      soundEffects.playClick();
      const updated = await apiUpdateProfile(clean);
      onUpdateUser(updated);
      setIsEditingName(false);
      setNameSuccess("Profile name updated successfully!");
      soundEffects.playSuccess();
      setTimeout(() => setNameSuccess(null), 4000);
    } catch (err: any) {
      setNameError(err?.message || "Failed to update profile name.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      soundEffects.playClick();
      const res = await apiChangePassword(currentPassword, newPassword);
      soundEffects.playSuccess();
      setPasswordSuccess(res.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to change password. Please check your current password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatDate = (isoString?: string): string => {
    if (!isoString) return "Active member";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Active member";
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 font-sans text-white">
      {/* Top Banner Profile Card */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-[#1DB954] text-black font-extrabold flex items-center justify-center text-3xl shadow-lg border-2 border-white/10 shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">{user.name}</h2>
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-normal">
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              <span>{user.email}</span>
            </p>

            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3 h-3 text-zinc-600" />
              <span>Member since {formatDate(user.created_at)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center">
          <button
            onClick={() => {
              soundEffects.playClick();
              onLogout();
            }}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-400 text-xs font-semibold px-4 py-2 rounded-xl border border-zinc-800 hover:border-rose-900/50 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {nameSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2.5 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-[#1DB954] shrink-0" />
          <span>{nameSuccess}</span>
        </div>
      )}

      {/* Grid: Edit Profile & Change Password */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Account Information & Profile Edit */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954]">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Profile Details</h3>
              </div>

              {!isEditingName && (
                <button
                  onClick={() => {
                    soundEffects.playClick();
                    setNewName(user.name);
                    setIsEditingName(true);
                  }}
                  className="flex items-center gap-1.5 text-xs text-[#1DB954] hover:text-[#1ed760] font-semibold transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Name</span>
                </button>
              )}
            </div>

            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={isUpdatingName}
                    placeholder="Enter your name"
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#1DB954] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none transition-colors"
                  />
                </div>

                {nameError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{nameError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingName || !newName.trim()}
                    className="flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] disabled:bg-zinc-800 text-black font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-md"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isUpdatingName ? "Saving..." : "Save Changes"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameError(null);
                    }}
                    disabled={isUpdatingName}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Full Name</span>
                  <span className="font-semibold text-white">{user.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Email Address</span>
                  <span className="font-semibold text-white">{user.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Account Type</span>
                  <span className="font-semibold text-[#1DB954]">OurPDF Personal Workspace</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Security</span>
                  <span className="font-semibold text-zinc-300">Encrypted JWT Authentication</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Access to Documents */}
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FolderOpen className="w-4 h-4 text-[#1DB954]" />
              <span className="text-xs font-semibold text-zinc-200">Personal Documents</span>
            </div>
            <button
              onClick={() => onNavigateToDocs("saved")}
              className="text-xs font-bold text-[#1DB954] hover:text-[#1ed760] transition-colors cursor-pointer"
            >
              View Saved Documents →
            </button>
          </div>
        </div>

        {/* Card 2: Change Password */}
        <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#1DB954]">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Change Password</h3>
                <p className="text-[11px] text-zinc-400">Update your account password</p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1DB954] shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="bg-rose-950/80 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-zinc-300 block mb-1 font-medium">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isChangingPassword}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#1DB954] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isChangingPassword}
                  placeholder="At least 6 characters"
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#1DB954] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1 font-medium">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isChangingPassword}
                  placeholder="Repeat new password"
                  className="w-full bg-zinc-900 border border-zinc-700 focus:border-[#1DB954] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                  className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-[#1DB954] hover:text-black text-zinc-100 font-bold text-xs py-2.5 rounded-lg border border-zinc-700 hover:border-[#1DB954] transition-all cursor-pointer shadow-md disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{isChangingPassword ? "Updating Password..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>

          <p className="text-[10px] text-zinc-500 leading-tight">
            Passwords are encrypted using Argon2 / BCrypt with salted hashes on the backend.
          </p>
        </div>
      </div>

      {/* SECTION 3: CONNECTED SERVICES */}
      <div className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Connected Services</h3>
            <p className="text-[11px] text-zinc-400">Manage third-party cloud integrations and storage accounts</p>
          </div>
        </div>

        {driveSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1DB954] shrink-0" />
            <span>{driveSuccess}</span>
          </div>
        )}

        {driveError && (
          <div className="bg-rose-950/80 border border-rose-500/40 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{driveError}</span>
          </div>
        )}

        {/* Google Drive Card */}
        <div className="bg-zinc-900/80 p-5 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 p-2.5 shadow-inner">
              <svg className="w-full h-full" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Google Drive</h4>
                {driveStatus.connected && (
                  <span className="text-[10px] bg-emerald-950 text-[#1DB954] px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                )}
              </div>

              {driveStatus.connected ? (
                <div className="mt-1">
                  <p className="text-xs text-zinc-200 font-semibold">
                    {driveStatus.google_email || "Connected Google Account"}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Import and save documents directly to your Google Drive.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 mt-1 max-w-md font-normal leading-relaxed">
                  Connect your Google Drive to import and save documents directly from OurPDF.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center shrink-0 w-full sm:w-auto justify-end">
            {driveStatus.connected ? (
              <>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-2 rounded-lg border border-zinc-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>Open Drive</span>
                </a>

                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="flex items-center gap-1.5 bg-zinc-900 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-400 text-xs font-semibold px-4 py-2 rounded-lg border border-zinc-800 hover:border-rose-900/50 transition-colors cursor-pointer"
                >
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectDrive}
                disabled={isConnectingDrive}
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {isConnectingDrive ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Connect Google Drive</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#18181b] border border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Disconnect Google Drive?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  This will remove OurPDF's connection to your Google Drive.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
              Your Google Drive files will remain safe and untouched. You can reconnect your Google Drive at any time.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowDisconnectModal(false)}
                disabled={isDisconnectingDrive}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleDisconnectDrive}
                disabled={isDisconnectingDrive}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-lg disabled:opacity-50"
              >
                <span>{isDisconnectingDrive ? "Disconnecting..." : "Yes, Disconnect"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
