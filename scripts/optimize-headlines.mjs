#!/usr/bin/env node
// ============================================================
// optimize-headlines.mjs — roda 1x por dia via systemd timer na VPS.
// Script standalone (não passa pelo Vite) — conecta direto no Postgres com
// DATABASE_URL do .env.production. Pra cada quiz publicado com 2+ variantes
// de headline:
//   1. Calcula CTR (view->cta_click) e, quando há dado suficiente, taxa de
//      lead e de clique em checkout por variante.
//   2. Pausa variantes claramente perdendo (evita desperdiçar tráfego).
//   3. Se OPENAI_API_KEY estiver configurada, gera 1 headline nova
//      inspirada na vencedora, pra manter o teste sempre rodando.
// Nunca lança — problema numa etapa vira log e segue pro próximo quiz.
// ============================================================
import pg from "pg";

const MIN_SAMPLE = 30; // views mínimas antes de decidir qualquer coisa sobre uma variante
const LOSER_RATIO = 0.6; // variante com métrica <= 60% da líder é considerada perdedora
const MAX_ACTIVE_VARIANTS = 3; // não deixa crescer sem limite
const OPENAI_API_BASE = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function log(...args) {
  console.log(`[optimize-headlines] ${new Date().toISOString()}`, ...args);
}

async function callLlm(system, userMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(OPENAI_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      log("OpenAI API respondeu HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.indexOf("{");
    if (start === -1) return null;
    return JSON.parse(candidate.slice(start, candidate.lastIndexOf("}") + 1));
  } catch (err) {
    log("falha ao chamar OpenAI:", err.message);
    return null;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    log("DATABASE_URL não configurado — nada a fazer.");
    return;
  }
  const pool = new pg.Pool({ connectionString, max: 3 });

  try {
    const { rows: quizzes } = await pool.query(
      `select id, name, quiz_meta from quizzes where status = 'published'`
    );
    log(`${quizzes.length} quiz(zes) publicado(s) pra avaliar.`);

    for (const quiz of quizzes) {
      try {
        await processQuiz(pool, quiz);
      } catch (err) {
        log(`falha ao processar quiz ${quiz.id} (${quiz.name}), seguindo pro próximo:`, err.message);
      }
    }
  } finally {
    await pool.end();
  }
}

async function processQuiz(pool, quiz) {
  const { rows: variants } = await pool.query(
    `select * from headline_variants where quiz_id = $1 order by created_at asc`,
    [quiz.id]
  );
  if (variants.length < 2) return; // sem teste rodando — nada a otimizar

  const { rows: statRows } = await pool.query(
    `select
       v.id as variant_id,
       count(distinct case when he.event_type = 'view' then he.id end) as views,
       count(distinct case when he.event_type = 'cta_click' then he.id end) as cta_clicks,
       count(distinct case when qe.event_type = 'lead_submitted' then qe.id end) as leads,
       count(distinct case when qe.event_type = 'checkout_click' then qe.id end) as checkout_clicks
     from headline_variants v
     left join headline_events he on he.variant_id = v.id
     left join quiz_sessions qs on qs.variant_id = v.id
     left join quiz_events qe on qe.quiz_id = qs.quiz_id and qe.session_id = qs.session_id
     where v.quiz_id = $1
     group by v.id`,
    [quiz.id]
  );
  const statsById = new Map(statRows.map((r) => [r.variant_id, r]));

  const stats = variants.map((v) => {
    const r = statsById.get(v.id) ?? {};
    const views = Number(r.views ?? 0);
    const ctaClicks = Number(r.cta_clicks ?? 0);
    const leads = Number(r.leads ?? 0);
    const checkoutClicks = Number(r.checkout_clicks ?? 0);
    return { variant: v, views, ctaClicks, leads, checkoutClicks };
  });

  const totalCheckouts = stats.reduce((s, x) => s + x.checkoutClicks, 0);
  const totalLeads = stats.reduce((s, x) => s + x.leads, 0);
  // Métrica de decisão: usa o funil mais fundo que já tem volume — checkout > lead > CTR.
  const metricOf = (s) =>
    totalCheckouts >= 10 ? (s.views > 0 ? s.checkoutClicks / s.views : 0) :
    totalLeads >= 15 ? (s.views > 0 ? s.leads / s.views : 0) :
    (s.views > 0 ? s.ctaClicks / s.views : 0);

  const eligible = stats.filter((s) => s.views >= MIN_SAMPLE && !s.variant.is_paused);
  log(`quiz ${quiz.id} (${quiz.name}): ${variants.length} variante(s), ${eligible.length} com amostra suficiente.`);
  for (const s of stats) {
    log(`  - "${s.variant.label}" views=${s.views} clicks=${s.ctaClicks} leads=${s.leads} checkout=${s.checkoutClicks} paused=${s.variant.is_paused}`);
  }

  if (eligible.length < 2) return; // ainda não dá pra comparar com confiança

  const leader = eligible.reduce((a, b) => (metricOf(b) > metricOf(a) ? b : a));
  const leaderMetric = metricOf(leader);
  if (leaderMetric <= 0) return;

  const activeNonLeaderCount = () => stats.filter((s) => !s.variant.is_paused).length;

  for (const s of eligible) {
    if (s.variant.id === leader.variant.id) continue;
    const ratio = metricOf(s) / leaderMetric;
    if (ratio <= LOSER_RATIO && activeNonLeaderCount() > 1) {
      await pool.query(`update headline_variants set is_paused = true, updated_at = now() where id = $1`, [s.variant.id]);
      log(`  ⏸ pausando "${s.variant.label}" (métrica ${Math.round(ratio * 100)}% da líder "${leader.variant.label}")`);
    }
  }

  const activeCount = stats.filter((s) => !s.variant.is_paused).length + (leader.variant.is_paused ? 1 : 0);
  if (activeCount >= MAX_ACTIVE_VARIANTS) return;
  if (!process.env.OPENAI_API_KEY) {
    log(`  (OPENAI_API_KEY não configurada — pulando geração de nova variante)`);
    return;
  }

  const product = quiz.quiz_meta?.product;
  const system = `Você escreve headlines pra tela de abertura de quizzes de vendas (quiz funnel).
Regras: MAIÚSCULO, direto, fala com a dor/desejo do público, 8-16 palavras. Responda APENAS
com JSON: {"headline": "...", "subheadline": "..."} — sem markdown, sem texto extra.`;
  const userMessage = JSON.stringify({
    produto: product?.name,
    promessa: product?.promise,
    headline_vencedora_atual: leader.variant.headline,
    instrucao: "Gere UMA nova variante de headline inspirada na vencedora acima, mas com ângulo diferente (não repita as mesmas palavras), pra testar contra ela.",
  });
  const generated = await callLlm(system, userMessage);
  if (!generated?.headline) {
    log(`  falha ao gerar nova variante via IA.`);
    return;
  }
  const label = `auto-${new Date().toISOString().slice(0, 10)}`;
  await pool.query(
    `insert into headline_variants (quiz_id, label, headline, subheadline) values ($1,$2,$3,$4)`,
    [quiz.id, label, generated.headline, generated.subheadline ?? null]
  );
  log(`  ✨ nova variante gerada ("${label}"): ${generated.headline}`);
}

main()
  .then(() => log("concluído."))
  .catch((err) => {
    log("erro fatal:", err);
    process.exitCode = 0; // cron-friendly: nunca falha o processo por completo
  });
