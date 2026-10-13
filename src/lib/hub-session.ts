/**
 * Sessão local do ZAIVON — preparação para auth futura.
 * Não altera banco nem autenticação de servidor; apenas sessionStorage no cliente.
 */

const STORAGE_KEY = "zaivon-session";

export interface HubSession {
  email: string;
  name?: string;
  signedInAt: number;
}

export function markHubSession(session: Omit<HubSession, "signedInAt">): void {
  if (typeof window === "undefined") return;
  const payload: HubSession = { ...session, signedInAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getHubSession(): HubSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HubSession;
  } catch {
    return null;
  }
}

export function clearHubSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
