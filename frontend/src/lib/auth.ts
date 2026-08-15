/**
 * Demo/Development Authentication Layer
 *
 * TODO: PRODUCTION — Replace this entire module with real authentication.
 * This file provides a localStorage-based demo auth system for development
 * and testing when the backend auth service is unavailable.
 *
 * For real authentication, use the functions in ./api.ts (apiLogin, apiRegister, etc.)
 * which communicate with the backend FastAPI auth endpoints.
 *
 * This module is NOT secure and should NEVER be used in production.
 */

import { UserProfile } from "./api";

const DEMO_AUTH_STORAGE_KEY = "pdfora_demo_user_session";

/**
 * Pre-configured demo accounts for 1-click testing.
 * These are NOT real users — they exist only in the browser.
 */
export const DEMO_USERS: Record<string, UserProfile> = {
  pro: {
    id: 9001,
    name: "Alex Rivera",
    email: "alex.rivera@pdfora.demo",
    is_active: true,
    created_at: new Date().toISOString(),
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex.rivera",
    plan: "pro",
    aiCredits: 950,
    maxAiCredits: 1000,
  },
  free: {
    id: 9002,
    name: "Sarah Chen",
    email: "sarah.chen@pdfora.demo",
    is_active: true,
    created_at: new Date().toISOString(),
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah.chen",
    plan: "free",
    aiCredits: 15,
    maxAiCredits: 25,
  },
};

/**
 * Retrieve demo user session from localStorage.
 * Returns null if no demo session exists (does NOT auto-login).
 */
export function getDemoStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Save demo user profile to localStorage.
 */
function saveDemoSession(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
    }
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

/**
 * Demo login with email/password.
 * Accepts any email/password combination for development convenience.
 *
 * TODO: PRODUCTION — Remove this. Use apiLogin() from ./api.ts instead.
 */
export function demoLogin(email: string, password: string): { success: boolean; user?: UserProfile; message?: string } {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) return { success: false, message: "Please enter your email address." };
  if (!password || password.length < 4) return { success: false, message: "Password must be at least 4 characters." };

  // Check demo accounts
  if (cleanEmail === DEMO_USERS.pro.email) {
    saveDemoSession(DEMO_USERS.pro);
    return { success: true, user: DEMO_USERS.pro, message: "Welcome back, Alex!" };
  }
  if (cleanEmail === DEMO_USERS.free.email) {
    saveDemoSession(DEMO_USERS.free);
    return { success: true, user: DEMO_USERS.free, message: "Welcome back, Sarah!" };
  }

  // Accept any valid-looking email for demo purposes
  const nameFromEmail = cleanEmail.split("@")[0].replace(/[._-]/g, " ");
  const formattedName = nameFromEmail
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const user: UserProfile = {
    id: Date.now(),
    name: formattedName || "PDFora User",
    email: cleanEmail,
    is_active: true,
    created_at: new Date().toISOString(),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
    plan: "pro",
    aiCredits: 500,
    maxAiCredits: 500,
  };

  saveDemoSession(user);
  return { success: true, user, message: `Welcome, ${user.name}!` };
}

/**
 * Demo signup.
 *
 * TODO: PRODUCTION — Remove this. Use apiRegister() from ./api.ts instead.
 */
export function demoSignup(name: string, email: string, password: string): { success: boolean; user?: UserProfile; message?: string } {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName) return { success: false, message: "Please enter your full name." };
  if (!cleanEmail || !cleanEmail.includes("@")) return { success: false, message: "Please enter a valid email." };
  if (!password || password.length < 6) return { success: false, message: "Password must be at least 6 characters." };

  const user: UserProfile = {
    id: Date.now(),
    name: cleanName,
    email: cleanEmail,
    is_active: true,
    created_at: new Date().toISOString(),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
    plan: "pro",
    aiCredits: 1000,
    maxAiCredits: 1000,
  };

  saveDemoSession(user);
  return { success: true, user, message: `Account created! Welcome, ${user.name}.` };
}

/**
 * Demo Google sign-in simulator.
 * This is NOT real Google OAuth — it creates a demo profile.
 *
 * TODO: PRODUCTION — Replace with Google Identity Services / OAuth 2.0.
 * See: https://developers.google.com/identity/gsi/web/guides/overview
 */
export function demoGoogleSignIn(customEmail?: string, customName?: string): { success: boolean; user?: UserProfile; message?: string } {
  const cleanEmail = (customEmail || "demo.google@gmail.com").trim().toLowerCase();

  let name = customName?.trim();
  if (!name) {
    const rawPrefix = cleanEmail.split("@")[0].replace(/[._-]/g, " ");
    name = rawPrefix
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  if (!name) name = "Google User";

  const user: UserProfile = {
    id: Date.now(),
    name,
    email: cleanEmail,
    is_active: true,
    created_at: new Date().toISOString(),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
    plan: "pro",
    aiCredits: 1000,
    maxAiCredits: 1000,
  };

  saveDemoSession(user);
  return { success: true, user, message: `Signed in with Google as ${user.email}` };
}

/**
 * Clear demo session.
 */
export function demoClearSession(): void {
  saveDemoSession(null);
}
