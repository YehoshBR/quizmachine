// ============================================================
// auth-internal.ts — SEMPRE server-only.
// ============================================================
// Nunca importe este arquivo de uma rota de página (createFileRoute com
// component) nem de admin-api.ts — só de dentro de handlers de
// createServerFn (auth.ts) ou de rotas de API puras (src/routes/api/**),
// que nunca entram no bundle do cliente. Importar isto de um arquivo que
// o cliente também usa quebra o build (node:crypto não existe no browser).
// ============================================================
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { getCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "quiz_admin_session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return secret;
}

export function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function isAuthenticated(): boolean {
  const token = getCookie(COOKIE_NAME);
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (sign(payload) !== sig) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

/** Gera o par salt:hash pra colocar em ADMIN_PASSWORD_HASH (uso manual, uma vez). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export { COOKIE_NAME };
