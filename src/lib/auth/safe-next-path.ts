import { ZAIVON_HUB_PATH } from "@/constants/zaivon-products";
import { ZAIVON_ONBOARDING_PATH } from "@/lib/zaivon-onboarding";

/**
 * Destino após login/cadastro ZAIVON (única autenticação).
 * - Sem `next` → Hub.
 * - Com `next` (deep link / rota protegida) → rota solicitada.
 */
export function resolvePostLoginPath(next: string | null | undefined): string {
  if (!next) return ZAIVON_HUB_PATH;

  const path = next.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return ZAIVON_HUB_PATH;
  if (path.includes("://") || path.includes("\\")) return ZAIVON_HUB_PATH;
  if (path.startsWith("/login") || path.startsWith("/api/")) return ZAIVON_HUB_PATH;
  if (path === ZAIVON_ONBOARDING_PATH || path.startsWith(`${ZAIVON_ONBOARDING_PATH}/`)) {
    return ZAIVON_HUB_PATH;
  }

  return path;
}
