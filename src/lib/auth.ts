import { UserProfile, AuthResult } from "../types";

const AUTH_STORAGE_KEY = "easy_pdf_user_session_v1";

// Demo Users for 1-Click Fast Testing
export const DEMO_USERS: Record<string, UserProfile> = {
  pro: {
    id: "usr_pro_demo",
    name: "Alex Rivera",
    email: "alex.rivera@easypdf.io",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    plan: "pro",
    aiCredits: 950,
    maxAiCredits: 1000,
    joinDate: "Jan 2025",
  },
  free: {
    id: "usr_free_demo",
    name: "Sarah Chen",
    email: "sarah.chen@easypdf.io",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    plan: "free",
    aiCredits: 15,
    maxAiCredits: 25,
    joinDate: "Aug 2026",
  },
};

/**
  Retrieve currently logged in user session from localStorage
 */
export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return DEMO_USERS.pro; // Default active demo user for instant rich UI
    return JSON.parse(raw) as UserProfile;
  } catch (err) {
    console.error("Error reading user auth session:", err);
    return DEMO_USERS.pro;
  }
}

/**
  Save user profile session to localStorage
 */
export function saveUserSession(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.error("Error saving user auth session:", err);
  }
}

/**
  Authenticate user with email and password
 */
export function loginUser(email: string, pass: string): AuthResult {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, message: "Please enter your email address." };
  }
  if (!pass || pass.length < 4) {
    return { success: false, message: "Password must be at least 4 characters." };
  }

  // Quick check demo users
  if (cleanEmail === DEMO_USERS.pro.email.toLowerCase()) {
    saveUserSession(DEMO_USERS.pro);
    return { success: true, user: DEMO_USERS.pro, message: "Welcome back, Alex!" };
  }

  if (cleanEmail === DEMO_USERS.free.email.toLowerCase()) {
    saveUserSession(DEMO_USERS.free);
    return { success: true, user: DEMO_USERS.free, message: "Welcome back, Sarah!" };
  }

  // Create or retrieve session for any valid input
  const nameFromEmail = cleanEmail.split("@")[0];
  const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
  const newUser: UserProfile = {
    id: `usr_${Date.now()}`,
    name: formattedName || "Easy PDF User",
    email: cleanEmail,
    plan: "pro", // Default full access for created accounts
    aiCredits: 500,
    maxAiCredits: 500,
    joinDate: "Aug 2026",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail}`,
  };

  saveUserSession(newUser);
  return { success: true, user: newUser, message: `Welcome back, ${newUser.name}!` };
}

/**
  Register a new account
 */
export function signupUser(name: string, email: string, pass: string): AuthResult {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName) {
    return { success: false, message: "Please enter your full name." };
  }
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, message: "Please enter a valid email address." };
  }
  if (!pass || pass.length < 6) {
    return { success: false, message: "Password must be at least 6 characters long." };
  }

  const newUser: UserProfile = {
    id: `usr_${Date.now()}`,
    name: cleanName,
    email: cleanEmail,
    plan: "pro", // Welcome bonus: Pro status
    aiCredits: 1000,
    maxAiCredits: 1000,
    joinDate: "Aug 2026",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail}`,
  };

  saveUserSession(newUser);
  return { success: true, user: newUser, message: `Account created! Welcome, ${newUser.name}.` };
}

/**
  Sign in with Google (Pure Frontend OAuth Simulator for any user)
 */
export function loginWithGoogle(customEmail?: string, customName?: string): AuthResult {
  const cleanEmail = (customEmail || "user.google@gmail.com").trim().toLowerCase();
  
  // Extract or format name
  let name = customName?.trim();
  if (!name) {
    const rawPrefix = cleanEmail.split("@")[0].replace(/[._-]/g, " ");
    name = rawPrefix
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  if (!name) name = "Google User";

  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`;

  const googleUser: UserProfile = {
    id: `usr_google_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    email: cleanEmail,
    avatar,
    plan: "pro",
    aiCredits: 1000,
    maxAiCredits: 1000,
    joinDate: "Aug 2026",
  };

  saveUserSession(googleUser);
  return {
    success: true,
    user: googleUser,
    message: `Signed in with Google as ${googleUser.email}!`,
  };
}


/**
  Log out the user
 */
export function logoutUser(): void {
  saveUserSession(null);
}

/**
  Upgrade current user plan to PRO
 */
export function upgradeUserPlan(currentUser: UserProfile): UserProfile {
  const updated: UserProfile = {
    ...currentUser,
    plan: "pro",
    aiCredits: 1000,
    maxAiCredits: 1000,
  };
  saveUserSession(updated);
  return updated;
}

