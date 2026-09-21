// ============================================================
// db.ts — conexão Postgres da plataforma (server-only)
// ============================================================
// Nunca importe este arquivo de um componente cliente — só de rotas de
// servidor (`server: { handlers }`) ou server functions (`createServerFn`).
// A pool é criada uma única vez e reaproveitada entre requisições.
// ============================================================
import { Pool } from "pg";
import type { QuizMeta, Screen } from "./quiz-config";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

export type QuizRow = {
  id: string;
  slug: string;
  domain: string | null;
  name: string;
  tier: "curto" | "medio" | "longo";
  status: "draft" | "published";
  quiz_meta: QuizMeta;
  screens: Screen[];
  scoring_map: Record<string, Record<string, number>>;
  created_at: string;
  updated_at: string;
};

/** Busca o quiz publicado pra um domínio. Retorna null se não achar ou se o DB estiver fora do ar. */
export async function getQuizByDomain(domain: string): Promise<QuizRow | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query<QuizRow>(
    `select * from quizzes where domain = $1 and status = 'published' limit 1`,
    [domain]
  );
  return rows[0] ?? null;
}

export async function getQuizById(id: string): Promise<QuizRow | null> {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query<QuizRow>(`select * from quizzes where id = $1 limit 1`, [id]);
  return rows[0] ?? null;
}

export async function listQuizzes(): Promise<QuizRow[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query<QuizRow>(`select * from quizzes order by updated_at desc`);
  return rows;
}

export async function createQuiz(input: {
  slug: string;
  name: string;
  tier: "curto" | "medio" | "longo";
  quizMeta: QuizMeta;
  screens: Screen[];
  scoringMap: Record<string, Record<string, number>>;
}): Promise<QuizRow> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  const { rows } = await db.query<QuizRow>(
    `insert into quizzes (slug, name, tier, quiz_meta, screens, scoring_map)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      input.slug,
      input.name,
      input.tier,
      JSON.stringify(input.quizMeta),
      JSON.stringify(input.screens),
      JSON.stringify(input.scoringMap),
    ]
  );
  return rows[0];
}

export async function updateQuiz(
  id: string,
  patch: Partial<{
    name: string;
    domain: string | null;
    tier: "curto" | "medio" | "longo";
    status: "draft" | "published";
    quizMeta: QuizMeta;
    screens: Screen[];
    scoringMap: Record<string, Record<string, number>>;
  }>
): Promise<QuizRow> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const map: Record<string, unknown> = {
    name: patch.name,
    domain: patch.domain,
    tier: patch.tier,
    status: patch.status,
    quiz_meta: patch.quizMeta !== undefined ? JSON.stringify(patch.quizMeta) : undefined,
    screens: patch.screens !== undefined ? JSON.stringify(patch.screens) : undefined,
    scoring_map: patch.scoringMap !== undefined ? JSON.stringify(patch.scoringMap) : undefined,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    fields.push(`${col} = $${i}`);
    values.push(val);
    i++;
  }
  fields.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await db.query<QuizRow>(
    `update quizzes set ${fields.join(", ")} where id = $${i} returning *`,
    values
  );
  return rows[0];
}

export async function deleteQuiz(id: string): Promise<void> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  await db.query(`delete from quizzes where id = $1`, [id]);
}

export async function insertLead(input: {
  quizId: string | null;
  name?: string;
  email?: string;
  whatsapp?: string;
  answers: Record<string, unknown>;
  utm?: Record<string, unknown>;
}): Promise<void> {
  const db = getPool();
  if (!db) return; // sem DB configurado: não quebra o funil, só não salva
  await db.query(
    `insert into leads (quiz_id, name, email, whatsapp, answers, utm) values ($1,$2,$3,$4,$5,$6)`,
    [
      input.quizId,
      input.name ?? null,
      input.email ?? null,
      input.whatsapp ?? null,
      JSON.stringify(input.answers),
      JSON.stringify(input.utm ?? {}),
    ]
  );
}

export async function insertMediaAsset(input: {
  quizId: string | null;
  url: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `insert into media_assets (quiz_id, url, filename, content_type, size_bytes) values ($1,$2,$3,$4,$5)`,
    [input.quizId, input.url, input.filename, input.contentType ?? null, input.sizeBytes ?? null]
  );
}

export async function listMediaAssets(quizId: string): Promise<
  { id: string; url: string; filename: string; created_at: string }[]
> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    `select id, url, filename, created_at from media_assets where quiz_id = $1 order by created_at desc`,
    [quizId]
  );
  return rows;
}

// ============================================================
// TESTE A/B DE HEADLINE + ANALYTICS
// ============================================================

export type HeadlineVariant = {
  id: string;
  quiz_id: string;
  label: string;
  headline: string;
  subheadline: string | null;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
};

export async function listHeadlineVariants(quizId: string): Promise<HeadlineVariant[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query<HeadlineVariant>(
    `select * from headline_variants where quiz_id = $1 order by created_at asc`,
    [quizId]
  );
  return rows;
}

/** Só as variantes ativas — usada pra sortear qual headline mostrar num visitante novo. */
export async function listActiveHeadlineVariants(quizId: string): Promise<HeadlineVariant[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query<HeadlineVariant>(
    `select * from headline_variants where quiz_id = $1 and is_paused = false order by created_at asc`,
    [quizId]
  );
  return rows;
}

export async function createHeadlineVariant(input: {
  quizId: string;
  label: string;
  headline: string;
  subheadline?: string;
}): Promise<HeadlineVariant> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  const { rows } = await db.query<HeadlineVariant>(
    `insert into headline_variants (quiz_id, label, headline, subheadline) values ($1,$2,$3,$4) returning *`,
    [input.quizId, input.label, input.headline, input.subheadline ?? null]
  );
  return rows[0];
}

export async function updateHeadlineVariant(
  id: string,
  patch: Partial<{ label: string; headline: string; subheadline: string | null; isPaused: boolean }>
): Promise<HeadlineVariant> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const map: Record<string, unknown> = {
    label: patch.label,
    headline: patch.headline,
    subheadline: patch.subheadline,
    is_paused: patch.isPaused,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    fields.push(`${col} = $${i}`);
    values.push(val);
    i++;
  }
  fields.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await db.query<HeadlineVariant>(
    `update headline_variants set ${fields.join(", ")} where id = $${i} returning *`,
    values
  );
  return rows[0];
}

export async function deleteHeadlineVariant(id: string): Promise<void> {
  const db = getPool();
  if (!db) throw new Error("DATABASE_URL não configurado");
  await db.query(`delete from headline_variants where id = $1`, [id]);
}

/** Registra (ou ignora, se já existir) a sessão de um visitante — 1 linha por (quiz, session_id). */
export async function upsertQuizSession(input: {
  quizId: string;
  sessionId: string;
  variantId?: string | null;
  deviceType?: string;
  userAgent?: string;
  referrer?: string;
  utm?: Record<string, unknown>;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `insert into quiz_sessions (quiz_id, session_id, variant_id, device_type, user_agent, referrer, utm)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (quiz_id, session_id) do nothing`,
    [
      input.quizId,
      input.sessionId,
      input.variantId ?? null,
      input.deviceType ?? null,
      input.userAgent ?? null,
      input.referrer ?? null,
      JSON.stringify(input.utm ?? {}),
    ]
  );
}

export async function insertHeadlineEvent(input: {
  variantId: string;
  sessionId: string;
  eventType: "view" | "cta_click";
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `insert into headline_events (variant_id, session_id, event_type) values ($1,$2,$3)`,
    [input.variantId, input.sessionId, input.eventType]
  );
}

export async function insertQuizEvent(input: {
  quizId: string;
  sessionId: string;
  eventType: string;
  screenId?: string;
  stepIndex?: number;
  data?: Record<string, unknown>;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  await db.query(
    `insert into quiz_events (quiz_id, session_id, screen_id, step_index, event_type, data)
     values ($1,$2,$3,$4,$5,$6)`,
    [
      input.quizId,
      input.sessionId,
      input.screenId ?? null,
      input.stepIndex ?? null,
      input.eventType,
      JSON.stringify(input.data ?? {}),
    ]
  );
}

/** Quantas sessões distintas chegaram (deram "screen_view") em cada tela — base do relatório de abandono por tela. */
export async function getScreenFunnelStats(
  quizId: string
): Promise<{ screenId: string; stepIndex: number; reached: number }[]> {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query<{ screen_id: string; step_index: number; reached: string }>(
    `select screen_id, step_index, count(distinct session_id) as reached
     from quiz_events
     where quiz_id = $1 and event_type = 'screen_view' and screen_id is not null and step_index is not null
     group by screen_id, step_index
     order by step_index asc`,
    [quizId]
  );
  return rows.map((r) => ({ screenId: r.screen_id, stepIndex: r.step_index, reached: Number(r.reached) }));
}

export type HeadlineStat = {
  variant: HeadlineVariant;
  views: number;
  ctaClicks: number;
  leads: number;
  checkoutClicks: number;
};

/** Estatísticas de cada variante — pro painel mostrar e o cron de otimização decidir. */
export async function getHeadlineStats(quizId: string): Promise<HeadlineStat[]> {
  const db = getPool();
  if (!db) return [];
  const variants = await listHeadlineVariants(quizId);
  if (variants.length === 0) return [];
  const { rows } = await db.query<{
    variant_id: string;
    views: string;
    cta_clicks: string;
    leads: string;
    checkout_clicks: string;
  }>(
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
    [quizId]
  );
  const byId = new Map(rows.map((r) => [r.variant_id, r]));
  return variants.map((variant) => {
    const r = byId.get(variant.id);
    return {
      variant,
      views: Number(r?.views ?? 0),
      ctaClicks: Number(r?.cta_clicks ?? 0),
      leads: Number(r?.leads ?? 0),
      checkoutClicks: Number(r?.checkout_clicks ?? 0),
    };
  });
}
