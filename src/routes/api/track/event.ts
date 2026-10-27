// Evento genérico do funil: screen_view, lead_submitted, checkout_click, etc.
// Endpoint público (chamado pelo próprio quiz) — validação defensiva.
import { createFileRoute } from "@tanstack/react-router";
import { insertQuizEvent } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_TYPE_RE = /^[a-z0-9_]{1,40}$/;

function jsonSizeOk(data: unknown): boolean {
  try {
    return JSON.stringify(data ?? {}).length <= 4000;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/track/event")({
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
        const eventType = typeof b.eventType === "string" && EVENT_TYPE_RE.test(b.eventType) ? b.eventType : null;
        if (!quizId || !sessionId || !eventType) return Response.json({ ok: false }, { status: 400 });
        const data = b.data && typeof b.data === "object" ? (b.data as Record<string, unknown>) : undefined;
        if (!jsonSizeOk(data)) return Response.json({ ok: false }, { status: 400 });
        // Horário do clique no navegador (evento reenviado chega atrasado). Só aceita até 24h
        // pra trás e nunca no futuro; fora disso vale o horário do servidor.
        const agora = Date.now();
        const ts = typeof b.ts === "number" && b.ts <= agora && b.ts > agora - 86_400_000 ? new Date(b.ts) : undefined;

        try {
          await insertQuizEvent({
            quizId,
            sessionId,
            eventType,
            screenId: typeof b.screenId === "string" ? b.screenId.slice(0, 100) : undefined,
            stepIndex: typeof b.stepIndex === "number" ? Math.trunc(b.stepIndex) : undefined,
            data,
            createdAt: ts,
            isTest: b.isTest === true,
          });
        } catch (err) {
          console.error("[api/track/event] falha:", err);
          // 500 faz o navegador guardar o evento e reenviar no próximo
          return Response.json({ ok: false }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
