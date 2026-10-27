import { createElement, Fragment, useEffect, useState, type ReactNode } from "react";
import type { BlocoDesafio, ImagemGenero, PaginaDesafioConfig, QuizMeta } from "@/lib/quiz-config";
import { readPersistedAnswers } from "@/lib/signals";
import { trackEvent } from "@/lib/tracking";
import { cn } from "@/lib/utils";

// Oferta low ticket no formato "desafio de 21 dias" (modelo das páginas de quiz de tráfego tipo DMM):
// uma coluna, blocos em sequência, o card de preço com cupom e cronômetro repetido várias vezes.
// Todo o conteúdo vem de quizMeta.paginaDesafio; aqui só tem o desenho de cada tipo de bloco.

type Answers = Record<string, string | string[]>;

interface Props {
  quizId?: string | null;
  quizMeta: QuizMeta;
  cfg: PaginaDesafioConfig;
  buildCheckoutUrl: (base: string, leadName?: string) => string;
}

/** {nome} → primeiro nome; *texto* → negrito na cor primária. */
function useTexto(nome: string) {
  return (texto: string): ReactNode => {
    const t = texto.split("{nome}").join(nome);
    const partes: ReactNode[] = [];
    const re = /\*([^*\n]+)\*/g;
    let ultimo = 0;
    let r: RegExpExecArray | null;
    let k = 0;
    while ((r = re.exec(t)) !== null) {
      if (r.index > ultimo) partes.push(t.slice(ultimo, r.index));
      partes.push(createElement("strong", { key: k++, className: "font-extrabold text-primary" }, r[1]));
      ultimo = r.index + r[0].length;
    }
    if (ultimo < t.length) partes.push(t.slice(ultimo));
    return createElement(Fragment, null, ...partes);
  };
}

function useCronometro(minutos: number) {
  const [resta, setResta] = useState(minutos * 60);
  useEffect(() => {
    const id = setInterval(() => setResta((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(resta / 60)).padStart(2, "0");
  const ss = String(resta % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const secao = "px-4 py-8";
const h2 = "text-center text-2xl font-extrabold leading-tight text-foreground";

export function PaginaDesafio({ quizId, quizMeta, cfg, buildCheckoutUrl }: Props) {
  const [answers, setAnswers] = useState<Answers | null>(null);
  useEffect(() => setAnswers(readPersistedAnswers()), []);
  const nomeCompleto = typeof answers?.["name"] === "string" ? (answers["name"] as string) : "";
  const nome = nomeCompleto.trim().split(/\s+/)[0] ?? "";
  const genero = answers?.["intro_first"] === "mulher" ? "mulher" : "homem";
  const tx = useTexto(nome);
  const relogio = useCronometro(cfg.preco.minutos ?? 10);

  const img = (i: ImagemGenero) => (typeof i === "string" ? i : i[genero]);

  const campo = (k: string) => (typeof answers?.[k] === "string" ? encodeURIComponent((answers[k] as string).trim()) : "");
  const checkout = buildCheckoutUrl(
    cfg.checkoutUrl
      .split("{email}").join(campo("email"))
      .split("{whatsapp}").join(campo("whatsapp").replace(/\D/g, "")),
    nomeCompleto,
  );
  function comprar(origem: string) {
    if (quizId) trackEvent(quizId, "checkout_click", { data: { url: checkout, origem } });
  }

  const p = cfg.preco;
  let nOferta = 0;

  // Funções (não componentes): o cronômetro re-renderiza a página a cada segundo e um componente
  // declarado aqui dentro seria remontado (imagens piscando).
  function oferta(imagem: string | undefined, key: number) {
    const origem = `oferta_${++nOferta}`;
    return (
      <div key={key} className={secao}>
        {imagem && <img src={imagem} alt="" className="mx-auto mb-4 w-full max-w-sm" loading="lazy" />}
        {p.cupom && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="font-bold text-foreground">Seu cupom de desconto foi aplicado!</p>
            <p className="mt-1 font-extrabold text-green-600">✅ {tx(p.cupom)}</p>
            <p className="mt-1 text-sm text-foreground">
              O desconto está reservado por: <strong className="text-green-600">{relogio} minutos</strong>
            </p>
          </div>
        )}
        <div className="relative rounded-2xl border-2 border-primary bg-card p-5 text-center shadow-lg">
          {p.selo && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-3 py-1 text-xs font-extrabold text-white">
              {p.selo}
            </span>
          )}
          <p className="mt-1 text-base font-extrabold leading-snug text-foreground">{tx(p.titulo)}</p>
          <p className="mt-3 text-sm text-muted-foreground line-through">{p.de}</p>
          <p className="text-4xl font-black text-green-600">{p.parcelado}</p>
          <p className="text-sm font-semibold text-foreground">{p.avista}</p>
          <a
            href={checkout}
            onClick={() => comprar(origem)}
            className="btn-vivid mt-4 flex h-14 w-full items-center justify-center rounded-xl text-lg font-extrabold uppercase text-primary-foreground"
          >
            {p.cta}
          </a>
          {p.bandeiras && <img src={p.bandeiras} alt="Formas de pagamento" className="mx-auto mt-3 h-6 w-auto" loading="lazy" />}
          {p.avaliacao && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="text-amber-400">★★★★★</span> {p.avaliacao}
            </p>
          )}
        </div>
      </div>
    );
  }

  function bloco(b: BlocoDesafio, key: number): ReactNode {
    switch (b.tipo) {
      case "topo":
        return (
          <header className="px-4 pt-6 pb-2 text-center">
            {b.saudacao && <p className="text-2xl font-extrabold text-foreground">{tx(b.saudacao)}</p>}
            <h1 className="mt-2 text-2xl font-black uppercase leading-tight text-foreground">{tx(b.titulo)}</h1>
            {b.produto && <p className="mt-2 text-xl font-black uppercase leading-tight text-primary">{tx(b.produto)}</p>}
          </header>
        );
      case "antesDepois":
        return (
          <div className={secao}>
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card">
              {(["antes", "depois"] as const).map((lado) => (
                <div key={lado} className={cn("text-center", lado === "antes" ? "bg-red-50" : "bg-green-50")}>
                  <p className={cn("py-2 text-sm font-extrabold uppercase text-white", lado === "antes" ? "bg-red-600" : "bg-green-600")}>
                    {lado === "antes" ? "Antes" : "Depois"}
                  </p>
                  <img src={img(b[lado])} alt="" className="aspect-[2/3] w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
              {b.metricas.map((m) => (
                <div key={m.titulo} className="grid grid-cols-2 gap-3">
                  {(["antes", "depois"] as const).map((lado) => (
                    <div key={lado}>
                      <p className="text-xs font-bold text-foreground">{m.titulo}</p>
                      <p className={cn("text-xs font-semibold", lado === "antes" ? "text-red-600" : "text-green-600")}>{m[lado].rotulo}</p>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", lado === "antes" ? "bg-red-500" : "bg-green-500")}
                          style={{ width: `${m[lado].pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      case "apresentador":
        return (
          <div className={cn(secao, "text-center")}>
            <img src={b.foto} alt="" className="mx-auto size-40 rounded-full object-cover shadow-lg ring-4 ring-primary/20" loading="lazy" />
            <h2 className={cn(h2, "mt-4")}>{tx(b.titulo)}</h2>
            {b.texto && <p className="mt-2 text-base text-muted-foreground">{tx(b.texto)}</p>}
          </div>
        );
      case "entregaveis":
        return (
          <div className={secao}>
            <h2 className={h2}>{tx(b.titulo)}</h2>
            <div className="mt-5 space-y-4">
              {b.itens.map((it, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  {it.imagem && <img src={it.imagem} alt="" className="max-h-72 w-full object-cover" loading="lazy" />}
                  <p className="p-4 text-center text-lg font-extrabold uppercase leading-snug text-foreground">{tx(it.titulo)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "destaque": {
        const tom = b.tom ?? "claro";
        return (
          <div className="px-4 py-3">
            <p
              className={cn(
                "rounded-2xl p-5 text-center text-xl font-extrabold leading-snug",
                tom === "escuro" && "bg-foreground text-background",
                tom === "verde" && "border border-green-200 bg-green-50 text-green-700",
                tom === "azul" && "bg-primary text-primary-foreground",
                tom === "claro" && "border border-border bg-card text-foreground",
              )}
            >
              {tx(b.texto)}
            </p>
          </div>
        );
      }
      case "texto":
        return (
          <div className={cn("px-4 py-4", b.centro !== false && "text-center")}>
            {b.titulo && <h2 className={h2}>{tx(b.titulo)}</h2>}
            {b.texto && <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{tx(b.texto)}</p>}
          </div>
        );
      case "imagens":
        return (
          <div className="space-y-3 px-4 py-4">
            {b.imagens.map((i, k) => (
              <img key={k} src={img(i)} alt="" className="w-full rounded-2xl border border-border" loading="lazy" />
            ))}
            {b.legenda && <p className="text-center text-sm italic text-muted-foreground">{tx(b.legenda)}</p>}
          </div>
        );
      case "progresso": {
        const W = 320, H = 170, pad = 24;
        const n = b.pontos.length;
        const xy = b.pontos.map((pt, i) => [pad + (i * (W - 2 * pad)) / Math.max(1, n - 1), H - pad - (pt.valor / 100) * (H - 2 * pad)]);
        const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
        return (
          <div className={secao}>
            <h2 className={h2}>{tx(b.titulo)}</h2>
            {b.subtitulo && <p className="mt-1 text-center text-sm text-muted-foreground">{tx(b.subtitulo)}</p>}
            <div className="mt-4 rounded-2xl border border-border bg-card p-3">
              <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
                <defs>
                  <linearGradient id="prog" x1="0" x2="1">
                    <stop offset="0" stopColor="#dc2626" />
                    <stop offset="0.5" stopColor="#f59e0b" />
                    <stop offset="1" stopColor="#16a34a" />
                  </linearGradient>
                </defs>
                <path d={`${d} L${xy[n - 1][0]},${H - pad} L${xy[0][0]},${H - pad} Z`} fill="url(#prog)" opacity="0.15" />
                <path d={d} fill="none" stroke="url(#prog)" strokeWidth="4" strokeLinecap="round" />
                {xy.map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x} cy={y} r="5" fill={i === 0 ? "#dc2626" : i === n - 1 ? "#16a34a" : "#f59e0b"} />
                    {b.pontos[i].nota && (
                      <text x={Math.min(Math.max(x, 40), W - 40)} y={y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">
                        {b.pontos[i].nota}
                      </text>
                    )}
                    <text x={x} y={H + 12} textAnchor="middle" fontSize="10" fill="#6b7280">
                      {b.pontos[i].rotulo}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        );
      }
      case "bonus":
        return (
          <div className={secao}>
            {b.titulo && <h2 className={h2}>{tx(b.titulo)}</h2>}
            <div className="mt-5 space-y-5">
              {b.itens.map((it, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card text-center shadow-sm">
                  <p className="bg-primary/10 px-4 py-2 text-base font-extrabold text-primary">
                    #BÔNUS {String(i + 1).padStart(2, "0")}: {tx(it.titulo)}
                  </p>
                  {it.imagem && <img src={it.imagem} alt="" className="max-h-64 w-full object-cover" loading="lazy" />}
                  <div className="p-4">
                    {it.subtitulo && <p className="text-lg font-extrabold leading-snug text-foreground">{tx(it.subtitulo)}</p>}
                    <p className="mt-2 text-sm text-muted-foreground">{tx(it.texto)}</p>
                    <p className="mt-3 text-lg font-extrabold text-red-600">
                      VALOR: <s>{it.valor}</s>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "ancoragem":
        return (
          <div className={secao}>
            <div className="rounded-2xl bg-foreground p-5 text-center text-background">
              <p className="text-sm opacity-80">Agora, pensa comigo...</p>
              <p className="mt-1 text-2xl font-black leading-tight">{tx(b.titulo ?? "Quanto você acha que valeria ter acesso a tudo isso?")}</p>
            </div>
            {b.imagem && <img src={b.imagem} alt="" className="mx-auto mt-4 w-full max-w-sm" loading="lazy" />}
            <p className="mt-4 text-center text-sm text-muted-foreground">Se somarmos tudo na ponta do lápis, daria...</p>
            <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {b.itens.map((it) => (
                <div key={it.nome} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-bold uppercase text-foreground">{tx(it.nome)}</span>
                  <span className="shrink-0 text-sm font-extrabold text-red-600">{it.valor}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm font-bold uppercase text-foreground">
              Ao somar todos esses produtos que você estará levando, o preço total seria:
            </p>
            <p className="text-center text-4xl font-black text-red-600 line-through">{b.total}</p>
            {b.frase && <p className="mt-2 text-center text-sm font-bold uppercase text-foreground">{tx(b.frase)}</p>}
          </div>
        );
      case "oferta":
        return oferta(b.imagem, key);
      case "provas":
        return (
          <div className={secao}>
            <h2 className={h2}>{tx(b.titulo)}</h2>
            <div className="mt-5 space-y-4">
              {b.imagens.map((src) => (
                <img key={src} src={src} alt="Depoimento" className="mx-auto w-full max-w-sm rounded-2xl border border-border shadow-sm" loading="lazy" />
              ))}
            </div>
          </div>
        );
      case "lista":
        return (
          <div className={secao}>
            {b.titulo && <h2 className={h2}>{tx(b.titulo)}</h2>}
            {b.subtitulo && <p className="mt-2 text-center text-base font-bold italic text-foreground">{tx(b.subtitulo)}</p>}
            <ul className="mt-4 space-y-2">
              {b.itens.map((it) => (
                <li
                  key={it}
                  className={cn(
                    "flex gap-3 rounded-xl border p-3 text-base text-foreground",
                    b.icone === "check" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50",
                  )}
                >
                  <span className="shrink-0">{b.icone === "check" ? "✅" : "❌"}</span>
                  <span>{tx(it)}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      case "estatisticas":
        return (
          <div className={secao}>
            {b.subtitulo && <p className="text-center text-sm text-muted-foreground">{tx(b.subtitulo)}</p>}
            {b.titulo && <h2 className={cn(h2, "mt-1")}>{tx(b.titulo)}</h2>}
            <div className="mt-5 space-y-4">
              {b.itens.map((it, i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                  <div
                    className="grid size-20 shrink-0 place-items-center rounded-full"
                    style={{ background: `conic-gradient(#16a34a ${it.pct * 3.6}deg, var(--muted) 0)` }}
                  >
                    <span className="grid size-16 place-items-center rounded-full bg-card text-lg font-black text-green-600">{it.pct}%</span>
                  </div>
                  <p className="text-sm text-foreground">{tx(it.texto)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "garantia":
        return (
          <div className={cn(secao, "text-center")}>
            {b.selo && <img src={b.selo} alt="" className="mx-auto size-36 object-contain" loading="lazy" />}
            <h2 className={cn(h2, "mt-3")}>{tx(b.titulo)}</h2>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{tx(b.texto)}</p>
          </div>
        );
      case "rodape":
        return <footer className="px-4 py-8 text-center text-xs text-muted-foreground">{tx(b.texto)}</footer>;
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center pt-5">
          <span className={quizMeta.logoPlain ? "inline-block" : "inline-block rounded-xl bg-black px-4 py-2.5"}>
            <img src={quizMeta.logo as string} alt={quizMeta.logoAlt} className={quizMeta.logoPlain ? "block h-14 w-auto" : "block h-10 w-auto"} />
          </span>
        </div>
        {cfg.blocos.map((b, i) => (
          <Fragment key={i}>{bloco(b, i)}</Fragment>
        ))}
      </div>
    </div>
  );
}
