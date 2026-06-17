// ============================================================
// QUIZ-CONFIG.TS — ÚNICO ARQUIVO QUE VOCÊ EDITA POR QUIZ
// ============================================================
// Leia o CLAUDE.md para entender como usar esta máquina.
// Nunca modifique outros arquivos para trocar conteúdo.
// ============================================================

// ---------- TIPOS ----------

export interface QuizMeta {
  title: string;
  description: string;
  logo: string;
  logoAlt: string;
  expertName?: string;
  expertImage?: string;
  productName?: string;
  offerUrl: string;
  offerRouteByAnswer?: Record<string, string>;
  leadFields: LeadField[];
}

export interface LeadField {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "tel" | "email" | "number";
  required?: boolean;
}

type Option = {
  value: string;
  label: string;
  image?: string;
  emoji?: string;
};

type Quote = { author: string; text: string };

export type Screen =
  | {
      id: string;
      type: "intro";
      headline: string;
      subheadline?: string;
      firstQuestion: string;
      firstOptions: Option[];
      badge?: string;
    }
  | {
      id: string;
      type: "single";
      question: string;
      options: Option[];
      grid?: 2 | 4;
    }
  | {
      id: string;
      type: "multi";
      question: string;
      options: Option[];
      subtitle?: string;
      minSelect?: number;
    }
  | {
      id: string;
      type: "scale";
      question: string;
      statement: string;
    }
  | {
      id: string;
      type: "content";
      title: string;
      body: string;
      image?: string;
      highlight?: string;
      quote?: Quote;
    }
  | {
      id: string;
      type: "social-proof";
      title: string;
      body: string;
      stat?: string;
      source?: string;
      image?: string;
      whatsapp?: { author: string; text: string; meta: string };
    }
  | {
      id: string;
      type: "loading";
      title: string;
      lines: string[];
      durationMs?: number;
    }
  | {
      id: string;
      type: "diagnosis";
      title: string;
      subtitle?: string;
      barLabel?: string;         // texto acima da barra colorida (ex: "Aptidão do tutor")
      levels: string[];
      levelColors: string[];
      label: string;
      targetPct: number | "computed";
      cards?: { label: string; name: string; desc: string }[];
      // highlightCard estático — use OU dynamicHighlight, não os dois
      highlightCard?: {
        color: "success" | "warning" | "danger";
        title: string;
        body: string;
      };
      // dynamicHighlight — como SoulBicho: muda conforme pct cresce
      // Ordenar do maior minPct para o menor (o primeiro que satisfizer é usado)
      dynamicHighlight?: Array<{
        minPct: number;
        color: "success" | "warning" | "danger";
        title: string;
        body: string;
      }>;
    }
  | {
      id: string;
      type: "compare";
      title: string;
      beforeLabel: string;
      afterLabel: string;
      rows: { label: string; beforePct: number; afterPct: number }[];
      summaryBefore?: { value: string; desc: string };
      summaryAfter?: { value: string; desc: string };
      durationMs?: number;
    }
  | {
      id: string;
      type: "testimonials";
      title: string;
      items: { name: string; text: string; avatar?: string }[];
    }
  | {
      id: string;
      type: "mirror-chart";
      intro?: string;
      title: string;
      insight: string;
      effortPct: number;
      resultPct: number;
      effortLabel?: string;
      resultLabel?: string;
    }
  | {
      id: string;
      type: "lead";
      title: string;
      subtitle?: string;
      expertImage?: string;
      ctaText?: string;
      privacyText?: string;
    };

// ============================================================
// CONFIGURAÇÃO DO QUIZ — EDITE AQUI
// ============================================================

// TODO: importar logo real
// import logoImg from "@/assets/logo.png";

// TODO: importar imagens de gênero
// import homemImg from "@/assets/homem.jpg";
// import mulherImg from "@/assets/mulher.jpg";

// TODO: importar imagens de idade (masculino)
// import homem19Img from "@/assets/homens/19-29.webp";
// import homem30Img from "@/assets/homens/30-39.webp";
// import homem40Img from "@/assets/homens/40-49.webp";
// import homem50Img from "@/assets/homens/50-plus.webp";

// TODO: importar imagens de idade (feminino)
// import mulher19Img from "@/assets/mulheres/19-29.webp";
// import mulher30Img from "@/assets/mulheres/30-39.webp";
// import mulher40Img from "@/assets/mulheres/40-49.webp";
// import mulher50Img from "@/assets/mulheres/50-plus.webp";

// TODO: importar foto do expert
// import expertImg from "@/assets/expert.jpg";

export const quizMeta: QuizMeta = {
  title: "Quiz — [Nome do Quiz]",
  description: "[Descrição para SEO/redes sociais]",
  logo: "/logo.png", // TODO: trocar pelo import após adicionar o arquivo
  logoAlt: "[Nome da Marca]",
  expertName: "[Nome do Expert]",
  expertImage: "/expert.jpg", // TODO: trocar pelo import
  productName: "[Nome do Produto/Método]",
  offerUrl: "/oferta",
  leadFields: [
    {
      id: "name",
      label: "Seu nome",
      placeholder: "Como quer ser chamado(a)?",
      type: "text",
      required: true,
    },
    {
      id: "secondary",
      label: "[Campo personalizado]", // ex: "Nome do seu pet", "Nome da sua empresa"
      placeholder: "[Placeholder]",
      type: "text",
      required: true,
    },
    {
      id: "whatsapp",
      label: "Seu WhatsApp",
      placeholder: "(11) 99999-9999",
      type: "tel",
      required: true,
    },
  ],
};

// ============================================================
// TELAS DO QUIZ
// Substitua este array com as telas geradas para o novo quiz.
// ============================================================

export const screens: Screen[] = [
  // TELA 0 — Intro com 1ª pergunta embutida
  {
    id: "intro",
    type: "intro",
    headline: "HEADLINE PRINCIPAL EM CAPS — FALA COM A DOR DO AVATAR",
    subheadline: "Subtítulo explicativo com o benefício principal do quiz.",
    firstQuestion: "Você é Homem ou Mulher?",
    firstOptions: [
      { value: "homem", label: "Homem", image: "/placeholder-homem.jpg" }, // TODO: substituir pela imagem real
      { value: "mulher", label: "Mulher", image: "/placeholder-mulher.jpg" }, // TODO: substituir pela imagem real
    ],
    badge: "🕐 Leva menos de 3 minutos",
  },

  // TELA 1 — Seleção de idade (com imagens)
  {
    id: "idade",
    type: "single",
    question: "Qual a sua <hl>idade</hl>?",
    grid: 2,
    options: [
      { value: "19-29", label: "19–29 anos", image: "/placeholder-idade.jpg" }, // TODO: imagem por gênero
      { value: "30-39", label: "30–39 anos", image: "/placeholder-idade.jpg" },
      { value: "40-49", label: "40–49 anos", image: "/placeholder-idade.jpg" },
      { value: "50+",   label: "50+ anos",   image: "/placeholder-idade.jpg" },
    ],
  },

  // TELA 2 — Pergunta de engajamento
  {
    id: "perfil",
    type: "single",
    question: "Com qual <hl>perfil</hl> você mais se identifica?",
    options: [
      { value: "a", label: "🏠 Opção A" },
      { value: "b", label: "😤 Opção B" },
      { value: "c", label: "👶 Opção C" },
      { value: "d", label: "🌱 Opção D" },
    ],
  },

  // TELA 3 — Conteúdo/insight
  {
    id: "insight_1",
    type: "content",
    title: "Título do insight ou dado de pesquisa impactante",
    body: "Corpo explicativo do insight.\n\nPode ter múltiplos parágrafos.",
    highlight: "Dado ou estatística em destaque",
  },

  // TELA 4 — Multi
  {
    id: "sintomas",
    type: "multi",
    question: "Quais dessas situações você já viveu?",
    subtitle: "Selecione tudo que se aplica",
    options: [
      { value: "a", label: "😖 Sintoma/situação A" },
      { value: "b", label: "😢 Sintoma/situação B" },
      { value: "c", label: "👃 Sintoma/situação C" },
      { value: "d", label: "💩 Sintoma/situação D" },
      { value: "e", label: "🤢 Sintoma/situação E" },
      { value: "f", label: "😴 Sintoma/situação F" },
    ],
  },

  // TELA 5 — Scale
  {
    id: "escala_1",
    type: "scale",
    question: "Avalie o quanto você concorda com a frase:",
    statement: "Frase para avaliar na escala Likert",
  },

  // TELA 6 — Prova social
  {
    id: "prova_1",
    type: "social-proof",
    title: "Veja o que estão dizendo:",
    body: "Contexto sobre o resultado ou depoimento.",
    stat: "2.347",
    source: "pessoas já transformadas",
    whatsapp: {
      author: "Ana S.",
      text: "Mensagem de depoimento estilo WhatsApp aqui.",
      meta: "hoje às 14:32",
    },
  },

  // TELA 7 — Mirror chart
  {
    id: "espelho",
    type: "mirror-chart",
    intro: "Antes de encontrar a solução, a maioria das pessoas conta a mesma história…",
    title: '"Tentei de tudo. Mas continuava no mesmo lugar."',
    insight: "Era muito esforço. Pouco resultado. E a causa estava na falta de método.",
    effortPct: 83,
    resultPct: 14,
    effortLabel: "Esforço — tentativas, cursos, pesquisas",
    resultLabel: "Resultado percebido após 3 meses",
  },

  // TELA 8 — Depoimentos
  {
    id: "depoimentos",
    type: "testimonials",
    title: "Veja quem já transformou sua vida:",
    items: [
      { name: "Fulano A.", text: "Depoimento A — resultado específico em tempo definido." },
      { name: "Fulana B.", text: "Depoimento B — resultado específico em tempo definido." },
      { name: "Fulano C.", text: "Depoimento C — resultado específico em tempo definido." },
    ],
  },

  // TELA 9 — Diagnóstico animado
  {
    id: "diagnostico",
    type: "diagnosis",
    title: "Seu nível de prontidão:",
    levels: ["Iniciante", "Desenvolvendo", "Crescendo", "Pronto", "Expert"],
    levelColors: ["bg-destructive", "bg-orange-500", "bg-amber-400", "bg-lime-400", "bg-emerald-500"],
    label: "Você",
    targetPct: 78,
    highlightCard: {
      color: "success",
      title: "VOCÊ ESTÁ PRONTO(A) — Aptidão 78%",
      body: "Pelas suas respostas, você tem tudo para começar. O que falta é um plano personalizado.",
    },
    cards: [
      { label: "❤️ Motivação", name: "Alta", desc: "Você quer mudar" },
      { label: "🧠 Consciência", name: "Crescendo", desc: "Já pesquisa sobre o tema" },
      { label: "🧩 O que falta", name: "Método", desc: "Um plano estruturado" },
      { label: "🎯 Resultado esperado", name: "Meta atingida", desc: "Em 30-60 dias" },
    ],
  },

  // TELA 10 — Comparação animada
  {
    id: "comparacao",
    type: "compare",
    title: "Veja a diferença de quem fica parado x quem age:",
    beforeLabel: "Sem o Método",
    afterLabel: "Com o Método",
    rows: [
      { label: "Resultado A", beforePct: 15, afterPct: 85 },
      { label: "Resultado B", beforePct: 88, afterPct: 12 },
      { label: "Resultado C", beforePct: 10, afterPct: 90 },
      { label: "Resultado D", beforePct: 80, afterPct: 15 },
      { label: "Resultado E", beforePct: 18, afterPct: 94 },
    ],
    summaryBefore: { value: "75%", desc: "continuam no mesmo lugar após 6 meses" },
    summaryAfter: { value: "91%", desc: "viram resultado real nas primeiras 4 semanas" },
  },

  // TELA 11 — Lead (PENÚLTIMA — nunca mover)
  {
    id: "lead",
    type: "lead",
    title: "Última etapa antes de receber seu plano personalizado",
    subtitle: "Informe seus dados para receber o diagnóstico completo.",
    ctaText: "RECEBER MEU PLANO →",
    privacyText: "🔒 Seus dados estão seguros e não serão compartilhados.",
  },

  // TELA 12 — Loading final (ÚLTIMA — nunca mover)
  {
    id: "loading_final",
    type: "loading",
    title: "Com base nas suas respostas, preparamos um plano personalizado para você.",
    lines: [
      "Analisando seu perfil...",
      "Cruzando com dados do mercado...",
      "Calculando seu potencial...",
      "Montando o protocolo personalizado...",
      "Quase pronto. Finalizando seu diagnóstico...",
    ],
    durationMs: 4000,
  },
];
