import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isRelattoActiveProfile } from "@/lib/appSurface";
import { getApiBaseUrl } from "@/lib/api/apiConfig";
import { createV2MigrationApiPort } from "./apiV2MigrationDestinationPort";
import { consumeMigrationFragment, receiveV2Migration } from "./receiveV2Migration";
import {
  captureMigrationArrival,
  clearPendingMigrationCode,
  isV2MigrationReceiverEnabled,
  readPendingMigrationCode,
} from "./migrationArrival";

type Status = "idle" | "waiting-login" | "checking" | "complete" | "failed";

/**
 * New App side only. Automatically captures the handoff from /baixar,
 * survives a normal login and falls back to server discovery after iOS install.
 * All live calls remain feature-gated until authenticated backend + real
 * offline cache hydration have passed QA. Never touches the source PWA.
 */
export function V2DestinationMigrationBootstrap() {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [retries, setRetries] = useState(0);
  const attempted = useRef("");
  const enabled =
    typeof window !== "undefined" &&
    isV2MigrationReceiverEnabled(
      window.location.origin,
      import.meta.env.VITE_CONSUBOV_V2_MIGRATION_ENABLED,
      isRelattoActiveProfile(location.search) || location.pathname.startsWith("/relatto"),
    );

  // Layout effect captures the fragment before /baixar's passive navigation
  // moves a freshly installed App to /login.
  useLayoutEffect(() => {
    if (!enabled) return;
    const clearFragment = () => {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    };
    let pending: string | null = null;
    try {
      pending = captureMigrationArrival(
        window.location.href,
        clearFragment,
        window.sessionStorage,
      );
    } catch {
      pending = consumeMigrationFragment(window.location.href, clearFragment);
    }
    if (pending) {
      setCode(pending);
      setStatus("waiting-login");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const retryWhenConnected = () => setRetries((value) => value + 1);
    window.addEventListener("online", retryWhenConnected);
    return () => window.removeEventListener("online", retryWhenConnected);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || loading || !user || !session?.access_token) return;
    if (!navigator.onLine) {
      if (code) setStatus("failed");
      return;
    }

    let pendingCode = code;
    try { pendingCode ||= readPendingMigrationCode(window.sessionStorage); }
    catch { /* Safari storage restrictions; backend can discover after login. */ }

    const attemptKey = user.id + "|" + (pendingCode ?? "") + "|" + retries;
    if (attempted.current === attemptKey) return;
    attempted.current = attemptKey;
    let cancelled = false;

    if (pendingCode) setStatus("checking");
    const port = createV2MigrationApiPort({
      baseUrl: getApiBaseUrl(),
      getAccessToken: async () => session.access_token,
      // Do NOT fake hydrateVerifiedData. No completed migration may be
      // acknowledged until domain adapters persist and verify the real data.
    });

    void receiveV2Migration(
      { origin: window.location.origin, code: pendingCode },
      port,
    ).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        try { clearPendingMigrationCode(window.sessionStorage); } catch { /* ignore */ }
        setCode(null);
        setStatus("complete");
      } else if ("code" in result && result.code === "NO_HANDOFF" && !pendingCode) {
        setStatus("idle");
      } else if ("code" in result && result.code === "LOGIN_REQUIRED") {
        setStatus("waiting-login");
      } else {
        // Never tell the user that transfer is complete without real ACK.
        setStatus(pendingCode ? "failed" : "idle");
      }
    });

    return () => { cancelled = true; };
  }, [code, enabled, loading, retries, session?.access_token, user]);

  if (!enabled || status === "idle") return null;

  const text = {
    "waiting-login": "Entre na sua conta. Depois verificaremos a transferência dos seus dados.",
    checking: "Conferindo a transferência dos seus dados para o CONSUBOV 2.0…",
    complete: "Transferência verificada. Você já pode utilizar o CONSUBOV 2.0.",
    failed: "Não foi possível confirmar a transferência. Seus dados continuam preservados no aplicativo antigo.",
    idle: "",
  }[status];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="v2-destination-migration-status"
      className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-lg rounded-xl border border-border bg-background p-3 text-center text-sm font-medium text-foreground shadow-lg"
    >
      {text}
    </div>
  );
}
