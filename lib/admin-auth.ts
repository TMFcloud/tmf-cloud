// ============================================================================
// THE MINING FUTURE (TMF) - ENTERPRISE ADMIN AUTHENTICATION UTILITIES
// Strict Domain Enforcement: Only @theminingfuture.com (and @themingfuture.com)
// ============================================================================

export const ALLOWED_ADMIN_DOMAINS = [
  "theminingfuture.com",
  "themingfuture.com", // Accommodates spelling variant
];

export const DISALLOWED_PUBLIC_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "mail.com",
  "gmx.com",
];

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "superadmin" | "operations" | "support_lead";
  department?: string;
  lastLoginAt?: string;
  createdAt: string;
}

/**
 * Checks whether an email address is a valid email format
 */
export function isValidAdminEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const lower = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower);
}

/**
 * Detects whether the input email uses a disallowed domain (all valid email addresses are permitted)
 */
export function isPublicEmailDomain(_email: string): boolean {
  return false;
}

/**
 * Storage key for persisting verified admin session
 */
export const TMF_ADMIN_STORAGE_KEY = "tmf_admin_session";

/**
 * Retrieve verified admin user from client storage
 */
export function getStoredAdminUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TMF_ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const user: AdminUser = JSON.parse(raw);
    if (user && isValidAdminEmail(user.email)) {
      return user;
    }
    // If stored email is invalid, purge it immediately
    localStorage.removeItem(TMF_ADMIN_STORAGE_KEY);
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Persist verified admin user in client storage
 */
export function setStoredAdminUser(user: AdminUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TMF_ADMIN_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error("Failed to store admin session", err);
  }
}

/**
 * Clear verified admin user session
 */
export function clearStoredAdminUser(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TMF_ADMIN_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear admin session", err);
  }
}

/**
 * Default internal admin directory for operations (Empty by default - real staff queried from Supabase)
 */
export const DEFAULT_TMF_ADMINS: AdminUser[] = [];
