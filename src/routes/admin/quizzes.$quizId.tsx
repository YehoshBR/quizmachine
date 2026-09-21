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
type HeadlineVariantRow = { id: string; label: string; headline: string; subheadline: string | null; is_paused: boolean };
type HeadlineStatRow = { variant: HeadlineVariantRow; views: number; ctaClicks: number; leads: number; checkoutClicks: number };
type FunnelRow = { stepIndex: number; screenId: string; type: string; label: string; reached: number; dropoffPct: number | null };

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

  // Rastreamento e integrações
  const [facebookPixelId, setFacebookPixelId] = useState(quiz.quiz_meta.facebookPixelId ?? "");
  const [leadWebhookUrl, setLeadWebhookUrl] = useState(quiz.quiz_meta.leadWebhookUrl ?? "");
  const [customHeadScript, setCustomHeadScript] = useState(quiz.quiz_meta.customHeadScript ?? "");

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
      facebookPixelId: _fpid, leadWebhookUrl: _lwu, customHeadScript: _chs,
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
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const expertImageFileInputRef = useRef<HTMLInputElement>(null);

  // Extração automática de dores/desejos pela narrativa
  const [extracting, setExtracting] = useState(false);

  // Teste A/B de headline
  const [headlineStats, setHeadlineStats] = useState<HeadlineStatRow[]>([]);
  const [loadingHeadlines, setLoadingHeadlines] = useState(false);
  const [newVariantLabel, setNewVariantLabel] = useState("");
  const [newVariantHeadline, setNewVariantHeadline] = useState("");
  const [newVariantSubheadline, setNewVariantSubheadline] = useState("");
  const [savingVariant, setSavingVariant] = useState(false);

  // Abandono por tela
  const [funnelRows, setFunnelRows] = useState<FunnelRow[]>([]);
  const [loadingFunnel, setLoadingFunnel] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "success" ? 4000 : 9000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadHeadlineStats() {
    setLoadingHeadlines(true);
    try {
      const res = await fetch(`/api/admin/headline-stats?quizId=${quizId}`);
      const json = await res.json();
      if (json.ok) setHeadlineStats(json.stats);
    } catch {
      /* silencioso — não é crítico pro resto da página */
    } finally {
      setLoadingHeadlines(false);
    }
  }

  async function loadFunnelStats() {
    setLoadingFunnel(true);
    try {
      const res = await fetch(`/api/admin/funnel-stats?quizId=${quizId}`);
      const json = await res.json();
      if (json.ok) setFunnelRows(json.rows);
    } catch {
      /* silencioso */
    } finally {
      setLoadingFunnel(false);
    }
  }

  useEffect(() => {
    loadHeadlineStats();
    loadFunnelStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // Rastreamento e integrações
    if (facebookPixelId.trim()) quizMetaParsed.facebookPixelId = facebookPixelId.trim(); else delete quizMetaParsed.facebookPixelId;
    if (leadWebhookUrl.trim()) quizMetaParsed.leadWebhookUrl = leadWebhookUrl.trim(); else delete quizMetaParsed.leadWebhookUrl;
    if (customHeadScript.trim()) quizMetaParsed.customHeadScript = customHeadScript; else delete quizMetaParsed.customHeadScript;

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

  /** Upload direto pra um campo específico (logo, foto do especialista) — sem passar pela galeria. */
  async function uploadAndSet(file: File, setter: (url: string) => void, fieldLabel: string) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("quizId", quizId);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (json.ok) {
        setter(json.url);
        setMedia((m) => [{ url: json.url, filename: json.filename }, ...m]);
        setToast({ kind: "success", text: `${fieldLabel} atualizado(a).` });
      } else {
        setToast({ kind: "error", text: json.error ?? "Falha no upload." });
      }
    } catch {
      setToast({ kind: "error", text: "Falha no upload (rede)." });
    } finally {
      setUploading(false);
    }
  }

  /** Lê a narrativa das telas e sugere a biblioteca de dores/desejos + marca as opções — via IA. */
  async function handleExtractSignals() {
    setToast(null);
    let screensParsed: unknown;
    try {
      screensParsed = JSON.parse(screensText);
    } catch (e) {
      setToast({ kind: "error", text: `Corrija o JSON de "Telas do quiz" antes de gerar automaticamente: ${(e as Error).message}` });
      return;
    }
    if (!Array.isArray(screensParsed)) {
      setToast({ kind: "error", text: `"Telas do quiz" precisa ser uma lista de telas antes de gerar automaticamente.` });
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/api/admin/extract-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screens: screensParsed, product: { name: productName, promise: productPromise } }),
      });
      const json = await res.json();
      if (!json.ok) {
        setToast({ kind: "error", text: json.error ?? "Falha ao gerar automaticamente." });
        return;
      }
      const lib = json.signalLibrary as Record<string, { kind: "pain" | "desire"; label: string; headline: string; body: string }>;
      setSignals(Object.entries(lib).map(([key, def]) => ({ key, ...def })));

      const tags = (json.tags ?? {}) as Record<string, Record<string, string[]>>;
      const tagged = (screensParsed as Record<string, unknown>[]).map((s) => {
        const screenId = s.id as string;
        const screenTags = tags[screenId];
        if (!screenTags) return s;
        const applyTags = (opts: unknown) =>
          Array.isArray(opts)
            ? (opts as Record<string, unknown>[]).map((o) =>
                screenTags[o.value as string] ? { ...o, signals: screenTags[o.value as string] } : o
              )
            : opts;
        const patch: Record<string, unknown> = {};
        if (Array.isArray(s.options)) patch.options = applyTags(s.options);
        if (Array.isArray(s.firstOptions)) patch.firstOptions = applyTags(s.firstOptions);
        return Object.keys(patch).length ? { ...s, ...patch } : s;
      });
      setScreensText(JSON.stringify(tagged, null, 2));
      setToast({
        kind: "success",
        text: `Gerado: ${Object.keys(lib).length} sinal(is) identificado(s) e opções marcadas nas telas. Confira embaixo antes de salvar.`,
      });
    } catch (e) {
      setToast({ kind: "error", text: `Falha de rede: ${(e as Error).message}` });
    } finally {
      setExtracting(false);
    }
  }

  async function handleAddVariant() {
    if (!newVariantHeadline.trim()) return;
    setSavingVariant(true);
    try {
      const res = await fetch("/api/admin/headline-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          label: newVariantLabel.trim(),
          headline: newVariantHeadline.trim(),
          subheadline: newVariantSubheadline.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNewVariantLabel("");
        setNewVariantHeadline("");
        setNewVariantSubheadline("");
        setToast({ kind: "success", text: "Variante criada — já entra no sorteio dos próximos visitantes." });
        loadHeadlineStats();
      } else {
        setToast({ kind: "error", text: json.error ?? "Falha ao criar variante." });
      }
    } catch (e) {
      setToast({ kind: "error", text: `Falha de rede: ${(e as Error).message}` });
    } finally {
      setSavingVariant(false);
    }
  }

  async function toggleVariantPause(id: string, isPaused: boolean) {
    try {
      await fetch(`/api/admin/headline-variant?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaused }),
      });
      loadHeadlineStats();
    } catch {
      setToast({ kind: "error", text: "Falha ao atualizar variante." });
    }
  }

  async function deleteVariant(id: string) {
    try {
      await fetch(`/api/admin/headline-variant?id=${id}`, { method: "DELETE" });
      loadHeadlineStats();
    } catch {
      setToast({ kind: "error", text: "Falha ao remover variante." });
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
   * Converte texto gerado pela skill quiz-funnel-builder pro formato de tela
   * [Screen] deste motor. Aceita dois estilos:
   * 1) Markdown normal — o formato real que costuma sair — com
   *    "## FASE N: NOME (telas X a Y)" + "### Tela N | Tipo: ..." +
   *    "Função:"/"Personalização:" opcionais + parágrafos + lista "- opção".
   * 2) O template literal do SKILL.md: blocos "━━━" com cabeçalho
   *    "TELA N — FASE | TIPO: ..." numa linha só e opções "□ opção".
   * É um melhor-esforço: telas simples (pergunta única, intro, conteúdo,
   * prova social, loading, depoimentos, lead) saem prontas; seleção múltipla,
   * diagnóstico que ramifica por resposta anterior, e gráficos sem números
   * claros ficam marcados com ⚠️ pra revisão manual antes de salvar.
   */
  function parseMarkdownScreens(raw: string): { screens: Record<string, unknown>[]; reviewCount: number } {
    type ParsedBlock = { n: number; fase: string; tipoRaw: string; bodyLines: string[]; options: { label: string; value: string }[] };

    function stripAccentsLower(s: string): string {
      return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    }

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

    /** Prefere o parágrafo que termina em "?" — evita pegar uma nota entre
     * colchetes (ex: "[usar foto real...]") que sobrou depois da pergunta. */
    function pickQuestion(paragraphs: string[]): string {
      return paragraphs.find((p) => /\?\s*$/.test(p.trim())) ?? paragraphs[paragraphs.length - 1] ?? "";
    }

    function shortTitle(paragraphs: string[], fallback: string): string {
      const first = paragraphs[0]?.split("\n")[0]?.trim();
      if (!first) return fallback;
      return first.length <= 70 ? first : `${first.slice(0, 67)}...`;
    }

    const LIKERT_HINTS = ["concordo totalmente", "concordo parcialmente", "neutro", "discordo parcialmente", "discordo totalmente"];
    function looksLikeScale(options: { label: string }[]): boolean {
      if (options.length < 3) return false;
      const norm = options.map((o) => stripAccentsLower(o.label));
      return LIKERT_HINTS.filter((hint) => norm.some((n) => n.includes(hint))).length >= 3;
    }

    function classifyScreenType(tipoRaw: string, bodyText: string, hasOptions: boolean, options: { label: string }[]) {
      const t = stripAccentsLower(tipoRaw);
      const b = stripAccentsLower(bodyText);
      if (t.includes("intro")) return "intro";
      if (t.includes("multipla") || t.includes("multi-select") || t.includes("multi select")) return "multi-review";
      if (hasOptions && looksLikeScale(options)) return "scale";
      if (t.includes("escala") || t.includes("concordancia")) return "scale";
      const brancheMatches = bodyText.match(/se\s+a\s+tela\s+\d+\s*=/gi);
      if (brancheMatches && brancheMatches.length >= 2) return "branching-review";
      if (t.includes("carregamento") || t.includes("loading")) return "loading";
      if ((t.includes("diagnostico") || b.includes("nivel baixo")) && /cren[çc]a\s+central\s*[:\-]/i.test(bodyText)) return "diagnosis";
      if (t.includes("gate") || t.includes("captura") || t.includes("lead")) return "lead";
      if (t.includes("depoimentos") && !t.includes("prova social")) return "testimonials";
      if (t.includes("prova social") || t.includes("whatsapp") || t.includes("social-proof") || t.includes("social proof") || b.includes("inserir depoimento")) return "social-proof";
      if (t.includes("comparat") && /\d{1,3}\s*%[\s\S]*?\d{1,3}\s*%/.test(bodyText)) return "compare";
      if ((t.includes("mirror") || (b.includes("esforco") && b.includes("resultado"))) && /\d{1,3}\s*%[\s\S]*?\d{1,3}\s*%/.test(bodyText)) return "mirror-chart";
      if (t.includes("pergunta") || t.includes("unica") || t.includes("única") || t.includes("single")) return hasOptions ? "single" : "content";
      if (t.includes("conteudo") || t.includes("enquadramento") || t.includes("revelacao") || t.includes("quebra")) return "content";
      return hasOptions ? "single" : "content";
    }

    /** Extrai "## FASE N: NOME (telas X a Y)" pra saber a fase de cada tela pelo número. */
    function extractFaseRanges(text: string): { start: number; end: number; name: string }[] {
      const ranges: { start: number; end: number; name: string }[] = [];
      const re = /^#{1,3}\s*FASE\s*\d+\s*[:\-]\s*([^\n(]+?)\s*(?:\(\s*telas?\s+(\d+)(?:\s*a\s*(\d+))?\s*\))?\s*$/gim;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (!m[2]) continue;
        const start = Number(m[2]);
        const end = m[3] ? Number(m[3]) : start;
        ranges.push({ start, end, name: m[1].trim() });
      }
      return ranges;
    }
    function faseForN(ranges: { start: number; end: number; name: string }[], n: number): string {
      return ranges.find((r) => n >= r.start && n <= r.end)?.name ?? "";
    }

    /** Formato realista: "## FASE..." + "### Tela N | Tipo: ...". */
    function splitBlocksHeadingStyle(text: string): ParsedBlock[] {
      const faseRanges = extractFaseRanges(text);
      const parts = text.split(/(?=^#{1,4}\s)/m);
      const blocks: ParsedBlock[] = [];
      for (const part of parts) {
        const lines = part.split("\n");
        const header = lines[0] ?? "";
        const hm = header.match(/^#{1,4}\s*Tela\s*\[?\s*(\d+)\s*\]?\s*\|\s*Tipo\s*:\s*(.+)/i);
        if (!hm) continue; // ignora H1/H2 de título, fase ou seções depois do quiz
        const n = Number(hm[1]);
        const tipoRaw = hm[2].trim();
        const rest = lines
          .slice(1)
          .filter((l) => !/^Fun[çc][ãa]o\s*:/i.test(l.trim()))
          .filter((l) => !/^Personaliza[çc][ãa]o\s*:/i.test(l.trim()))
          .filter((l) => !/^\[\s*continuar\s*\]$/i.test(l.trim()))
          .filter((l) => !/^\[\s*tela\s+de\s+carregamento\s*\]$/i.test(l.trim()))
          .filter((l) => !/^-{3,}\s*$/.test(l.trim()));
        const { options, rest: bodyLines } = extractOptions(rest);
        blocks.push({ n, fase: faseForN(faseRanges, n), tipoRaw, bodyLines, options });
      }
      return blocks;
    }

    /** Formato literal do SKILL.md: separadores "━━━" e "TELA N — FASE | TIPO: ..." numa linha. */
    function splitBlocksLegacyStyle(text: string): ParsedBlock[] {
      const noSep = text
        .split("\n")
        .filter((l) => !/^[━=\-_*~]{5,}\s*$/.test(l.trim()))
        .join("\n");
      const parts = noSep.split(/(?=^\s*TELA\s*\[?\s*\d+)/im).map((p) => p.trim()).filter(Boolean);
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

    function buildScreen(block: ParsedBlock, isFirst: boolean): Record<string, unknown> {
      const id = `t${block.n}_${slugify(block.fase) || "tela"}`;
      const bodyLines = block.bodyLines;
      const paragraphs = buildParagraphs(bodyLines);
      const fullText = bodyLines.join("\n");
      const hasOptions = block.options.length > 0;
      const options = block.options.map((o) => ({ value: o.value, label: o.label }));
      // Por convenção deste motor (CLAUDE.md), a 1ª tela do quiz é sempre
      // "intro" — mesmo que o texto original chame ela de "pergunta".
      const kind = isFirst && hasOptions ? "intro" : classifyScreenType(block.tipoRaw, fullText, hasOptions, options);
      const heading = paragraphs[0] ?? "";
      const question = pickQuestion(paragraphs);
      const sub = paragraphs.length > 2 && paragraphs[1] !== question ? paragraphs[1] : undefined;

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
        case "scale": {
          const qLine = question || heading;
          const m = qLine.match(/^(.*?):\s*"(.+)"\s*$/);
          return {
            id, type: "scale",
            question: m ? `${m[1].trim()}:` : qLine || "Avalie o quanto você concorda:",
            statement: m ? m[2].trim() : paragraphs[1] ?? "",
          };
        }
        case "loading": {
          const quoted = fullText.match(/"([^"]{6,120})"/);
          const extraLines = paragraphs.slice(1).filter((p) => !/^\[/.test(p));
          return {
            id, type: "loading",
            title: quoted ? quoted[1].trim() : shortTitle(paragraphs, "Preparando seu plano personalizado..."),
            lines: extraLines.length ? extraLines : ["Analisando suas respostas...", "Quase pronto..."],
            durationMs: 4000,
          };
        }
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
            title: shortTitle(paragraphs, "Sua probabilidade de resultado: NÍVEL BAIXO"),
            levels: ["Iniciante", "Em Formação", "Crescendo", "Pronto", "Expert"],
            levelColors: ["bg-destructive", "bg-orange-500", "bg-amber-400", "bg-lime-400", "bg-emerald-500"],
            label: "Você",
            targetPct: 22,
            cards,
          };
        }
        case "branching-review":
          return {
            id, type: "content",
            title: `⚠️ REVISAR MANUALMENTE (diagnóstico muda por resposta anterior): ${shortTitle(paragraphs, `Tela ${block.n}`)}`,
            body: [
              "Esta tela muda de conteúdo dependendo de uma resposta anterior do quiz. Este",
              "importador não monta lógica dinâmica sozinho — escolha manualmente qual texto usar",
              "aqui (ou peça pra implementar a ramificação de verdade no motor). Texto original completo:",
              "",
              fullText,
            ].join("\n"),
          };
        case "compare": {
          const rowRe = /^[-*•]?\s*\[?([^:%\n]{2,60}?)\]?\s*[:\-]?\s*(\d{1,3})\s*%.*?(\d{1,3})\s*%/;
          const rows = bodyLines
            .map((l) => l.match(rowRe))
            .filter((m): m is RegExpMatchArray => !!m)
            .map((m) => ({ label: m[1].trim(), beforePct: Number(m[2]), afterPct: Number(m[3]) }));
          return {
            id, type: "compare",
            title: shortTitle(paragraphs, "Veja a diferença de quem age:"),
            beforeLabel: "Antes", afterLabel: "Depois",
            rows: rows.length ? rows : [{ label: "⚠️ A revisar — preencha as métricas", beforePct: 20, afterPct: 80 }],
          };
        }
        case "mirror-chart": {
          const pcts = Array.from(fullText.matchAll(/(\d{1,3})\s*%/g)).map((m) => Number(m[1]));
          return {
            id, type: "mirror-chart",
            ...(paragraphs.length > 2 ? { intro: heading } : {}),
            title: paragraphs.length > 2 ? paragraphs[1] : shortTitle(paragraphs, "Antes de encontrar a solução..."),
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
            title: shortTitle(paragraphs, "Veja quem já transformou:"),
            items: items.length ? items : [{ name: "Depoimento", text: paragraphs.join(" ") || "⚠️ A revisar" }],
          };
        }
        case "social-proof":
          return {
            id, type: "social-proof",
            title: shortTitle(paragraphs, "Veja o que estão dizendo:"),
            body: paragraphs.join("\n\n") || "",
          };
        case "lead":
          return { id, type: "lead", title: shortTitle(paragraphs, "Última etapa antes de receber seu plano"), subtitle: paragraphs[1] };
        case "multi-review":
          return {
            id, type: "content",
            title: `⚠️ REVISAR MANUALMENTE (era seleção múltipla): ${shortTitle(paragraphs, `Tela ${block.n}`)}`,
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
            title: shortTitle(paragraphs, `Tela ${block.n}`),
            body: paragraphs.join("\n\n") || "",
          };
      }
    }

    const cleaned = raw.replace(/\r\n/g, "\n");
    const usesHeadings = /^#{1,4}\s*Tela\s+\d+/im.test(cleaned);
    const blocks = usesHeadings ? splitBlocksHeadingStyle(cleaned) : splitBlocksLegacyStyle(cleaned);
    const firstN = Math.min(...blocks.map((b) => b.n));
    const screens = blocks.map((b) => buildScreen(b, b.n === firstN));
    const reviewCount = screens.filter((s) => typeof s.title === "string" && (s.title as string).startsWith("⚠️")).length;
    return { screens, reviewCount };
  }

  function handleMarkdownFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      if (!/#{1,4}\s*Tela\s+\d+/i.test(raw) && !/TELA\s*\[?\s*\d+/i.test(raw)) {
        setToast({
          kind: "error",
          text: `Não reconheci o formato de "${file.name}". Esperado o texto gerado pela skill de quiz, com blocos "### Tela 1 | Tipo: ..." (ou "TELA 1 — FASE | TIPO: ...").`,
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
              <div className="mt-1 flex gap-2">
                <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="/uploads/..." />
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAndSet(file, setLogo, "Logo");
                    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
                  }}
                />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => logoFileInputRef.current?.click()} className="shrink-0">
                  📤 Enviar
                </Button>
              </div>
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
              <div className="mt-1 flex gap-2">
                <Input value={expertImage} onChange={(e) => setExpertImage(e.target.value)} />
                <input
                  ref={expertImageFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAndSet(file, setExpertImage, "Foto do especialista");
                    if (expertImageFileInputRef.current) expertImageFileInputRef.current.value = "";
                  }}
                />
                <Button type="button" variant="outline" disabled={uploading} onClick={() => expertImageFileInputRef.current?.click()} className="shrink-0">
                  📤 Enviar
                </Button>
              </div>
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
          <Button type="button" variant="outline" onClick={handleExtractSignals} disabled={extracting} className="mt-3">
            {extracting ? "Analisando as telas..." : "✨ Gerar automaticamente pela narrativa"}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Lê as telas do quiz (carregadas lá embaixo) e sugere a biblioteca inteira + marca as
            opções sozinho. Substitui a lista abaixo — confira antes de salvar.
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

        {/* ---------- Teste A/B de headline ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-foreground">Teste de headline (A/B)</h2>
            <Button type="button" size="sm" variant="outline" onClick={loadHeadlineStats} disabled={loadingHeadlines}>
              {loadingHeadlines ? "Atualizando..." : "↻ Atualizar"}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre 2 ou mais variantes de headline pra tela de abertura. Cada visitante novo recebe
            uma sorteada; o sistema conta visualizações, cliques, leads e cliques no checkout de cada
            uma — e a otimização automática (roda 1x por dia) pausa sozinha as que estiverem perdendo
            feio e propõe headlines novas com IA quando houver dado suficiente. Sem nenhuma variante
            cadastrada, todo mundo vê o headline fixo da tela intro.
          </p>

          {headlineStats.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Variante</th>
                    <th className="py-2 pr-3">Views</th>
                    <th className="py-2 pr-3">Cliques</th>
                    <th className="py-2 pr-3">CTR</th>
                    <th className="py-2 pr-3">Leads</th>
                    <th className="py-2 pr-3">Checkout</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {headlineStats.map(({ variant, views, ctaClicks, leads, checkoutClicks }) => (
                    <tr key={variant.id} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-foreground">{variant.label}</p>
                        <p className="max-w-xs text-xs text-muted-foreground">{variant.headline}</p>
                      </td>
                      <td className="py-2 pr-3">{views}</td>
                      <td className="py-2 pr-3">{ctaClicks}</td>
                      <td className="py-2 pr-3">{views > 0 ? `${Math.round((ctaClicks / views) * 1000) / 10}%` : "—"}</td>
                      <td className="py-2 pr-3">{leads}</td>
                      <td className="py-2 pr-3">{checkoutClicks}</td>
                      <td className="py-2 pr-3">
                        {variant.is_paused ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Pausada</span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">Ativa</span>
                        )}
                      </td>
                      <td className="space-x-2 py-2 text-right">
                        <Button type="button" size="sm" variant="ghost" onClick={() => toggleVariantPause(variant.id, !variant.is_paused)}>
                          {variant.is_paused ? "Reativar" : "Pausar"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => deleteVariant(variant.id)}>
                          Remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-dashed border-border p-4">
            <p className="text-sm font-semibold text-foreground">+ Nova variante</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Rótulo (só pra você identificar)</Label>
                <Input value={newVariantLabel} onChange={(e) => setNewVariantLabel(e.target.value)} placeholder="Ex: Variante urgência" className="mt-1" />
              </div>
              <div>
                <Label>Headline</Label>
                <Input value={newVariantHeadline} onChange={(e) => setNewVariantHeadline(e.target.value)} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label>Subheadline (opcional)</Label>
                <Input value={newVariantSubheadline} onChange={(e) => setNewVariantSubheadline(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button type="button" onClick={handleAddVariant} disabled={savingVariant || !newVariantHeadline.trim()} className="mt-3">
              {savingVariant ? "Criando..." : "+ Adicionar variante"}
            </Button>
          </div>
        </section>

        {/* ---------- Abandono por tela ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-foreground">Abandono por tela</h2>
            <Button type="button" size="sm" variant="outline" onClick={loadFunnelStats} disabled={loadingFunnel}>
              {loadingFunnel ? "Atualizando..." : "↻ Atualizar"}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quantas sessões chegaram em cada tela e quanto % caiu antes da próxima — pra achar a tela
            que está travando o funil. Só aparece dado depois que o quiz recebe visitas reais.
          </p>
          {funnelRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {loadingFunnel ? "Carregando..." : "Ainda sem dados de visitas registradas."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Tela</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Alcançou</th>
                    <th className="py-2 pr-3">Abandono até a próxima</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelRows.map((r) => (
                    <tr key={r.screenId} className="border-b border-border/60">
                      <td className="py-2 pr-3 text-muted-foreground">{r.stepIndex}</td>
                      <td className="max-w-xs truncate py-2 pr-3 font-medium text-foreground">{r.label || r.screenId}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.type}</td>
                      <td className="py-2 pr-3">{r.reached}</td>
                      <td className="py-2 pr-3">
                        {r.dropoffPct == null ? (
                          "—"
                        ) : (
                          <span className={r.dropoffPct >= 30 ? "font-bold text-destructive" : r.dropoffPct >= 15 ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                            {r.dropoffPct >= 30 ? "⚠️ " : ""}
                            {r.dropoffPct}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------- Rastreamento e integrações ---------- */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-bold text-foreground">Rastreamento e integrações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tudo opcional. O pixel e o script vão em toda página pública do quiz (intro, perguntas e
            oferta); o webhook é chamado toda vez que um lead é capturado.
          </p>
          <div className="mt-4 grid gap-4">
            <div>
              <Label>Facebook Pixel ID</Label>
              <Input value={facebookPixelId} onChange={(e) => setFacebookPixelId(e.target.value)} placeholder="123456789012345" className="mt-1" />
            </div>
            <div>
              <Label>Webhook de leads (POST em JSON a cada lead capturado)</Label>
              <Input value={leadWebhookUrl} onChange={(e) => setLeadWebhookUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." className="mt-1" />
            </div>
            <div>
              <Label>Script personalizado no &lt;head&gt; (GTM, TikTok Pixel, Google Ads...)</Label>
              <textarea
                value={customHeadScript}
                onChange={(e) => setCustomHeadScript(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder="Cole só o conteúdo JavaScript do script (sem as tags <script>...</script>)"
                className="mt-1 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs"
              />
            </div>
          </div>
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
