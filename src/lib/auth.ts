// ============================================================
// auth.ts — superfície client-safe da sessão do painel
// ============================================================
// Só exporta server functions (createServerFn) — seguro pra importar de
// componentes de página (login.tsx, admin/index.tsx). A lógica que usa
// node:crypto mora em auth-internal.ts e NUNCA deve ser importada direto
// daqui de fora — sempre passe por login/logout/checkAuth.
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { setCookie, deleteCookie } from "@tanstack/react-start/server";
import { sign, verifyPassword, isAuthenticated as _isAuthenticated, COOKIE_NAME } from "./auth-internal";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias

export const login = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!data || typeof data !== "object" || typeof (data as { password?: unknown }).password !== "string") {
      throw new Error("invalid_input");
    }
    return data as { password: string };
  })
  .handler(async ({ data }) => {
    if (!verifyPassword(data.password)) {
      return { ok: false as const, error: "senha incorreta" };
    }
    const exp = Date.now() + SESSION_TTL_MS;
    const payload = `${exp}`;
    const token = `${payload}.${sign(payload)}`;
    setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS / 1000,
      path: "/",
    });
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(COOKIE_NAME, { path: "/" });
  return { ok: true as const };
});

/** Única forma segura de checar sessão a partir de código que também roda no cliente. */
export const checkAuth = createServerFn({ method: "GET" }).handler(async () => {
  return { authenticated: _isAuthenticated() };
});
