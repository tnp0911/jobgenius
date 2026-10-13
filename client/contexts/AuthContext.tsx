"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { handleRefreshToken } from "@/auth/api";
import { getCurrentUser } from "@/services/userService";
import { getUserPlan } from "@/services/userService";

export type AuthStatus = {
  status: "loading" | "authenticated" | "unauthenticated";
  verified: boolean;
};

const AUTH_STATUS_STORAGE_KEY = "jobgenius_auth_status";
/** Access JWT TTL is 15 minutes — refresh slightly early to avoid expiry races. */
const ACCESS_TOKEN_REFRESH_MS = 14 * 60 * 1000;
/** Skip tab-focus refresh if we refreshed recently (avoids refresh-token rotation races). */
const MIN_VISIBILITY_REFRESH_GAP_MS = 2 * 60 * 1000;

export type AuthContextValue = {
  status: AuthStatus;
  tier: string | null;
  refreshAuth: () => Promise<AuthStatus>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredStatus(): AuthStatus | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(AUTH_STATUS_STORAGE_KEY);
  const parsed = stored ? JSON.parse(stored) : null;
  if (parsed?.status === "authenticated" || parsed?.status === "unauthenticated") {
    return {
      status: parsed.status,
      // Only an explicit false means unverified; missing/legacy cache must not open the modal.
      verified: parsed.verified !== false,
    };
  }
  return null;
}

/** True only for signed-in users who still need email verification. */
export function needsEmailVerification(status: AuthStatus): boolean {
  return status.status === "authenticated" && status.verified === false;
}

function persistStatus(status: AuthStatus) {
  if (typeof window === "undefined" || status.status === "loading") return;
  sessionStorage.setItem(AUTH_STATUS_STORAGE_KEY, JSON.stringify(status));
}

function clearStoredStatus() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_STATUS_STORAGE_KEY);
}

const AUTH_RESOLVE_TIMEOUT_MS = 4000;

async function resolveAuthStatus(): Promise<AuthStatus> {
  try {
    const user = await Promise.race([
      getCurrentUser(),
      new Promise<never>((_, reject) => {
        window.setTimeout(
          () => reject(new Error("Auth check timed out")),
          AUTH_RESOLVE_TIMEOUT_MS,
        );
      }),
    ]);
    return user ? {
        status: "authenticated",
        verified: user.emailVerified,
      } : {
        status: "unauthenticated",
        verified: false,
      };
  } catch {
    return {
      status: "unauthenticated",
      verified: false,
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Always "loading" on first render so SSR and client markup match (no sessionStorage in useState).
  const [status, setStatus] = useState<AuthStatus>({ status: "loading", verified: false });
  const [tier, setTier] = useState<string | null>(null);
  const initialFetchDoneRef = useRef(false);
  const fetchInFlightRef = useRef<Promise<AuthStatus> | null>(null);
  const tokenRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastTokenRefreshAtRef = useRef(0);

  const markLoggedOut = useCallback(() => {
    clearStoredStatus();
    setStatus({ status: "unauthenticated", verified: false });
    setTier(null);
  }, []);

  const refreshAuth = useCallback(async (): Promise<AuthStatus> => {
    if (fetchInFlightRef.current) {
      return fetchInFlightRef.current;
    }

    const run = (async () => {
      const next = await resolveAuthStatus();
      setStatus(next);
      persistStatus(next);
      if (next.status === "authenticated") {
        const nextTier = await getUserPlan();
        setTier(nextTier);
      } else {
        setTier(null);
      }
      return next;
    })();

    fetchInFlightRef.current = run;
    try {
      return await run;
    } finally {
      fetchInFlightRef.current = null;
    }
  }, []);

  const refreshAccessToken = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const now = Date.now();
      if (
        !force &&
        now - lastTokenRefreshAtRef.current < MIN_VISIBILITY_REFRESH_GAP_MS
      ) {
        return;
      }

      if (tokenRefreshInFlightRef.current) {
        await tokenRefreshInFlightRef.current;
        return;
      }

      const run = (async () => {
        try {
          await handleRefreshToken();
          lastTokenRefreshAtRef.current = Date.now();
        } catch {
          // Refresh can fail from token-rotation races while cookies are still valid.
          // Only clear the UI session if the access cookie also fails.
          const stillAuthed = (await resolveAuthStatus()).status === "authenticated";
          if (stillAuthed) {
            lastTokenRefreshAtRef.current = Date.now();
            return;
          }
          markLoggedOut();
        }
      })();

      tokenRefreshInFlightRef.current = run;
      try {
        await run;
      } finally {
        tokenRefreshInFlightRef.current = null;
      }
    },
    [markLoggedOut],
  );

  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;

    const stored = readStoredStatus();
    if (stored) {
      setStatus(stored);
      void refreshAuth(); // void is used to avoid the warning of async function in useEffect
      return;
    }

    void (async () => {
      const next = await resolveAuthStatus();
      setStatus(next);
      persistStatus(next);
      if (next.status === "authenticated") {
        const nextTier = await getUserPlan();
        setTier(nextTier);
      } else {
        setTier(null);
      }
    })();
  }, [refreshAuth]);

  // Keep access token fresh while the user stays authenticated.
  useEffect(() => {
    if (status.status !== "authenticated") return;

    // Interval must refresh even within the visibility gap.
    const intervalId = window.setInterval(() => {
      void refreshAccessToken({ force: true });
    }, ACCESS_TOKEN_REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshAccessToken({ force: false });
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, refreshAccessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, tier, refreshAuth }),
    [status, tier, refreshAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      <div suppressHydrationWarning>
        {children}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function clearAuthSession(): void {
  clearStoredStatus();
}
