// ============================================================
// tracking.ts — client-safe. Dispara eventos de analytics/teste A/B sem
// nunca travar a experiência do visitante: toda chamada é "fire and forget"
// (erro de rede é ignorado). Usa sessionStorage pra manter o mesmo
// session_id entre o quiz e a /oferta (mesma aba).
// ============================================================

const SESSION_KEY = "quiz_session_id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function post(url: string, body: unknown) {
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // navegador sem fetch/keepalive nesse contexto — ignora, nunca bloqueia o funil
  }
}

/** Chamar uma vez quando o quiz carrega (mesma sessão nunca duplica — unique key no banco). */
export function trackSession(quizId: string, variantId?: string | null) {
  if (!quizId) return;
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  post("/api/track/session", {
    quizId,
    sessionId,
    variantId: variantId ?? null,
    referrer: document.referrer || undefined,
    userAgent: navigator.userAgent,
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    utm,
  });
}

/** 'view' quando a headline aparece, 'cta_click' quando o visitante avança pra 1ª pergunta. */
export function trackHeadlineEvent(variantId: string, eventType: "view" | "cta_click") {
  if (!variantId) return;
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;
  post("/api/track/headline-event", { variantId, sessionId, eventType });
}

/** Evento genérico do funil: 'screen_view', 'lead_submitted', 'checkout_click', etc. */
export function trackEvent(
  quizId: string,
  eventType: string,
  extra?: { screenId?: string; stepIndex?: number; data?: Record<string, unknown> }
) {
  if (!quizId) return;
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;
  post("/api/track/event", { quizId, sessionId, eventType, ...extra });
}
