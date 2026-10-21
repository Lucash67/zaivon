/** Conta que mantém o ZAIVON Business aberto. As demais veem o produto em desenvolvimento. */
const ZAIVON_OWNER_EMAIL = "lucashcampos667@gmail.com";

export function isZaivonOwner(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ZAIVON_OWNER_EMAIL;
}

/**
 * Rotas que qualquer conta autenticada pode abrir.
 * `/financeiro` é do Business e não entra aqui.
 */
export function isSharedZaivonPath(pathname: string): boolean {
  const prefixes = [
    "/hub",
    "/em-breve",
    "/finance",
    "/schedule",
    "/crm",
    "/api/finance",
    "/api/schedule",
    "/api/crm",
    "/api/auth",
    "/login",
    "/onboarding",
    "/agendar",
    "/agendamento",
  ];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
