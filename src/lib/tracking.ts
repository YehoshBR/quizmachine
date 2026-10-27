// ============================================================
// tracking.ts — client-safe. Dispara eventos de analytics/teste A/B sem
// nunca travar a experiência do visitante: toda chamada é "fire and forget"
// (erro de rede é ignorado). Usa sessionStorage pra manter o mesmo
// session_id entre o quiz e a /oferta (mesma aba).
// ============================================================

const SESSION_KEY = "quiz_session_id";
const TEST_KEY = "quiz_teste";
const QUEUE_KEY = "quiz_track_fila";
const QUEUE_MAX = 60;

/**
 * Sessão de teste: abrir o quiz com `?teste=1` marca a aba inteira (quiz + oferta) como teste,
 * e o relatório de abandono ignora essas sessões. `?teste=0` desmarca.
 */
export function isTestSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search).get("teste");
    if (p === "1") sessionStorage.setItem(TEST_KEY, "1");
    if (p === "0") sessionStorage.removeItem(TEST_KEY);
    return sessionStorage.getItem(TEST_KEY) === "1";
  } catch {
    return false;
  }
}

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

type Pendente = { url: string; body: unknown };

function lerFila(): Pendente[] {
  try {
    return JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]") as Pendente[];
  } catch {
    return [];
  }
}

function gravarFila(fila: Pendente[]) {
  try {
    if (fila.length) sessionStorage.setItem(QUEUE_KEY, JSON.stringify(fila.slice(-QUEUE_MAX)));
    else sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    /* sessionStorage cheio/bloqueado — perde só o reenvio */
  }
}

function enviar(item: Pendente) {
  try {
    fetch(item.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.body),
      keepalive: true,
    })
      .then((res) => {
        // 5xx = o servidor não gravou (ex.: banco fora): guarda pra reenviar. 4xx = payload inválido, descarta.
        if (res.status >= 500) gravarFila([...lerFila(), item]);
      })
      .catch(() => gravarFila([...lerFila(), item]));
  } catch {
    // navegador sem fetch/keepalive nesse contexto — ignora, nunca bloqueia o funil
  }
}

/**
 * Fire and forget, com reenvio: evento que falhou (rede do celular caiu, servidor reiniciando)
 * fica numa fila na aba e vai junto no próximo evento. Cada evento leva o horário do clique (`ts`),
 * então o reenvio atrasado não bagunça o tempo por tela.
 */
function post(url: string, body: unknown) {
  if (typeof window === "undefined") return;
  const fila = lerFila();
  if (fila.length) {
    gravarFila([]);
    fila.forEach(enviar);
  }
  enviar({ url, body });
}

/** A aba já passou pelo quiz (tem sessão)? Quem abre a /oferta direto pelo link não tem. */
export function hasSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return false;
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
    isTest: isTestSession(),
  });
}

/** 'view' quando a headline aparece, 'cta_click' quando o visitante avança pra 1ª pergunta. */
export function trackHeadlineEvent(variantId: string, eventType: "view" | "cta_click") {
  if (!variantId) return;
  const sessionId = getOrCreateSessionId();
  if (!sessionId) return;
  post("/api/track/headline-event", { variantId, sessionId, eventType });
}

/** Evento padrão do Pixel da Meta (só dispara se o quiz tiver facebookPixelId configurado no painel). */
export function pixelEvent(name: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  try {
    fbq?.("track", name, data ?? {});
  } catch {
    /* pixel nunca trava o funil */
  }
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
  post("/api/track/event", { quizId, sessionId, eventType, ts: Date.now(), isTest: isTestSession(), ...extra });
  if (eventType === "checkout_click") pixelEvent("InitiateCheckout", { currency: "BRL", ...(extra?.data?.plano ? { content_name: String(extra.data.plano) } : {}) });
}
