// Registra 1 linha por (quiz, session_id) — chamado pelo próprio quiz público,
// sem autenticação. Validação defensiva porque é endpoint aberto.
import { createFileRoute } from "@tanstack/react-router";
import { upsertQuizSession } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STR = 500;

export const Route = createFileRoute("/api/track/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const quizId = typeof b.quizId === "string" && UUID_RE.test(b.quizId) ? b.quizId : null;
        const sessionId = typeof b.sessionId === "string" ? b.sessionId.slice(0, 100) : null;
        if (!quizId || !sessionId) return Response.json({ ok: false }, { status: 400 });
        const variantId = typeof b.variantId === "string" && UUID_RE.test(b.variantId) ? b.variantId : null;

        try {
          await upsertQuizSession({
            quizId,
            sessionId,
            variantId,
            deviceType: typeof b.deviceType === "string" ? b.deviceType.slice(0, 20) : undefined,
            userAgent: typeof b.userAgent === "string" ? b.userAgent.slice(0, MAX_STR) : undefined,
            referrer: typeof b.referrer === "string" ? b.referrer.slice(0, MAX_STR) : undefined,
            utm: b.utm && typeof b.utm === "object" ? (b.utm as Record<string, unknown>) : undefined,
          });
        } catch (err) {
          console.error("[api/track/session] falha:", err);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
