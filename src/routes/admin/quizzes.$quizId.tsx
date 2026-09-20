import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getQuizForAdmin } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/quizzes/$quizId")({
  loader: ({ params }) => getQuizForAdmin({ data: { id: params.quizId } }),
  head: () => ({ meta: [{ title: "Painel — Editar quiz" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: EditQuizPage,
});

const TIER_OPTIONS: { value: "curto" | "medio" | "longo"; label: string }[] = [
  { value: "curto", label: "Curto — produto R$17-19,90" },
  { value: "medio", label: "Médio — produto R$27-37" },
  { value: "longo", label: "Longo — produto R$47-67 (até 70 perguntas)" },
];

type SignalRow = { key: string; label: string; kind: "pain" | "desire"; headline: string; body: string };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function EditQuizPage() {
  const quiz = Route.useLoaderData();
  const { quizId } = Route.useParams();

  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Quiz não encontrado. <Link to="/admin" className="text-primary underline">Voltar</Link></p>
      </div>
    );
  }

  const meta = quiz.quiz_meta as unknown as Record<string, unknown>;

  const [name, setName] = useState(quiz.name);
  const [domain, setDomain] = useState(quiz.domain ?? "");
  const [tier, setTier] = useState(quiz.tier);
  const [status, setStatus] = useState(quiz.status);

  // Informações básicas — extraídas do quizMeta pra formulário simples.
  const [title, setTitle] = useState((meta.title as string) ?? "");
  const [description, setDescription] = useState((meta.description as string) ?? "");
  const [logo, setLogo] = useState((meta.logo as string) ?? "");
  const [logoAlt, setLogoAlt] = useState((meta.logoAlt as string) ?? "");
  const [expertName, setExpertName] = useState((meta.expertName as string) ?? "");
  const [expertImage, setExpertImage] = useState((meta.expertImage as string) ?? "");
  const [offerUrl, setOfferUrl] = useState((meta.offerUrl as string) ?? "/oferta");

  // Produto — sempre o mesmo produto por quiz. Ver src/routes/oferta.tsx.
  const initialProduct = quiz.quiz_meta.product;
  const [productName, setProductName] = useState(initialProduct?.name ?? "");
  const [productPromise, setProductPromise] = useState(initialProduct?.promise ?? "");
  const [productPrice, setProductPrice] = useState(initialProduct?.price ?? "");
  const [productOriginalPrice, setProductOriginalPrice] = useState(initialProduct?.originalPrice ?? "");
  const [productInstallments, setProductInstallments] = useState(initialProduct?.installments ?? "");
  const [productCheckoutUrl, setProductCheckoutUrl] = useState(initialProduct?.checkoutUrl ?? "");
  const [productBenefitsText, setProductBenefitsText] = useState(
    (initialProduct?.benefits ?? []).join("\n")
  );
  const [productGuarantee, setProductGuarantee] = useState(initialProduct?.guarantee ?? "");

  // Aparência
  const [backgroundMode, setBackgroundMode] = useState<"light" | "dark">(
    quiz.quiz_meta.backgroundMode ?? "light"
  );
  const [primaryColor, setPrimaryColor] = useState(quiz.quiz_meta.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(quiz.quiz_meta.secondaryColor ?? "");

  // Biblioteca de sinais (dores/desejos) — formulário em vez de JSON cru.
  const [signals, setSignals] = useState<SignalRow[]>(() => {
    const lib = (quiz.quiz_meta.signalLibrary ?? {}) as Record<string, Omit<SignalRow, "key">>;
    return Object.entries(lib).map(([key, def]) => ({ key, ...def }));
  });

  // O que sobra do quizMeta depois de tirar tudo que virou formulário
  // (leadFields, offerRouteByAnswer, campos raros). Editável só aqui.
  const [quizMetaText, setQuizMetaText] = useState(() => {
    const {
      product: _p, backgroundMode: _bg, primaryColor: _pc, secondaryColor: _sc,
      signalLibrary: _sl, title: _t, description: _d, logo: _lg, logoAlt: _la,
      expertName: _en, expertImage: _ei, offerUrl: _ou,
      ...rest
    } = quiz.quiz_meta as unknown as Record<string, unknown>;
    return JSON.stringify(rest, null, 2);
  });
  const [screensText, setScreensText] = useState(() => JSON.stringify(quiz.screens, null, 2));

  const [toast, setToast] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const VPS_IP = "85.31.60.46";
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState<{ url: string; filename: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screensFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "success" ? 4000 : 9000);
    return () => clearTimeout(t);
  }, [toast]);

  function addSignal() {
    setSignals((s) => [...s, { key: "", label: "", kind: "pain", headline: "", body: "" }]);
  }
  function updateSignal(i: number, patch: Partial<SignalRow>) {
    setSignals((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeSignal(i: number) {
    setSignals((s) => s.filter((_, idx) => idx !== i));
  }

  async function handleSave(): Promise<boolean> {
    setToast(null);
    let quizMetaParsed: Record<string, unknown>;
    let screensParsed: unknown;
    try {
      quizMetaParsed = JSON.parse(quizMetaText);
    } catch (e) {
      setToast({ kind: "error", text: `O campo "Avançado" tem um JSON inválido: ${(e as Error).message}` });
      return false;
    }
    try {
      screensParsed = JSON.parse(screensText);
    } catch (e) {
      setToast({ kind: "error", text: `O campo "Telas do quiz" tem um JSON inválido: ${(e as Error).message}` });
      return false;
    }
    if (!Array.isArray(screensParsed)) {
      setToast({ kind: "error", text: `"Telas do quiz" precisa ser uma lista [ ] de telas.` });
      return false;
    }

    // Informações básicas
    quizMetaParsed.title = title;
    quizMetaParsed.description = description;
    quizMetaParsed.logo = logo;
    quizMetaParsed.logoAlt = logoAlt || title;
    quizMetaParsed.offerUrl = offerUrl || "/oferta";
    if (expertName) quizMetaParsed.expertName = expertName; else delete quizMetaParsed.expertName;
    if (expertImage) quizMetaParsed.expertImage = expertImage; else delete quizMetaParsed.expertImage;

    // Produto
    const benefits = productBenefitsText.split("\n").map((b) => b.trim()).filter(Boolean);
    if (productName || productPrice || productCheckoutUrl) {
      quizMetaParsed.product = {
        name: productName,
        promise: productPromise,
        price: productPrice,
        ...(productOriginalPrice ? { originalPrice: productOriginalPrice } : {}),
        ...(productInstallments ? { installments: productInstallments } : {}),
        checkoutUrl: productCheckoutUrl,
        benefits,
        ...(productGuarantee ? { guarantee: productGuarantee } : {}),
      };
    }

    // Aparência
    quizMetaParsed.backgroundMode = backgroundMode;
    if (primaryColor) quizMetaParsed.primaryColor = primaryColor; else delete quizMetaParsed.primaryColor;
    if (secondaryColor) quizMetaParsed.secondaryColor = secondaryColor; else delete quizMetaParsed.secondaryColor;

    // Biblioteca de sinais
    const validSignals = signals.filter((s) => s.key.trim());
    if (validSignals.length > 0) {
      quizMetaParsed.signalLibrary = Object.fromEntries(
        validSignals.map((s) => [
          s.key.trim(),
          { label: s.label, kind: s.kind, headline: s.headline, body: s.body },
        ])
      );
    } else {
      delete quizMetaParsed.signalLibrary;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quiz?id=${quizId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain: domain || null,
          tier,
          status,
          quizMeta: quizMetaParsed,
          screens: screensParsed,
        }),
      });
      let json: { ok: boolean; error?: string };
      try {
        json = await res.json();
      } catch {
        setToast({ kind: "error", text: `O servidor respondeu algo inesperado (HTTP ${res.status}). Tente de novo.` });
        return false;
      }
      if (!res.ok || !json.ok) {
        setToast({ kind: "error", text: json.error ?? `Falha ao salvar (HTTP ${res.status}).` });
        return false;
      }
      setToast({ kind: "success", text: "Salvo! Já está valendo no site publicado." });
      return true;
    } catch (e) {
      setToast({ kind: "error", text: `Falha de rede ao salvar: ${(e as Error).message}` });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishDomain() {
    if (!domain.trim()) return;
    const saved = await handleSave();
    if (!saved) return;
    setProvisioning(true);
    setToast({ kind: "success", text: `Salvo. Verificando DNS e configurando "${domain}"...` });
    try {
      const res = await fetch("/api/admin/provision-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (json.ok) {
        setToast({ kind: "success", text: `✅ ${json.message} Confira: https://${domain}` });
      } else {
        setToast({ kind: "error", text: json.error ?? "Falha ao publicar o domínio." });
      }
    } catch (e) {
      setToast({ kind: "error", text: `Falha de rede ao publicar domínio: ${(e as Error).message}` });
    } finally {
      setProvisioning(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("quizId", quizId);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (json.ok) {
        setMedia((m) => [{ url: json.url, filename: json.filename }, ...m]);
        setToast({ kind: "success", text: `Imagem enviada: ${json.url}` });
      } else {
        setToast({ kind: "error", text: json.error ?? "Falha no upload." });
      }
    } catch {
      setToast({ kind: "error", text: "Falha no upload (rede)." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Ponto de entrada do botão "Importar arquivo": decide entre .json e .md/.txt. */
  function handleImportFile(file: File) {
    const isMarkdown = /\.(md|markdown|txt)$/i.test(file.name) || file.type === "text/markdown" || file.type === "text/plain";
    if (isMarkdown) {
      handleMarkdownFile(file);
    } else {
      handleJsonFile(file);
    }
  }

  /**
   * Converte o texto que a skill quiz-funnel-builder gera (blocos
   * "TELA N — FASE | TIPO: ..." com headline/pergunta/opções em texto livre)
   * pro formato de tela [Screen] deste motor. É um melhor-esforço: telas
   * simples (single, intro, conteúdo, prova social, loading, depoimentos,
   * lead) saem prontas; telas de seleção múltipla (o motor não usa múltipla
   * escolha) e blocos de gráfico/diagnóstico ficam marcados com ⚠️ pra
   * revisão manual no campo abaixo antes de salvar.
   */
  function parseMarkdownScreens(raw: string): { screens: Record<string, unknown>[]; reviewCount: number } {
    type ParsedBlock = { n: number; fase: string; tipoRaw: string; bodyLines: string[]; options: { label: string; value: string }[] };

    function extractOptions(lines: string[]): { options: { label: string; value: string }[]; rest: string[] } {
      const optRe = /^\s*(?:[□☐▢▪✓✔•\-*]|\d+[.)])\s+(.*)$/;
      const options: { label: string; value: string }[] = [];
      const rest: string[] = [];
      for (const line of lines) {
        const m = line.match(optRe);
        if (m && m[1].trim()) {
          const label = m[1].trim();
          const noEmoji = label.replace(/\p{Extended_Pictographic}/gu, "").trim();
          options.push({ label, value: slugify(noEmoji || label) || `opcao_${options.length + 1}` });
        } else {
          rest.push(line);
        }
      }
      return { options, rest };
    }

    function buildParagraphs(lines: string[]): string[] {
      return lines
        .join("\n")
        .split(/\n{2,}/)
        .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join("\n"))
        .filter(Boolean);
    }

    function classifyScreenType(tipoRaw: string, bodyText: string, hasOptions: boolean) {
      const t = tipoRaw.toLowerCase();
      const b = bodyText.toLowerCase();
      if (t.includes("intro")) return "intro";
      if (t.includes("múltipla") || t.includes("multipla") || t.includes("multi-select")) return "multi-review";
      if (t.includes("escala") || t.includes("concordância") || t.includes("concordancia")) return "scale";
      if (t.includes("loading")) return "loading";
      if (t.includes("diagnóstico") || t.includes("diagnostico") || b.includes("nível baixo") || b.includes("nivel baixo")) return "diagnosis";
      if (t.includes("mirror") || (b.includes("esforço") && b.includes("resultado"))) return "mirror-chart";
      if (t.includes("comparat") || (t.includes("antes") && t.includes("depois"))) return "compare";
      if (t.includes("depoimentos") && !t.includes("prova social")) return "testimonials";
      if (t.includes("prova social") || t.includes("whatsapp") || t.includes("social-proof") || t.includes("social proof")) return "social-proof";
      if (t.includes("gate") || t.includes("captura") || t.includes("lead")) return "lead";
      if (t.includes("única") || t.includes("unica") || t.includes("single")) return "single";
      if (t.includes("conteúdo") || t.includes("conteudo") || t.includes("enquadramento") || t.includes("revelação") || t.includes("revelacao") || t.includes("quebra")) return "content";
      return hasOptions ? "single" : "content";
    }

    function splitBlocks(text: string): ParsedBlock[] {
      const noSep = text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((l) => !/^[━=\-_*~]{5,}\s*$/.test(l.trim()))
        .join("\n");
      const parts = noSep
        .split(/(?=^\s*TELA\s*\[?\s*\d+)/im)
        .map((p) => p.trim())
        .filter(Boolean);
      return parts.map((part, i) => {
        const lines = part.split("\n");
        const header = lines[0] ?? "";
        const hm = header.match(/TELA\s*\[?\s*(\d+)\s*\]?\s*[—\-–|]+\s*(.+?)\s*\|\s*TIPO:\s*(.+)/i);
        const n = hm ? Number(hm[1]) : i + 1;
        const fase = hm ? hm[2].trim() : "";
        const tipoRaw = hm ? hm[3].trim() : "";
        const rest = lines
          .slice(1)
          .filter((l) => !/^FUNÇÃO\s*:/i.test(l.trim()) && !/^PERSONALIZAÇÃO\s*:/i.test(l.trim()));
        const { options, rest: bodyLines } = extractOptions(rest);
        return { n, fase, tipoRaw, bodyLines, options };
      });
    }

    function buildScreen(block: ParsedBlock): Record<string, unknown> {
      const id = `t${block.n}_${slugify(block.fase) || "tela"}`;
      const bodyLines = block.bodyLines.filter((l) => !/^\[\s*continuar\s*\]$/i.test(l.trim()));
      const paragraphs = buildParagraphs(bodyLines);
      const fullText = bodyLines.join("\n");
      const hasOptions = block.options.length > 0;
      const kind = classifyScreenType(block.tipoRaw, fullText, hasOptions);
      const question = paragraphs[paragraphs.length - 1] ?? "";
      const heading = paragraphs[0] ?? "";
      const sub = paragraphs.length > 2 ? paragraphs[1] : undefined;
      const options = block.options.map((o) => ({ value: o.value, label: o.label }));

      switch (kind) {
        case "intro":
          return {
            id, type: "intro",
            headline: heading || question || `Tela ${block.n}`,
            ...(sub ? { subheadline: sub } : {}),
            firstQuestion: question || heading,
            firstOptions: options,
          };
        case "single":
          return { id, type: "single", question: question || heading || `Tela ${block.n}`, options };
        case "scale":
          return { id, type: "scale", question: heading || question || "Avalie o quanto você concorda:", statement: paragraphs[1] ?? question };
        case "loading":
          return {
            id, type: "loading",
            title: heading || "Preparando seu plano personalizado...",
            lines: paragraphs.slice(1).length ? paragraphs.slice(1) : ["Analisando suas respostas...", "Quase pronto..."],
            durationMs: 4000,
          };
        case "diagnosis": {
          const cardDefs = [
            { label: "Crença Central", re: /cren[çc]a\s+central\s*[:\-]\s*(.+)/i },
            { label: "Sintoma Emocional", re: /sintoma\s+emocional\s*[:\-]\s*(.+)/i },
            { label: "Conflito Interno", re: /conflito\s+interno\s*[:\-]\s*(.+)/i },
            { label: "Padrão de Comportamento", re: /padr[ãa]o\s+de\s+comportamento\s*[:\-]\s*(.+)/i },
          ];
          const cards = cardDefs.map(({ label, re }) => {
            const m = fullText.match(re);
            return { label, name: m ? m[1].split("\n")[0].trim() : "A revisar", desc: "" };
          });
          return {
            id, type: "diagnosis",
            title: heading || "Sua probabilidade de resultado: NÍVEL BAIXO",
            levels: ["Iniciante", "Em Formação", "Crescendo", "Pronto", "Expert"],
            levelColors: ["bg-destructive", "bg-orange-500", "bg-amber-400", "bg-lime-400", "bg-emerald-500"],
            label: "Você",
            targetPct: 22,
            cards,
          };
        }
        case "compare": {
          const rowRe = /^[-*•]?\s*\[?([^:%\n]{2,60}?)\]?\s*[:\-]?\s*(\d{1,3})\s*%.*?(\d{1,3})\s*%/;
          const rows = bodyLines
            .map((l) => l.match(rowRe))
            .filter((m): m is RegExpMatchArray => !!m)
            .map((m) => ({ label: m[1].trim(), beforePct: Number(m[2]), afterPct: Number(m[3]) }));
          return {
            id, type: "compare",
            title: heading || "Veja a diferença de quem age:",
            beforeLabel: "Antes", afterLabel: "Depois",
            rows: rows.length ? rows : [{ label: "⚠️ A revisar — preencha as métricas", beforePct: 20, afterPct: 80 }],
          };
        }
        case "mirror-chart": {
          const pcts = Array.from(fullText.matchAll(/(\d{1,3})\s*%/g)).map((m) => Number(m[1]));
          return {
            id, type: "mirror-chart",
            ...(paragraphs.length > 2 ? { intro: heading } : {}),
            title: paragraphs.length > 2 ? paragraphs[1] : heading || "Antes de encontrar a solução...",
            insight: paragraphs[paragraphs.length - 1] ?? "⚠️ A revisar",
            effortPct: pcts[0] ?? 83,
            resultPct: pcts[1] ?? 14,
          };
        }
        case "testimonials": {
          const itemRe = /^[-*•]?\s*([A-ZÀ-Ú][\wÀ-ú.\s]{1,30})[:\-–—]\s*"?(.+?)"?$/;
          const items = bodyLines
            .map((l) => l.match(itemRe))
            .filter((m): m is RegExpMatchArray => !!m)
            .map((m) => ({ name: m[1].trim(), text: m[2].trim() }));
          return {
            id, type: "testimonials",
            title: heading || "Veja quem já transformou:",
            items: items.length ? items : [{ name: "Depoimento", text: paragraphs.join(" ") || "⚠️ A revisar" }],
          };
        }
        case "social-proof": {
          const waMatch = fullText.match(/^([A-ZÀ-Ú][\wÀ-ú.\s]{1,30})[:\-–—]\s*"?(.+?)"?\s*$/m);
          return {
            id, type: "social-proof",
            title: heading || "Veja o que estão dizendo:",
            body: paragraphs.slice(1).join("\n\n") || paragraphs.join("\n\n") || "",
            ...(waMatch ? { whatsapp: { author: waMatch[1].trim(), text: waMatch[2].trim(), meta: "" } } : {}),
          };
        }
        case "lead":
          return { id, type: "lead", title: heading || "Última etapa antes de receber seu plano", subtitle: paragraphs[1] };
        case "multi-review":
          return {
            id, type: "content",
            title: `⚠️ REVISAR MANUALMENTE (era seleção múltipla): ${heading || question || `Tela ${block.n}`}`,
            body: [
              "Esta tela era de seleção múltipla no texto original. Este motor não usa múltipla escolha —",
              "divida em várias telas `single` (uma pergunta por item) antes de publicar. Opções originais:",
              "",
              ...block.options.map((o) => `- ${o.label}`),
            ].join("\n"),
          };
        case "content":
        default:
          return {
            id, type: "content",
            title: heading || `Tela ${block.n}`,
            body: (heading ? paragraphs.slice(1) : paragraphs).join("\n\n") || "",
          };
      }
    }

    const blocks = splitBlocks(raw);
    const screens = blocks.map(buildScreen);
    const reviewCount = screens.filter((s) => typeof s.title === "string" && (s.title as string).startsWith("⚠️")).length;
    return { screens, reviewCount };
  }

  function handleMarkdownFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      if (!/TELA\s*\[?\s*\d+/i.test(raw)) {
        setToast({
          kind: "error",
          text: `Não reconheci o formato de "${file.name}". Esperado o texto gerado pela skill de quiz, com blocos "TELA 1 — FASE | TIPO: ...".`,
        });
        return;
      }
      const { screens, reviewCount } = parseMarkdownScreens(raw);
      setScreensText(JSON.stringify(screens, null, 2));
      setToast({
        kind: "success",
        text: `Carregado de "${file.name}": ${screens.length} tela(s) convertida(s).${
          reviewCount > 0 ? ` ${reviewCount} tela(s) marcada(s) com ⚠️ precisam de revisão manual (ex: seleção múltipla ou gráficos).` : ""
        } Confira o JSON embaixo antes de salvar.`,
      });
    };
    reader.onerror = () => setToast({ kind: "error", text: `Não consegui ler o arquivo "${file.name}".` });
    reader.readAsText(file);
  }

  /** Lê um .json e tenta descobrir se é a lista de telas, o quizMeta, ou os dois juntos. */
  function handleJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        setToast({ kind: "error", text: `O arquivo "${file.name}" não é um JSON válido: ${(e as Error).message}` });
        return;
      }

      let screensFound: unknown[] | null = null;
      let metaFound: Record<string, unknown> | null = null;

      if (Array.isArray(parsed)) {
        screensFound = parsed;
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.screens)) {
          screensFound = obj.screens;
          const { screens: _s, scoringMap: _sm, ...rest } = obj;
          if (Object.keys(rest).length > 0) metaFound = rest;
        } else if ("title" in obj || "leadFields" in obj) {
          metaFound = obj;
        } else {
          setToast({
            kind: "error",
            text: `Não reconheci o formato de "${file.name}". Esperado: uma lista de telas [ ... ], ou um objeto com "screens": [ ... ].`,
          });
          return;
        }
      }

      if (screensFound) {
        setScreensText(JSON.stringify(screensFound, null, 2));
      }
      if (metaFound) {
        if (typeof metaFound.title === "string") setTitle(metaFound.title);
        if (typeof metaFound.description === "string") setDescription(metaFound.description);
        if (typeof metaFound.logo === "string") setLogo(metaFound.logo);
        if (typeof metaFound.logoAlt === "string") setLogoAlt(metaFound.logoAlt);
        if (typeof metaFound.expertName === "string") setExpertName(metaFound.expertName);
        if (typeof metaFound.offerUrl === "string") setOfferUrl(metaFound.offerUrl);
      }
      const parts = [
        screensFound ? `${screensFound.length} tela(s)` : null,
        metaFound ? "informações do quiz" : null,
      ].filter(Boolean);
      setToast({ kind: "success", text: `Carregado de "${file.name}": ${parts.join(" + ")}. Confira embaixo e clique em Salvar.` });
    };
    reader.onerror = () => setToast({ kind: "error", text: `Não consegui ler o arquivo "${file.name}".` });
    reader.readAsText(file);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ kind: "success", text: "URL copiada." });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <Link to="/admin" className="text-xs text-muted-foreground hover:underline">
              ← Todos os quizzes
            </Link>
            <h1 className="text-xl font-bold text-foreground">{name || "Quiz sem nome"}</h1>
          </div>
          {domain && (
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Ver ao vivo ↗
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {/* ---------- Instruções ---------- */}
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-base font-bold text-foreground">Como usar essa página</h2>
          <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-foreground">
            <li>Lá embaixo em <strong>"Telas do quiz"</strong>, clique em <strong>"Importar arquivo"</strong> e escolha o <code className="rounded bg-muted px-1">.json</code> ou o <code className="rounded bg-muted px-1">.md</code> com a narrativa/perguntas.</li>
            <li>Preencha <strong>"Produto"</strong> (preço, link de pagamento, benefícios) — é sempre o mesmo produto, só preenche uma vez.</li>
            <li>Ajuste <strong>"Aparência"</strong> (cores, claro/escuro) se quiser.</li>
            <li>Marque <strong>Status = Publicado</strong> em "Configurações" quando estiver pronto pra ir ao ar.</li>
            <li>Clique em <strong>Salvar</strong> (botão azul, fixo embaixo). Não existe um botão separado de "construir" — Salvar já é o que publica tudo no domínio, na hora.</li>
          </ol>
        </section>

        {/* ---------- Configurações gerais ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Configurações</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome interno</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Domínio publicado</Label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="quiz.seudominio.com"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePublishDomain}
                  disabled={provisioning || !domain.trim()}
                  className="shrink-0"
                >
                  {provisioning ? "Publicando..." : "Publicar domínio"}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Antes de clicar: crie um registro <strong>tipo A</strong> pro domínio apontando pra{" "}
                <code className="rounded bg-muted px-1">{VPS_IP}</code> no lugar onde você comprou
                o domínio. Esse botão salva o quiz, confere se o DNS já propagou e, se sim,
                configura o site e o certificado HTTPS sozinho.
              </p>
            </div>
            <div>
              <Label>Nível</Label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as typeof tier)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Rascunho (não aparece no domínio)</option>
                <option value="published">Publicado</option>
              </select>
            </div>
          </div>
        </section>

        {/* ---------- Informações do quiz ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Informações do quiz</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Título (aparece na aba do navegador e no Google)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição (Google/compartilhamento)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>URL do logo</Label>
              <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="/uploads/... (envie na seção Imagens)" className="mt-1" />
            </div>
            <div>
              <Label>Texto alternativo do logo</Label>
              <Input value={logoAlt} onChange={(e) => setLogoAlt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nome do especialista/expert (opcional)</Label>
              <Input value={expertName} onChange={(e) => setExpertName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Foto do especialista — URL (opcional)</Label>
              <Input value={expertImage} onChange={(e) => setExpertImage(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Rota da página de oferta</Label>
              <Input value={offerUrl} onChange={(e) => setOfferUrl(e.target.value)} className="mt-1" />
            </div>
          </div>
        </section>

        {/* ---------- Aparência ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Aparência</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            "Escuro" troca fundo/cards pra uma base preta/carvão antes de aplicar as cores abaixo —
            use pra quiz com logo em fundo preto/neon (fica mais parecido com o padrão QBC/Governo
            Mental). As cores aceitam qualquer valor CSS (o seletor abaixo salva em hex).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Modo de fundo</Label>
              <select
                value={backgroundMode}
                onChange={(e) => setBackgroundMode(e.target.value as "light" | "dark")}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </div>
            <div>
              <Label>Cor primária</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#5B8DEF"}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 shrink-0 rounded border border-input bg-background"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#5B8DEF ou oklch(...)" />
              </div>
            </div>
            <div>
              <Label>Cor secundária</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : "#8B5CF6"}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-12 shrink-0 rounded border border-input bg-background"
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#8B5CF6 ou oklch(...)" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Mídia ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Imagens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie uma imagem, copie a URL gerada e cole no campo certo (ex: "URL do logo" acima, ou
            no campo <code className="rounded bg-muted px-1">image</code> de uma tela lá embaixo).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="mt-3 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
            disabled={uploading}
          />
          {uploading && <p className="mt-2 text-xs text-muted-foreground">Enviando...</p>}
          {media.length > 0 && (
            <ul className="mt-4 space-y-2">
              {media.map((m) => (
                <li key={m.url} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <img src={m.url} alt={m.filename} className="h-12 w-12 rounded object-cover" />
                  <code className="flex-1 truncate text-xs">{m.url}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(m.url)}>
                    Copiar URL
                  </Button>
                  <Button size="sm" onClick={() => setLogo(m.url)}>
                    Usar como logo
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Produto ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Produto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O produto é sempre o mesmo, independente da resposta — só a ênfase da oferta muda
            conforme a dor/desejo dominante do visitante (ver "Biblioteca de sinais" abaixo).
            Preencha aqui uma vez; a página de oferta usa isso pra montar o pitch sozinha.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome do produto</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Link de checkout</Label>
              <Input value={productCheckoutUrl} onChange={(e) => setProductCheckoutUrl(e.target.value)} placeholder="https://..." className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Promessa central (usada quando não há dor/desejo detectado)</Label>
              <Input value={productPromise} onChange={(e) => setProductPromise(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Preço</Label>
              <Input value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="R$ 47,00" className="mt-1" />
            </div>
            <div>
              <Label>Preço original (ancoragem, opcional)</Label>
              <Input value={productOriginalPrice} onChange={(e) => setProductOriginalPrice(e.target.value)} placeholder="R$ 997,00" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Parcelamento (opcional)</Label>
              <Input value={productInstallments} onChange={(e) => setProductInstallments(e.target.value)} placeholder="ou 12x de R$ 4,08" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Benefícios / o que o cliente recebe (um por linha)</Label>
              <textarea
                value={productBenefitsText}
                onChange={(e) => setProductBenefitsText(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Garantia (opcional)</Label>
              <Input value={productGuarantee} onChange={(e) => setProductGuarantee(e.target.value)} placeholder="Garantia incondicional de 7 dias" className="mt-1" />
            </div>
          </div>
        </section>

        {/* ---------- Biblioteca de sinais ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Biblioteca de dores e desejos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Isso é <strong>opcional</strong> — só mexa se quiser que a página de oferta mude de
            texto conforme as respostas do visitante. Cada linha abaixo é uma dor ou um desejo que
            uma resposta pode sinalizar. Depois, no arquivo JSON das telas, cada opção de resposta
            marca qual <strong>Código</strong> ela ativa (ex: <code className="rounded bg-muted px-1">"signals": ["pain_camera"]</code>).
            A oferta soma quantas vezes cada código apareceu e mostra a dor + o desejo mais fortes.
            Deixe a lista vazia se não quiser personalização — a oferta mostra o produto de forma genérica.
          </p>
          <div className="mt-4 space-y-4">
            {signals.map((s, i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Código (sem espaço, ex: pain_camera)</Label>
                      <Input
                        value={s.key}
                        onChange={(e) => updateSignal(i, { key: slugify(e.target.value) })}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <select
                        value={s.kind}
                        onChange={(e) => updateSignal(i, { kind: e.target.value as "pain" | "desire" })}
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="pain">Dor</option>
                        <option value="desire">Desejo</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Nome curto (só pra você identificar)</Label>
                      <Input value={s.label} onChange={(e) => updateSignal(i, { label: e.target.value })} className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Headline na oferta (use *palavra* pra destacar)</Label>
                      <Input value={s.headline} onChange={(e) => updateSignal(i, { headline: e.target.value })} className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Texto de apoio</Label>
                      <textarea
                        value={s.body}
                        onChange={(e) => updateSignal(i, { body: e.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeSignal(i)}>
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={addSignal} className="mt-4">
            + Adicionar dor/desejo
          </Button>
        </section>

        {/* ---------- Telas do quiz ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Telas do quiz (narrativa, perguntas, depoimentos)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Importe o arquivo <code className="rounded bg-muted px-1">.json</code> com as telas
            geradas (funciona tanto com uma lista <code className="rounded bg-muted px-1">[...]</code>{" "}
            quanto com um objeto completo com a chave{" "}
            <code className="rounded bg-muted px-1">"screens"</code>), ou direto o{" "}
            <code className="rounded bg-muted px-1">.md</code>/<code className="rounded bg-muted px-1">.txt</code>{" "}
            que a skill de quiz gera (os blocos "TELA 1 — FASE | TIPO: ..."). Telas mais complexas
            (seleção múltipla, gráficos) vêm marcadas com ⚠️ pra você revisar. Depois de importar, o
            conteúdo aparece no campo abaixo pra conferir antes de salvar.
          </p>
          <input
            ref={screensFileInputRef}
            type="file"
            accept=".json,application/json,.md,.markdown,text/markdown,.txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              if (screensFileInputRef.current) screensFileInputRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => screensFileInputRef.current?.click()}
            className="mt-3"
          >
            📄 Importar arquivo (.json ou .md)
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Ou edite direto aqui embaixo. Cole as URLs de imagem da seção "Imagens" nos campos{" "}
            <code className="rounded bg-muted px-1">image</code>. Vídeo é pelo ID do YouTube em{" "}
            <code className="rounded bg-muted px-1">video.youtubeId</code>.
          </p>
          <textarea
            value={screensText}
            onChange={(e) => setScreensText(e.target.value)}
            spellCheck={false}
            className="mt-3 h-[32rem] w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
          />
        </section>

        {/* ---------- Avançado ---------- */}
        <details className="rounded-2xl border border-border bg-card p-6">
          <summary className="cursor-pointer text-base font-bold text-foreground">
            Avançado (raramente precisa mexer aqui)
          </summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Campos do formulário de captação de lead (<code className="rounded bg-muted px-1">leadFields</code>)
            e rotas segmentadas por resposta (<code className="rounded bg-muted px-1">offerRouteByAnswer</code>),
            entre outros campos raros. Tudo que já tem formulário próprio (produto, aparência,
            sinais, informações básicas) foi tirado daqui — editar aqui não sobrescreve aquilo.
          </p>
          <textarea
            value={quizMetaText}
            onChange={(e) => setQuizMetaText(e.target.value)}
            spellCheck={false}
            className="mt-3 h-48 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
          />
        </details>
      </main>

      {toast && (
        <div
          className={`fixed inset-x-4 top-4 z-50 mx-auto max-w-2xl rounded-xl border p-4 text-sm shadow-lg ${
            toast.kind === "error"
              ? "border-destructive/40 bg-destructive text-destructive-foreground"
              : "border-emerald-600/40 bg-emerald-600 text-white"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-line">{toast.text}</p>
            <button onClick={() => setToast(null)} className="shrink-0 text-lg leading-none opacity-80 hover:opacity-100">
              ×
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {status === "published" ? "🟢 Publicado — salvar já atualiza o site ao vivo" : "⚪ Rascunho — não está no ar ainda"}
          </span>
          <Button onClick={handleSave} disabled={saving} className="ml-auto h-11 px-8 font-bold">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
