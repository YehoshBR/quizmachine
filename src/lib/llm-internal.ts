// ============================================================
// llm-internal.ts — SEMPRE server-only. Chama a API da Anthropic direto via
// fetch (sem SDK) pra tarefas de geração/análise de texto no servidor
// (extração de dores/desejos, geração de headline pro teste A/B).
//
// Requer ANTHROPIC_API_KEY em .env.production — conta separada da sessão do
// Claude Code, pega em https://console.anthropic.com/settings/keys. Sem a
// chave configurada, retorna erro claro em vez de quebrar o painel.
// ============================================================
const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

export type LlmResult = { ok: true; text: string } | { ok: false; error: string };

export async function callAnthropic(system: string, userMessage: string, maxTokens = 2000): Promise<LlmResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY não configurada no servidor (.env.production)." };
  }
  try {
    const res = await fetch(ANTHROPIC_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Anthropic API respondeu HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    if (!text) return { ok: false, error: "Anthropic API respondeu sem texto." };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `Falha ao chamar a Anthropic API: ${(err as Error).message}` };
  }
}

/** Extrai o primeiro bloco JSON de uma resposta (tolera ```json cercas e texto em volta). */
export function extractJson<T>(text: string): T | null {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) candidate = fenced[1];
  const start = candidate.indexOf("{");
  const arrStart = candidate.indexOf("[");
  const useArr = arrStart !== -1 && (start === -1 || arrStart < start);
  const openChar = useArr ? "[" : "{";
  const closeChar = useArr ? "]" : "}";
  const from = useArr ? arrStart : start;
  if (from === -1) return null;
  let depth = 0;
  for (let i = from; i < candidate.length; i++) {
    if (candidate[i] === openChar) depth++;
    else if (candidate[i] === closeChar) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(from, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
