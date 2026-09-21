// Lê a narrativa do quiz (telas + opções) e devolve uma sugestão de
// biblioteca de dores/desejos + quais opções ativam cada sinal — pra não
// precisar montar isso à mão. Sempre revisável no painel antes de salvar.
import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth-internal";
import { callLlm, extractJson } from "@/lib/llm-internal";

const SYSTEM_PROMPT = `Você analisa a narrativa de um quiz de vendas (quiz funnel) e identifica as
dores e desejos que ele usa pra persuadir o lead. Sua tarefa: ler as telas e opções, e devolver:

1. Uma "signalLibrary": 5 a 10 sinais (mistura de dores e desejos), cada um com:
   - "key": código curto em snake_case (ex: "pain_falta_de_tempo", "desire_liberdade_financeira")
   - "kind": "pain" ou "desire"
   - "label": nome curto pra identificação humana
   - "headline": frase de 5-12 palavras pra usar na página de oferta quando esse for o sinal
     dominante do visitante. Use *palavra* pra destacar a palavra-chave (vira negrito).
   - "body": 1-2 frases desenvolvendo esse sinal, tom direto e pessoal ("você").

2. Uma "tags": objeto { "<screenId>": { "<optionValue>": ["signal_key", ...] } } — pra cada tela
   do tipo "single" ou "intro" (campo firstOptions) cujas opções sinalizam claramente uma dor ou
   desejo específico, mapeie CADA opção pra 0, 1 ou 2 sinais da biblioteca. NUNCA marque opções
   puramente demográficas ou neutras (idade, gênero, tempo disponível, "não sei") — só marque
   quando a opção revela uma dor/desejo real. Está tudo bem deixar uma tela inteira sem tags.

Responda APENAS com um JSON válido no formato:
{"signalLibrary": {"<key>": {"kind": "pain"|"desire", "label": "...", "headline": "...", "body": "..."}}, "tags": {"<screenId>": {"<optionValue>": ["<key>"]}}}

Sem markdown, sem comentário, sem texto antes ou depois do JSON.`;

type ExtractResult = {
  signalLibrary: Record<string, { kind: "pain" | "desire"; label: string; headline: string; body: string }>;
  tags: Record<string, Record<string, string[]>>;
};

export const Route = createFileRoute("/api/admin/extract-signals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated()) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const b = (body ?? {}) as Record<string, unknown>;
        const screens = Array.isArray(b.screens) ? b.screens : null;
        if (!screens || screens.length === 0) {
          return Response.json({ ok: false, error: "envie as telas do quiz (screens) pra analisar" }, { status: 400 });
        }
        const product = b.product && typeof b.product === "object" ? (b.product as Record<string, unknown>) : {};

        // Só manda o que interessa pro modelo (headline/question/options) — reduz tokens e ruído.
        const slim = (screens as Record<string, unknown>[]).map((s) => {
          const out: Record<string, unknown> = { id: s.id, type: s.type };
          if (typeof s.headline === "string") out.headline = s.headline;
          if (typeof s.question === "string") out.question = s.question;
          if (typeof s.title === "string") out.title = s.title;
          if (Array.isArray(s.options)) out.options = (s.options as Record<string, unknown>[]).map((o) => ({ value: o.value, label: o.label }));
          if (Array.isArray(s.firstOptions)) out.firstOptions = (s.firstOptions as Record<string, unknown>[]).map((o) => ({ value: o.value, label: o.label }));
          return out;
        });

        const userMessage = JSON.stringify({ product, screens: slim });
        const result = await callLlm(SYSTEM_PROMPT, userMessage, 3000);
        if (!result.ok) {
          return Response.json({ ok: false, error: result.error }, { status: 502 });
        }
        const parsed = extractJson<ExtractResult>(result.text);
        if (!parsed || !parsed.signalLibrary) {
          return Response.json({ ok: false, error: "A IA não devolveu um JSON reconhecível. Tente de novo." }, { status: 502 });
        }
        return Response.json({ ok: true, signalLibrary: parsed.signalLibrary, tags: parsed.tags ?? {} });
      },
    },
  },
});
