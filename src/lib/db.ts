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
}): Promise<string | null> {
  const db = getPool();
  if (!db) return null; // sem DB configurado: não quebra o funil, só não salva
  const r = await db.query(
    `insert into leads (quiz_id, name, email, whatsapp, answers, utm) values ($1,$2,$3,$4,$5,$6) returning id`,
    [
      input.quizId,
      input.name ?? null,
      input.email ?? null,
      input.whatsapp ?? null,
      JSON.stringify(input.answers),
      JSON.stringify(input.utm ?? {}),
    ]
  );
  return (r.rows[0]?.id as string) ?? null;
}

/** Anexa respostas extras (etapa opcional pós-formulário) a um lead já salvo. Devolve o lead atualizado. */
export async function mergeLeadAnswers(
  leadId: string,
  extra: Record<string, string>
): Promise<{ quiz_id: string | null; name: string | null; email: string | null; whatsapp: string | null; answers: Record<string, unknown>; utm: Record<string, unknown> } | null> {
  const db = getPool();
  if (!db) return null;
  const r = await db.query(
    `update leads set answers = answers || $2::jsonb where id = $1 returning quiz_id, name, email, whatsapp, answers, utm`,
    [leadId, JSON.stringify(extra)]
  );
  return r.rows[0] ?? null;
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
  isTest?: boolean;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  // Sessão que virou teste depois (?teste=1 numa recarga) é marcada; nunca desmarca.
  await db.query(
    `insert into quiz_sessions (quiz_id, session_id, variant_id, device_type, user_agent, referrer, utm, is_test)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (quiz_id, session_id) do update set is_test = quiz_sessions.is_test or excluded.is_test`,
    [
      input.quizId,
      input.sessionId,
      input.variantId ?? null,
      input.deviceType ?? null,
      input.userAgent ?? null,
      input.referrer ?? null,
      JSON.stringify(input.utm ?? {}),
      input.isTest === true,
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
  /** Horário em que aconteceu no navegador (evento reenviado). Padrão: agora. */
  createdAt?: Date;
  /** Evento de sessão de teste: garante a sessão marcada como teste mesmo se o /session falhou. */
  isTest?: boolean;
}): Promise<void> {
  const db = getPool();
  if (!db) return;
  if (input.isTest) {
    await db.query(
      `insert into quiz_sessions (quiz_id, session_id, is_test) values ($1,$2,true)
       on conflict (quiz_id, session_id) do update set is_test = true`,
      [input.quizId, input.sessionId]
    );
  }
  await db.query(
    `insert into quiz_events (quiz_id, session_id, screen_id, step_index, event_type, data, created_at)
     values ($1,$2,$3,$4,$5,$6,coalesce($7, now()))`,
    [
      input.quizId,
      input.sessionId,
      input.screenId ?? null,
      input.stepIndex ?? null,
      input.eventType,
      JSON.stringify(input.data ?? {}),
      input.createdAt ?? null,
    ]
  );
}

/** Sessão sem evento novo há mais que isso conta como "saiu"; antes disso, "em andamento". */
const INATIVA = "30 minutes";

export type FunnelReport = {
  /** Por tela (id): sessões que viram a tela, que pararam nela e o tempo mediano até a próxima. */
  telas: {
    screenId: string;
    chegaram: number;
    saiu: number;
    /** Dos que saíram aqui, quantos já tinham deixado o contato (fecharam na análise, antes da oferta). */
    saiuComLead: number;
    andamento: number;
    tempoMedianoSeg: number | null;
  }[];
  totais: {
    sessoes: number;
    leads: number;
    ofertas: number;
    checkouts: number;
    /** Viram a oferta e foram embora sem clicar no checkout. */
    saiuOferta: number;
    andamento: number;
  };
  /** Sessões marcadas como teste (?teste=1) no período, fora do relatório. */
  testes: number;
};

/**
 * Relatório de abandono por tela. Cada sessão "sai" na ÚLTIMA tela que viu (se não chegou
 * na oferta) — assim telas condicionais (ex.: idade de homem x de mulher) não distorcem a
 * conta, e quem voltou uma tela e fechou conta onde realmente parou. Período = sessões que
 * começaram entre `de` e `ate`. Sessões de teste ficam de fora.
 */
export async function getFunnelReport(quizId: string, de: Date, ate: Date): Promise<FunnelReport> {
  const vazio: FunnelReport = {
    telas: [],
    totais: { sessoes: 0, leads: 0, ofertas: 0, checkouts: 0, saiuOferta: 0, andamento: 0 },
    testes: 0,
  };
  const db = getPool();
  if (!db) return vazio;
  const { rows } = await db.query<{ telas: FunnelReport["telas"] | null; totais: FunnelReport["totais"]; testes: number }>(
    `with teste as (
       select session_id from quiz_sessions where quiz_id = $1 and is_test
     ),
     base as (
       select e.session_id, e.screen_id, e.event_type, e.created_at
       from quiz_events e
       where e.quiz_id = $1 and e.session_id not in (select session_id from teste)
     ),
     ses as (
       select session_id,
         max(created_at) as fim,
         bool_or(event_type = 'lead_submitted') as lead,
         bool_or(event_type = 'offer_view') as oferta,
         bool_or(event_type = 'checkout_click') as checkout
       from base
       group by session_id
       having min(created_at) >= $2 and min(created_at) < $3
     ),
     vis as (
       select b.session_id, b.screen_id, b.created_at,
         lead(b.created_at) over w as prox_em,
         lead(b.screen_id) over w as prox_tela
       from base b join ses using (session_id)
       where b.event_type = 'screen_view' and b.screen_id is not null
       window w as (partition by b.session_id order by b.created_at)
     ),
     ultima as (
       select distinct on (session_id) session_id, screen_id from vis order by session_id, created_at desc
     ),
     chegada as (
       select screen_id,
         count(distinct session_id)::int as chegaram,
         percentile_cont(0.5) within group (order by extract(epoch from prox_em - created_at))
           filter (where prox_tela is distinct from screen_id and prox_em - created_at < interval '${INATIVA}') as tempo
       from vis group by screen_id
     ),
     saida as (
       select u.screen_id,
         count(*) filter (where not s.oferta and s.fim < now() - interval '${INATIVA}')::int as saiu,
         count(*) filter (where not s.oferta and s.lead and s.fim < now() - interval '${INATIVA}')::int as saiu_lead,
         count(*) filter (where not s.oferta and s.fim >= now() - interval '${INATIVA}')::int as andamento
       from ultima u join ses s using (session_id)
       group by u.screen_id
     )
     select
       (select json_agg(json_build_object(
           'screenId', c.screen_id, 'chegaram', c.chegaram,
           'saiu', coalesce(x.saiu, 0), 'saiuComLead', coalesce(x.saiu_lead, 0), 'andamento', coalesce(x.andamento, 0),
           'tempoMedianoSeg', round(c.tempo::numeric, 1)))
        from chegada c left join saida x using (screen_id)) as telas,
       (select json_build_object(
           'sessoes', count(*)::int,
           'leads', (count(*) filter (where lead))::int,
           'ofertas', (count(*) filter (where oferta))::int,
           'checkouts', (count(*) filter (where checkout))::int,
           'saiuOferta', (count(*) filter (where oferta and not checkout and fim < now() - interval '${INATIVA}'))::int,
           'andamento', (count(*) filter (where not oferta and fim >= now() - interval '${INATIVA}'))::int)
        from ses) as totais,
       (select count(distinct t.session_id)::int from teste t
          join quiz_events e on e.quiz_id = $1 and e.session_id = t.session_id
          where e.created_at >= $2 and e.created_at < $3) as testes`,
    [quizId, de, ate]
  );
  const r = rows[0];
  if (!r) return vazio;
  return {
    telas: (r.telas ?? []).map((t) => ({ ...t, tempoMedianoSeg: t.tempoMedianoSeg == null ? null : Number(t.tempoMedianoSeg) })),
    totais: r.totais,
    testes: r.testes ?? 0,
  };
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
