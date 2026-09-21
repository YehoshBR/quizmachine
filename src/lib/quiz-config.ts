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
  /** Cor primária do tema (qualquer valor CSS válido: hex, oklch(...), rgb(...)). Sobrescreve --primary. */
  primaryColor?: string;
  /** Cor secundária do tema. Sobrescreve --secondary. */
  secondaryColor?: string;
  /** "dark" troca fundo/cards pra uma paleta escura (preto/carvão) antes de aplicar as cores acima. Padrão: "light". */
  backgroundMode?: "light" | "dark";
  /**
   * Dados do PRODUTO — sempre o mesmo produto, independente da resposta.
   * Preenchido uma vez no painel ao montar o quiz. A /oferta usa isso pra
   * montar o pitch; o que muda por visitante é só qual dor/desejo é destacado
   * primeiro (ver `signalLibrary` + `Option.signals`).
   */
  product?: ProductInfo;
  /**
   * Biblioteca de dores/desejos que as opções do quiz podem sinalizar (via
   * `Option.signals`). A /oferta soma quantas vezes cada sinal apareceu nas
   * respostas do visitante e personaliza a headline/corpo com os sinais mais
   * fortes. Sem isso configurado, a oferta cai pro conteúdo genérico do produto.
   */
  signalLibrary?: Record<string, SignalDef>;
  /** Facebook Pixel ID (só o número/ID) — injeta o script padrão + PageView em toda página pública. */
  facebookPixelId?: string;
  /** URL que recebe um POST JSON com os dados do lead assim que ele é capturado (Zapier, Make, CRM...). */
  leadWebhookUrl?: string;
  /** HTML/script cru injetado no <head> das páginas públicas (GTM, TikTok Pixel, Google Ads, etc). */
  customHeadScript?: string;
}

export interface ProductInfo {
  name: string;
  /** Frase de efeito — a promessa central do produto (usada como base da headline). */
  promise: string;
  price: string;
  installments?: string;
  originalPrice?: string;
  checkoutUrl: string;
  /** Lista de benefícios/entregáveis — vira a lista "o que você recebe" na oferta. */
  benefits: string[];
  guarantee?: string;
}

export type SignalDef = {
  label: string;
  kind: "pain" | "desire";
  /** Headline curta usada na oferta quando este é o sinal dominante. Use *palavra* pra destacar. */
  headline: string;
  /** 1-2 frases desenvolvendo o sinal, tocando na dor/desejo específico. */
  body: string;
};

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
  /** Chaves de `quizMeta.signalLibrary` que essa resposta sinaliza (dor e/ou desejo). Opcional. */
  signals?: string[];
};

type Quote = { author: string; text: string };

/**
 * Um vídeo curto e opcional (formato "capa clicável", nunca autoplay) que pode
 * aparecer em telas de prova social ou depoimentos. `youtubeId` é o ID do vídeo
 * no YouTube (a parte depois de `v=` na URL).
 */
type VideoFacade = { youtubeId: string; label?: string };

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
      video?: VideoFacade;
    }
  | {
      id: string;
      type: "loading";
      title: string;
      lines: string[];
      durationMs?: number;
      /**
       * Ícones do loading temático (opcional). Cada glifo é um path SVG desenhado
       * numa caixa de -18 a 18 centrada em (0,0) — ver LOADER_GLYPHS_* em
       * ThemedLoader.tsx para exemplos prontos por nicho. Se omitido, usa o
       * conjunto neutro padrão.
       */
      glyphs?: { id: string; d: string }[];
    }
  | {
      id: string;
      type: "diagnosis";
      title: string;
      subtitle?: string;
      barLabel?: string;
      levels: string[];
      levelColors: string[];
      label: string;
      targetPct: number | "computed";
      cards?: { label: string; name: string; desc: string }[];
      highlightCard?: {
        color: "success" | "warning" | "danger";
        title: string;
        body: string;
      };
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
      video?: VideoFacade;
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
// CONFIGURAÇÃO DO QUIZ — DIGITAL START | RENAN E FRAN
// ============================================================

import logoImg from "@/assets/logo.png";
import homemImg from "@/assets/homem.jpg";
import mulherImg from "@/assets/mulher.jpg";
// TODO: substituir pela foto real de Renan e Fran (bastidor de palco / evento)
// import expertImg from "@/assets/expert.jpg";

// ============================================================
// MAPA DE PONTUAÇÃO
// Este funil tem diagnóstico FIXO em "BAIXO" (por design da narrativa),
// então o scoringMap fica vazio e a régua usa targetPct fixo na tela de diagnóstico.
// ============================================================

export const scoringMap: Record<string, Record<string, number>> = {};

export const quizMeta: QuizMeta = {
  title: "Qual é o seu Nível de Visibilidade Digital? — DIGITAL START",
  description:
    "Faça o teste e descubra o que está travando a sua presença digital mesmo com a autoridade que você já construiu na vida real. 45 perguntas rápidas, diagnóstico personalizado no final.",
  logo: logoImg as unknown as string,
  logoAlt: "DIGITAL START — Renan e Fran",
  expertName: "Renan e Fran",
  // expertImage: "/expert.jpg", // TODO: adicionar foto e reativar
  productName: "DIGITAL START",
  offerUrl: "/oferta",
  // Preto + neon azul/roxo — pra bater com o logo (badge preto, wordmark em
  // gradiente azul/roxo). O tema claro (SoulBicho) brigava com esse logo.
  backgroundMode: "dark",
  primaryColor: "#5B8DEF",
  secondaryColor: "#8B5CF6",
  product: {
    name: "DIGITAL START",
    promise: "Tirar você da invisibilidade digital e colocar no Instagram a autoridade que você já construiu na vida real",
    price: "R$ 47,00",
    installments: "ou 12x de R$ 4,08",
    originalPrice: "R$ 2.335,00",
    checkoutUrl: "https://payfast.greenn.com.br/9ccsf78",
    benefits: [
      "Curso completo Digital Start com Renan e Fran",
      "Estratégias de crescimento e de formatos de conteúdo",
      "Acesso vitalício à área de membros",
      "Comunidade Digital Start",
      "Uma aula por semana ao vivo com Renan e Fran",
    ],
    guarantee: "Garantia incondicional de 7 dias — ou seu dinheiro de volta, sem perguntas.",
  },
  signalLibrary: {
    pain_camera: {
      label: "Trava na câmera",
      kind: "pain",
      headline: "Você não precisa *perder a vergonha* pra começar. Precisa de uma estrutura pra gravar sem travar.",
      body: "Você já gravou, assistiu, não gostou e apagou. O problema nunca foi a câmera — foi não ter uma linha editorial que te diga exatamente o que falar.",
    },
    pain_invisibilidade: {
      label: "Invisibilidade digital",
      kind: "pain",
      headline: "Você tem *autoridade* na vida real. No digital, quase ninguém sabe disso.",
      body: "Seu perfil não mostra o tamanho do que você já construiu. Pra uma boa parte do mercado, você simplesmente não existe.",
    },
    pain_comparacao: {
      label: "Comparação paralisante",
      kind: "pain",
      headline: "Enquanto você fica *parado*, alguém com metade da sua experiência está sendo tratado como referência.",
      body: "Ver gente menos preparada crescendo não deveria te congelar — deveria te mostrar que o jogo é sobre visibilidade, não só competência.",
    },
    pain_recomeco: {
      label: "Ciclo do recomeço",
      kind: "pain",
      headline: "Chega de *começar* e parar. Dessa vez o plano tem ordem.",
      body: "Você já tentou postar com constância várias vezes. O problema nunca foi disciplina — foi tentar postar sem posicionamento antes.",
    },
    pain_posicionamento: {
      label: "Falta de posicionamento",
      kind: "pain",
      headline: "O problema nunca foi *o que postar*. Foi não ter um posicionamento antes de postar.",
      body: "Sem saber quem você é no digital e pra quem você fala, todo conteúdo vira tentativa e erro.",
    },
    pain_financeiro: {
      label: "Perda financeira",
      kind: "pain",
      headline: "Cada mês invisível é *dinheiro* que devia estar no seu bolso.",
      body: "Clientes e oportunidades já passaram por você e foram pra quem apareceu mais — não pra quem sabia mais.",
    },
    pain_julgamento: {
      label: "Medo de julgamento",
      kind: "pain",
      headline: "Ninguém vai te achar *se achando* por mostrar o que você já construiu.",
      body: "O medo do julgamento de quem te conhece é o que mais trava profissionais bons. A Digital Start te dá o roteiro pra aparecer sem parecer forçado.",
    },
    pain_autossabotagem: {
      label: "Autossabotagem",
      kind: "pain",
      headline: "Você não precisa *acreditar* 100% ainda. Precisa só de um plano claro pra seguir.",
      body: "A dúvida de que 'isso não é pra mim' desaparece assim que você tem um passo a passo pronto, não teoria solta.",
    },
    pain_tempo_perdido: {
      label: "Timing perdido",
      kind: "pain",
      headline: "O timing *não passou*. Só ainda não tinha o mapa certo.",
      body: "A sensação de atraso é só isso: sensação. Quem começa com posicionamento certo recupera o tempo rápido.",
    },
    desire_autoridade: {
      label: "Deseja autoridade",
      kind: "desire",
      headline: "Coloque no digital a *autoridade* que você já tem na vida real.",
      body: "Você quer ser visto como referência na sua área — e isso se constrói com posicionamento, não com sorte.",
    },
    desire_clientes: {
      label: "Deseja mais clientes",
      kind: "desire",
      headline: "Clientes chegando até *você*, sem precisar correr atrás.",
      body: "Um perfil que comunica quem você é vira a sua melhor fonte de indicação — 24 horas por dia.",
    },
    desire_reconhecimento: {
      label: "Deseja reconhecimento",
      kind: "desire",
      headline: "Seja o *primeiro nome* que vem à cabeça quando falarem da sua área.",
      body: "Reconhecimento não vem de sorte. Vem de constância e de um posicionamento que ninguém esquece.",
    },
    desire_constancia: {
      label: "Deseja constância",
      kind: "desire",
      headline: "Constância sem depender de *motivação* — porque o plano já diz o que fazer.",
      body: "Você não precisa de mais disciplina. Precisa de uma linha editorial pronta que elimina a decisão de 'o que postar hoje'.",
    },
    desire_resultado_rapido: {
      label: "Deseja resultado rápido",
      kind: "desire",
      headline: "Resultado em *semanas*, não em anos.",
      body: "83% dos alunos publicaram o primeiro conteúdo posicionado em menos de 7 dias depois de começar a Digital Start.",
    },
    desire_orgulho: {
      label: "Deseja orgulho do perfil",
      kind: "desire",
      headline: "Um perfil do qual você tem *orgulho* de mandar o link.",
      body: "Quando o seu Instagram finalmente representa o tamanho do seu trabalho, tudo muda — inclusive como você se sente ao compartilhar ele.",
    },
  },
  leadFields: [
    {
      id: "name",
      label: "Primeiro nome",
      placeholder: "Como quer ser chamado(a)?",
      type: "text",
      required: true,
    },
    {
      id: "email",
      label: "Email",
      placeholder: "seu@email.com",
      type: "email",
      required: true,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      placeholder: "(11) 99999-9999",
      type: "tel",
      required: false,
    },
  ],
};

// ============================================================
// TELAS DO QUIZ — 45 telas do funil + 1 loading final
// Vilão: INVISIBILIDADE DIGITAL
// Mecanismo: POSICIONAR › APARECER › COMUNICAR › CRESCER
// ============================================================

export const screens: Screen[] = [

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 1 — ENGAJAMENTO GENÉRICO (Telas 1–5)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 1 — Entrada + demográfica com foto
  {
    id: "intro",
    type: "intro",
    headline:
      "Se você já construiu algo na vida real mas seu Instagram não mostra isso, esse teste é pra você",
    subheadline:
      "Responda 45 perguntas rápidas e receba no final o diagnóstico do que está travando a sua presença digital.",
    firstQuestion: "Para começar, quem está respondendo?",
    firstOptions: [
      { value: "homem",  label: "Homem",  image: homemImg  as unknown as string },
      { value: "mulher", label: "Mulher", image: mulherImg as unknown as string },
    ],
    badge: "Leva menos de 4 minutos",
  },

  // TELA 2 — Faixa etária
  {
    id: "idade",
    type: "single",
    question: "Qual a sua <hl>idade</hl>?",
    grid: 2,
    options: [
      { value: "20-29", label: "20 a 29 anos" }, // TODO: adicionar imagem
      { value: "30-39", label: "30 a 39 anos" }, // TODO: adicionar imagem
      { value: "40-49", label: "40 a 49 anos" }, // TODO: adicionar imagem
      { value: "50+",   label: "50 anos ou mais" }, // TODO: adicionar imagem
    ],
  },

  // TELA 3 — Segmentação de avatar
  {
    id: "momento",
    type: "single",
    question: "O que descreve melhor o seu <hl>momento</hl> hoje?",
    options: [
      { value: "empresario",  label: "🏪 Tenho um negócio ou empresa" },
      { value: "especialista",label: "🎓 Sou especialista ou profissional liberal" },
      { value: "mentor",      label: "🎤 Ensino ou quero ensinar o que sei" },
      { value: "carreira",    label: "💼 Tenho carreira e quero migrar pro digital" },
    ],
  },

  // TELA 4 — Qualificação leve (repertório)
  {
    id: "tempo_atuacao",
    type: "single",
    question: "Há quanto tempo você atua na sua área?",
    options: [
      { value: "ate2",  label: "🌱 Menos de 2 anos" },
      { value: "2a5",   label: "📈 De 2 a 5 anos" },
      { value: "5a10",  label: "🏆 De 5 a 10 anos" },
      { value: "10+",   label: "👑 Mais de 10 anos" },
    ],
  },

  // TELA 5 — Contexto simples (ponto de partida)
  {
    id: "frequencia_post",
    type: "single",
    question: "Com que frequência você posta no Instagram hoje?",
    options: [
      { value: "quase_nunca",   label: "😐 Quase nunca posto" },
      { value: "quando_da",     label: "🌦️ Posto quando dá vontade" },
      { value: "algumas_semana",label: "📅 Algumas vezes por semana" },
      { value: "quase_todo_dia",label: "🔁 Posto quase todo dia" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 2 — DOR (Telas 6–10)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 6 — Situação atual
  {
    id: "o_que_perfil_comunica",
    type: "single",
    question: "Quando alguém desconhecido entra no seu perfil hoje, o que essa pessoa entende sobre você?",
    options: [
      { value: "quase_nada",  label: "😶 Quase nada, meu perfil não diz nada", signals: ["pain_invisibilidade"] },
      { value: "mais_ou_menos",label: "🤷 Entende mais ou menos o que eu faço", signals: ["pain_invisibilidade"] },
      { value: "comecei_ontem",label: "🙃 Parece que eu comecei ontem", signals: ["pain_invisibilidade"] },
      { value: "fica_claro",  label: "😌 Fica claro quem eu sou" },
    ],
  },

  // TELA 7 — Frequência da dor
  {
    id: "frequencia_atraso",
    type: "single",
    question: "Com que frequência você sente que está atrasado no digital?",
    options: [
      { value: "todo_dia",     label: "😰 Todos os dias", signals: ["pain_tempo_perdido"] },
      { value: "varias_semana",label: "😞 Várias vezes por semana", signals: ["pain_tempo_perdido"] },
      { value: "as_vezes",     label: "😕 De vez em quando", signals: ["pain_tempo_perdido"] },
      { value: "quase_nunca",  label: "🙂 Quase nunca" },
    ],
  },

  // TELA 8 — Impacto no negócio
  {
    id: "perdeu_cliente",
    type: "single",
    question: "Você já perdeu um cliente ou uma oportunidade para alguém que aparece mais que você?",
    options: [
      { value: "sim_varias",  label: "😤 Sim, e mais de uma vez", signals: ["pain_financeiro"] },
      { value: "sim_uma",     label: "😔 Sim, uma vez", signals: ["pain_financeiro"] },
      { value: "acho_que_sim",label: "🤔 Acho que sim", signals: ["pain_financeiro"] },
      { value: "nao",         label: "🙂 Que eu saiba, não" },
    ],
  },

  // TELA 9 — Prova social (77%)
  {
    id: "prova_77",
    type: "social-proof",
    title: "Você não está sozinho nisso",
    stat: "77%",
    source: "pesquisam o Instagram de um profissional antes de fechar negócio",
    body: "Antes de te contratarem, te julgam pelo seu perfil.\n\nSe o seu perfil não mostra o tamanho do que você construiu, a decisão já foi tomada antes de você abrir a boca.",
    whatsapp: {
      author: "+55 (11) 9****4821",
      text: "cara eu fiquei 8 anos com a clínica cheia só no boca a boca. aí um cara que abriu ano passado começou a postar e hoje todo mundo fala dele. eu tenho MUITO mais experiência que ele. só que ninguém sabe. dói",
      meta: "14/03",
    },
  },

  // TELA 10 — Padrão repetido
  {
    id: "ciclo_parou",
    type: "single",
    question: "Quantas vezes você já decidiu que ia começar a postar de verdade e parou?",
    options: [
      { value: "perdi_a_conta",label: "😵 Já perdi a conta", signals: ["pain_recomeco"] },
      { value: "3ou4",         label: "😩 Umas 3 ou 4 vezes", signals: ["pain_recomeco"] },
      { value: "1ou2",         label: "😐 Uma ou duas vezes", signals: ["pain_recomeco"] },
      { value: "nunca_comecei",label: "🚀 Nunca cheguei nem a começar", signals: ["pain_posicionamento"] },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 3 — DESEJO (Telas 11–14)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 11 — Visualização do futuro
  {
    id: "o_que_mudaria",
    type: "single",
    question: "Se o seu Instagram mostrasse exatamente quem você é e o que você sabe, o que mudaria primeiro?",
    options: [
      { value: "clientes",   label: "💰 Clientes chegariam até mim", signals: ["desire_clientes"] },
      { value: "referencia", label: "👑 Eu seria visto como referência", signals: ["desire_autoridade"] },
      { value: "convites",   label: "🤝 Apareceriam convites e parcerias", signals: ["desire_autoridade"] },
      { value: "orgulho",    label: "😌 Eu teria orgulho do meu perfil", signals: ["desire_orgulho"] },
    ],
  },

  // TELA 12 — Dimensionamento do desejo
  {
    id: "clientes_a_mais",
    type: "single",
    question: "Quantos clientes ou oportunidades a mais por mês já mudariam o seu jogo?",
    options: [
      { value: "2a5",   label: "🌱 De 2 a 5 por mês", signals: ["desire_clientes"] },
      { value: "5a10",  label: "📈 De 5 a 10 por mês", signals: ["desire_clientes"] },
      { value: "10a20", label: "🔥 De 10 a 20 por mês", signals: ["desire_clientes"] },
      { value: "20+",   label: "🚀 Mais de 20 por mês", signals: ["desire_clientes"] },
    ],
  },

  // TELA 13 — Identidade desejada
  {
    id: "como_lembrado",
    type: "single",
    question: "Como você quer ser lembrado quando alguém falar da sua área?",
    options: [
      { value: "melhor",       label: "🥇 Como o melhor no que faz", signals: ["desire_autoridade"] },
      { value: "explica_melhor",label: "🧠 Como quem explica melhor que todos", signals: ["desire_autoridade"] },
      { value: "confiavel",    label: "🫶 Como alguém em quem se confia", signals: ["desire_reconhecimento"] },
      { value: "primeiro_nome",label: "🌟 Como o nome que vem na cabeça primeiro", signals: ["desire_reconhecimento"] },
    ],
  },

  // TELA 14 — Preferência de caminho
  {
    id: "preferencia_caminho",
    type: "single",
    question: "Se existisse um caminho pronto pra isso, como você preferiria seguir?",
    options: [
      { value: "passo_a_passo",label: "🪜 Um passo a passo curto e direto", signals: ["desire_resultado_rapido"] },
      { value: "o_que_postar", label: "🎯 Alguém me dizendo o que postar", signals: ["pain_posicionamento"] },
      { value: "gravar",       label: "🎥 Uma estrutura pra gravar sem travar", signals: ["pain_camera"] },
      { value: "tudo_junto",   label: "📚 Tudo isso junto", signals: ["desire_resultado_rapido"] },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 4 — INSTALAÇÃO DO CONCEITO E O VILÃO (Telas 15–18)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 15 — Enquadramento do vilão
  {
    id: "problema_tem_nome",
    type: "content",
    title: "O seu problema tem nome",
    highlight: "Invisibilidade digital não é falta de conhecimento. É falta de comunicação do que você já sabe.",
    body: "Existe uma diferença que quase ninguém percebe:\n\nTER autoridade é uma coisa. SER PERCEBIDO como autoridade é outra, completamente diferente.\n\nVocê pode ter 10 anos de experiência, centenas de clientes atendidos e dominar o que faz. Mas se isso não aparece na internet, para uma boa parte do mercado você simplesmente não existe.\n\nIsso tem nome: INVISIBILIDADE DIGITAL.\n\nE aqui está o ponto que muda tudo: você não precisa aprender mais. Você precisa aprender a mostrar. E isso começa em um lugar específico, o seu posicionamento.",
  },

  // TELA 16 — Área mais afetada
  {
    id: "area_afetada",
    type: "single",
    question: "Qual área da sua vida a invisibilidade digital já prejudicou mais?",
    options: [
      { value: "faturamento",  label: "💸 Meu faturamento", signals: ["pain_financeiro"] },
      { value: "reconhecimento",label: "🏅 Meu reconhecimento profissional", signals: ["pain_invisibilidade"] },
      { value: "oportunidades",label: "🚪 As oportunidades que não chegaram", signals: ["pain_financeiro"] },
      { value: "confianca",    label: "😞 Minha confiança em me expor", signals: ["pain_camera"] },
    ],
  },

  // TELA 17 — Intensidade do estrago
  {
    id: "intensidade_estrago",
    type: "single",
    question: "O quanto isso já atrapalhou o seu crescimento até hoje?",
    options: [
      { value: "muito",    label: "🔴 Atrapalhou muito, me travou anos", signals: ["pain_invisibilidade"] },
      { value: "bastante", label: "🟠 Atrapalhou bastante", signals: ["pain_invisibilidade"] },
      { value: "um_pouco", label: "🟡 Atrapalhou um pouco" },
      { value: "quase_nada",label: "🟢 Quase não atrapalhou" },
    ],
  },

  // TELA 18 — Pergunta de vulnerabilidade
  {
    id: "sentimento_comparacao",
    type: "single",
    question: "O que você sente quando vê alguém com menos experiência que você bombando na internet?",
    options: [
      { value: "raiva_de_mim",label: "😖 Uma raiva de mim mesmo", signals: ["pain_comparacao"] },
      { value: "perdi_timing",label: "😔 Que eu perdi o timing", signals: ["pain_tempo_perdido"] },
      { value: "nao_sirvo",   label: "😐 Sinto que eu não sirvo pra isso", signals: ["pain_autossabotagem"] },
      { value: "vontade_reagir",label: "🔥 Sinto vontade de reagir", signals: ["desire_autoridade"] },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 5 — MAPEAMENTO DE CRENÇAS (Telas 19–23)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 19 — Autoavaliação
  {
    id: "autoavaliacao",
    type: "single",
    question: "Quando o assunto é se posicionar na internet, você se considera:",
    options: [
      { value: "perdido",     label: "😵 Totalmente perdido, não faço ideia", signals: ["pain_posicionamento"] },
      { value: "basico",      label: "😕 Sei o básico, mas não sei aplicar", signals: ["pain_posicionamento"] },
      { value: "nao_executo", label: "🙂 Entendo, mas não consigo executar", signals: ["pain_posicionamento"] },
      { value: "ja_sei",      label: "😎 Já sei bastante coisa" },
    ],
  },

  // TELA 20 — Perda percebida
  {
    id: "o_que_rouba",
    type: "single",
    question: "O que a falta de presença digital mais rouba de você hoje?",
    options: [
      { value: "dinheiro", label: "💰 Dinheiro que eu deveria estar ganhando", signals: ["pain_financeiro"] },
      { value: "tempo",    label: "⏳ Tempo, porque eu já devia ter começado", signals: ["pain_tempo_perdido"] },
      { value: "lugar",    label: "🙇 A sensação de estar no meu lugar", signals: ["pain_invisibilidade"] },
      { value: "tamanho",  label: "🎯 O tamanho que o meu trabalho merece", signals: ["desire_reconhecimento"] },
    ],
  },

  // TELA 21 — Revelação do produto
  {
    id: "revelacao_digital_start",
    type: "content",
    title: "Pelas suas respostas, já dá pra ver uma coisa",
    body: "Você não tem um problema de conteúdo. Você tem um problema de tradução.\n\nTudo o que você já construiu está aí. Só não foi traduzido para o digital ainda.\n\nFoi exatamente pra isso que Renan e Fran criaram o DIGITAL START: um primeiro sistema pra pegar a autoridade que você já tem na vida real e colocar ela no Instagram.\n\nContinue respondendo. No final você recebe o seu diagnóstico completo.",
    quote: {
      author: "Membro do DIGITAL START",
      text: "eu achava que ia ser mais um curso de instagram sabe. mas não é. eu entendi na primeira aula por que meu perfil não funcionava: eu tava falando de tudo e de nada ao mesmo tempo",
    },
  },

  // TELA 22 — Escala: "não tenho nada novo pra falar"
  {
    id: "escala_nada_novo",
    type: "scale",
    question: "Avalie o quanto você concorda com a frase:",
    statement: "Eu não tenho nada de novo pra falar. Já falaram tudo sobre a minha área.",
  },

  // TELA 23 — Escala: "preciso perder a vergonha antes de gravar"
  {
    id: "escala_vergonha_camera",
    type: "scale",
    question: "Avalie o quanto você concorda com a frase:",
    statement: "Eu preciso perder a vergonha antes de começar a gravar.",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 6 — DIFERENCIAÇÃO E ÂNGULO ÚNICO (Telas 24–27)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 24 — Pergunta do não dito
  {
    id: "sabe_mais_do_que_publica",
    type: "single",
    question: "Seja sincero: você sabe muito mais do que aquilo que você publica?",
    options: [
      { value: "absurdamente_mais",label: "😅 Sei absurdamente mais do que publico", signals: ["pain_invisibilidade"] },
      { value: "bastante_mais",    label: "🤐 Sei bastante mais", signals: ["pain_invisibilidade"] },
      { value: "mais_ou_menos",    label: "😐 Mais ou menos igual" },
      { value: "nunca_pensei",     label: "🤔 Nunca tinha pensado nisso" },
    ],
  },

  // TELA 25 — Programa instalado
  {
    id: "frase_na_cabeca",
    type: "single",
    question: "Qual dessas frases mais passa na sua cabeça na hora de postar?",
    options: [
      { value: "me_achando",  label: "🙈 \"Vão achar que eu tô me achando\"", signals: ["pain_julgamento"] },
      { value: "falar_besteira",label: "😬 \"E se eu falar besteira?\"", signals: ["pain_camera"] },
      { value: "ninguem_quer",label: "🥱 \"Ninguém quer ver isso\"", signals: ["pain_invisibilidade"] },
      { value: "nao_quero_influencer",label: "🚫 \"Eu não quero virar influencer\"", signals: ["pain_julgamento"] },
    ],
  },

  // TELA 26 — Diagnóstico parcial + autoridade
  {
    id: "frase_instalada",
    type: "content",
    title: "Essa frase não é sua. Ela foi instalada.",
    body: "Quase todo profissional bom carrega alguma versão dessa frase na cabeça.\n\nEla vem da cultura de que quem é bom mesmo não precisa se mostrar. Só que essa regra valia num tempo em que as pessoas te encontravam pelo boca a boca.\n\nHoje elas te procuram no Instagram antes de decidir qualquer coisa.\n\nRenan e Fran trabalham dentro do ecossistema de Pablo Marçal e passaram os últimos anos fazendo exatamente uma coisa: pegar gente que já era boa no mundo real e colocar essa autoridade no digital.\n\nEmpresários com loja cheia e perfil vazio. Médicos com agenda lotada e Instagram parado. Consultores com resultado e nenhuma audiência. O padrão sempre foi o mesmo. E a solução também.",
  },

  // TELA 27 — Custo concreto
  {
    id: "gravou_e_apagou",
    type: "single",
    question: "Você já gravou um vídeo, assistiu, não gostou e apagou antes de postar?",
    options: [
      { value: "sim_varias",  label: "😩 Sim, várias vezes", signals: ["pain_camera"] },
      { value: "sim_ja",      label: "😕 Sim, já aconteceu", signals: ["pain_camera"] },
      { value: "nem_gravei",  label: "🎬 Nem cheguei a gravar ainda", signals: ["pain_camera"] },
      { value: "posto_mesmo", label: "🙂 Não, eu posto mesmo assim" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 7 — ORIGEM DO PROBLEMA E ESPERANÇA (Telas 28–31)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 28 — Julgamento social
  {
    id: "quem_teme_julgamento",
    type: "single",
    question: "Quem você mais teme que julgue os seus posts?",
    options: [
      { value: "familia",  label: "👨‍👩‍👧 Minha família", signals: ["pain_julgamento"] },
      { value: "amigos",   label: "🧑‍🤝‍🧑 Meus amigos próximos", signals: ["pain_julgamento"] },
      { value: "colegas",  label: "🏢 Colegas e concorrentes da área", signals: ["pain_julgamento"] },
      { value: "todo_mundo",label: "😶 Todo mundo, sinceramente", signals: ["pain_julgamento"] },
    ],
  },

  // TELA 29 — Autossabotagem
  {
    id: "autossabotagem",
    type: "single",
    question: "Você acha que se autossabota quando o assunto é aparecer?",
    options: [
      { value: "claramente",  label: "😣 Sim, claramente", signals: ["pain_autossabotagem"] },
      { value: "um_pouco",    label: "😕 Acho que um pouco", signals: ["pain_autossabotagem"] },
      { value: "nunca_pensei",label: "🤔 Nunca parei pra pensar" },
      { value: "outro",       label: "🙅 Não, o problema é outro" },
    ],
  },

  // TELA 30 — Crença própria (3 opções, com pessimista)
  {
    id: "acredita_que_consegue",
    type: "single",
    question: "Você acredita que VOCÊ consegue construir uma presença digital forte?",
    options: [
      { value: "com_certeza",  label: "🔥 Sim, com certeza", signals: ["desire_resultado_rapido"] },
      { value: "tenho_duvidas",label: "🙂 Talvez, mas tenho dúvidas", signals: ["pain_autossabotagem"] },
      { value: "nao_e_pra_mim",label: "😔 Não acredito que isso é pra mim", signals: ["pain_autossabotagem"] },
    ],
  },

  // TELA 31 — Padrão cíclico
  {
    id: "quando_posta_constancia",
    type: "single",
    question: "O que costuma acontecer quando você começa a postar com constância?",
    options: [
      { value: "some_vontade",label: "🔄 Engreno, aí some a vontade e eu paro", signals: ["pain_recomeco"] },
      { value: "sem_resultado",label: "📉 Não vem resultado e eu desanimo", signals: ["pain_recomeco"] },
      { value: "correria",    label: "⏰ A correria do trabalho me engole", signals: ["desire_constancia"] },
      { value: "sem_ideias",  label: "💡 Acabam as ideias do que postar", signals: ["pain_posicionamento"] },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 8 — A VIRADA: DIAGNÓSTICO PARA OFERTA (Telas 32–37)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 32 — Pergunta ponte
  {
    id: "tempo_para_representar",
    type: "single",
    question: "Se você tivesse um passo a passo pronto de posicionamento, conteúdo e câmera, em quanto tempo o seu perfil estaria representando quem você é?",
    options: [
      { value: "30dias",  label: "🔥 Em menos de 30 dias", signals: ["desire_resultado_rapido"] },
      { value: "3meses",  label: "📈 Em uns 3 meses", signals: ["desire_resultado_rapido"] },
      { value: "6meses",  label: "🕐 Em uns 6 meses" },
      { value: "1ano",    label: "🙁 Mais de um ano", signals: ["pain_tempo_perdido"] },
    ],
  },

  // TELA 33 — Pergunta de impedimento (define o perfil de diagnóstico)
  {
    id: "maior_impedimento",
    type: "single",
    question: "Qual é o seu MAIOR impedimento hoje?",
    options: [
      { value: "posicionamento",label: "🧭 Não sei como me posicionar", signals: ["pain_posicionamento"] },
      { value: "camera",        label: "🎥 Eu travo na hora de gravar", signals: ["pain_camera"] },
      { value: "o_que_postar",  label: "📝 Não sei o que postar", signals: ["pain_posicionamento"] },
      { value: "ninguem_ve",    label: "📉 Eu posto e ninguém vê", signals: ["pain_invisibilidade"] },
    ],
  },

  // TELA 34 — Disponibilidade (quebra "não tenho tempo")
  {
    id: "tempo_por_dia",
    type: "single",
    question: "Quanto tempo por dia você conseguiria dedicar pra isso?",
    options: [
      { value: "15min",  label: "⏱️ Uns 15 minutos" },
      { value: "30min",  label: "🕐 Uns 30 minutos" },
      { value: "1h",     label: "🕒 Cerca de 1 hora" },
      { value: "1h+",    label: "🚀 Mais de 1 hora" },
    ],
  },

  // TELA 35 — Loading falso antes do diagnóstico
  {
    id: "calculando",
    type: "content",
    title: "Calculando o seu nível de visibilidade digital...",
    highlight: "Não feche esta página. O seu diagnóstico está quase pronto.",
    body: "▰▰▰▰▰▰▰▰▰▰▱▱▱▱  cruzando as suas 34 respostas\n▰▰▰▰▰▰▰▰▰▰▰▰▱▱  identificando os seus bloqueios principais\n▰▰▰▰▰▰▰▰▰▰▰▰▰▰  montando o seu plano personalizado",
  },

  // TELA 36 — Diagnóstico visual (PICO EMOCIONAL)
  {
    id: "diagnostico",
    type: "diagnosis",
    title: "Seu nível de visibilidade digital: BAIXO",
    subtitle: "Com base nas suas respostas, identificamos 4 bloqueios que estão mantendo você invisível no digital mesmo tendo autoridade real.",
    barLabel: "RÉGUA DE VISIBILIDADE DIGITAL",
    levels: ["BAIXO", "MÉDIO", "ALTO", "MUITO ALTO"],
    levelColors: ["bg-destructive", "bg-orange-500", "bg-amber-400", "bg-emerald-500"],
    label: "Você",
    targetPct: 15,
    highlightCard: {
      color: "danger",
      title: "🔴 NÍVEL BAIXO · 4 bloqueios identificados",
      body: "Esses 4 bloqueios têm uma coisa em comum: nenhum deles se resolve postando mais. Todos vêm da forma como você traduz (ou não traduz) a sua autoridade para o digital.",
    },
    cards: [
      { label: "🔴 Crença central",           name: "Repertório Silenciado",   desc: "Você acha que o que sabe já é óbvio. É óbvio só pra você." },
      { label: "🔴 Sintoma emocional",        name: "Comparação Paralisante",  desc: "Ver gente menos preparada crescendo te congela, não te move." },
      { label: "🔴 Conflito interno",         name: "Autoridade x Exposição",  desc: "Quer reconhecimento sem parecer que está se promovendo." },
      { label: "🔴 Padrão de comportamento",  name: "Ciclo do Recomeço",       desc: "Começa, posta uns dias, não vê retorno e para. Já se repetiu." },
    ],
  },

  // TELA 37 — Compromisso #1
  {
    id: "compromisso_motivacao",
    type: "single",
    question: "Agora que você viu o que está te travando, quão motivado você está pra resolver isso?",
    options: [
      { value: "curioso",       label: "🤔 Só estou curioso" },
      { value: "nao_sei_consigo",label: "😔 Ainda não sei se eu consigo", signals: ["pain_autossabotagem"] },
      { value: "disposto",      label: "💪 Estou disposto a tentar", signals: ["desire_resultado_rapido"] },
      { value: "nao_vou_parar", label: "🔥 Não vou parar até conseguir", signals: ["desire_resultado_rapido"] },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 9 — DESEJO MÁXIMO E PRÉ PITCH (Telas 38–44)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 38 — Comparativo antes e depois
  {
    id: "comparativo",
    type: "compare",
    title: "O que muda quando o bloqueio sai do caminho",
    beforeLabel: "Hoje 🔴",
    afterLabel: "Depois 🟢",
    rows: [
      { label: "Clareza de posicionamento",      beforePct: 18, afterPct: 91 },
      { label: "Perfil que transmite autoridade",beforePct: 22, afterPct: 88 },
      { label: "Facilidade pra criar conteúdo",  beforePct: 15, afterPct: 84 },
      { label: "Segurança diante da câmera",     beforePct: 12, afterPct: 79 },
      { label: "Constância nas postagens",       beforePct: 9,  afterPct: 86 },
      { label: "Alcance dos vídeos",             beforePct: 21, afterPct: 74 },
    ],
    summaryBefore: { value: "16", desc: "média dos seus indicadores de presença digital hoje" },
    summaryAfter:  { value: "83", desc: "publicaram o primeiro conteúdo posicionado em menos de 7 dias" },
    durationMs: 1800,
  },

  // TELA 39 — Prova social concreta
  {
    id: "depoimentos",
    type: "testimonials",
    title: "Quem já saiu da invisibilidade",
    items: [
      {
        name: "Empresário, 12 anos de casa",
        text: "em 40 dias saí de 380 seguidores pra 4.100. mas o que importa mesmo é que fechei 11 orçamentos vindo do direct. em 12 anos de empresa isso nunca tinha acontecido",
      },
      {
        name: "Profissional que travava na câmera",
        text: "eu travava MUITO na câmera. gravava 20 vezes e apagava tudo. hoje eu gravo 3 reels de uma vez em 20 min. a estrutura de não travar mudou o jogo pra mim",
      },
      {
        name: "Perfil recém arrumado",
        text: "minha bio tava um lixo e eu nem sabia. arrumei perfil, bio e destaques num sábado à tarde. na segunda já chegou gente perguntando preço",
      },
    ],
  },

  // TELA 40 — Quebra de objeção
  {
    id: "objecao_ja_postei",
    type: "content",
    title: "\"Eu já postei e não deu em nada\"",
    highlight: "Era muito esforço para pouco progresso. O problema nunca foi você. Foi a ordem.",
    body: "Essa é a frase que quase todo mundo fala antes de entender o que estava acontecendo.\n\nPOSTAR ALEATORIAMENTE: muito esforço, pouca clareza, nenhuma direção, resultado quase zero.\n\nPOSICIONAMENTO + LINHA EDITORIAL + ESTRUTURA + FORMATOS: menos esforço, direção clara, resultado composto.\n\nQuem posta sem posicionamento produz em média 4x mais conteúdo para conseguir o mesmo alcance de quem posta com posicionamento definido.\n\nNinguém te ensinou que existe uma sequência: POSICIONAR, APARECER, COMUNICAR, CRESCER. Quem pula a primeira etapa fica preso pra sempre na última.",
  },

  // TELA 41 — Reconhecimento
  {
    id: "diagnostico_bateu",
    type: "single",
    question: "O quanto o diagnóstico que você recebeu descreve a sua realidade?",
    options: [
      { value: "em_cheio",   label: "🎯 Acertou em cheio, é exatamente isso" },
      { value: "maior_parte",label: "👍 Acertou na maior parte" },
      { value: "em_parte",   label: "🤏 Acertou em parte" },
      { value: "nao_muito",  label: "🤨 Não me identifiquei muito" },
    ],
  },

  // TELA 42 — Transformações múltiplas + autoridade
  {
    id: "nao_e_so_instagram",
    type: "content",
    title: "Não é só sobre Instagram",
    body: "Renan e Fran já colocaram no digital a autoridade de empresários, médicos, advogados, arquitetos, consultores e donos de negócio local que passaram a vida inteira sendo excelentes sem que ninguém soubesse.\n\nQuando você para de ser invisível, muda mais do que o número de seguidores.",
    quote: {
      author: "Aluno DIGITAL START",
      text: "aconteceu tudo junto. o perfil cresceu, mas o melhor foi que comecei a ser chamado pra palestrar. depois me chamaram pra ser sócio de um projeto. e o que mudou mesmo foi eu parar de sentir vergonha de falar do que eu faço. isso não tem preço",
    },
    // TODO: adicionar imagem de Renan e Fran no palco de um evento
    // image: expertImg,
  },

  // TELA 43 — Compromisso final (3 opções)
  {
    id: "compromisso_final",
    type: "single",
    question: "Você acredita que conseguiria colocar sua autoridade no digital se tivesse esse plano na mão?",
    options: [
      { value: "pronto",     label: "✅ Sim, estou pronto pra isso", signals: ["desire_resultado_rapido"] },
      { value: "so_direcao", label: "🙂 Com certeza, só preciso de direção", signals: ["pain_posicionamento"] },
      { value: "quero_tentar",label: "🙁 Acho que sim, quero tentar", signals: ["pain_autossabotagem"] },
    ],
  },

  // TELA 44 — Loading final / entrega percebida
  {
    id: "montando_plano",
    type: "content",
    title: "Montando o seu plano personalizado...",
    highlight: "Seu plano está pronto. Falta só dizer onde você quer receber.",
    body: "▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱  94%\n\nDefinindo o seu posicionamento de partida\nSelecionando os formatos ideais pro seu perfil\nAjustando a ordem dos passos ao seu tempo disponível",
    // TODO: adicionar imagem de Renan e Fran em palco de evento
    // image: expertImg,
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FASE 10 — GATE DE CAPTURA (Tela 45)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // TELA 45 — Lead (PENÚLTIMA — não mover)
  {
    id: "lead",
    type: "lead",
    title: "Última etapa antes de receber o seu plano personalizado de presença digital",
    subtitle:
      "Seu diagnóstico apontou o seu perfil e o plano foi montado com base nas suas 44 respostas. Informe seu nome e o WhatsApp onde você vai receber o plano.",
    ctaText: "RECEBER MEU PLANO PERSONALIZADO →",
    privacyText: "🔒 Seus dados estão seguros. Caso não seja do Brasil, não preencha o WhatsApp.",
    // TODO: adicionar imagem de Renan e Fran abaixo do formulário
    // expertImage: expertImg,
  },

  // TELA 46 — Loading final (ÚLTIMA — não mover, redireciona para /oferta)
  {
    id: "loading_final",
    type: "loading",
    title: "Com base nas suas respostas, preparamos o seu plano personalizado de presença digital.",
    lines: [
      "Analisando o perfil que você construiu...",
      "Cruzando com os resultados dos alunos...",
      "Definindo o seu posicionamento de partida...",
      "Selecionando os formatos ideais pro seu perfil...",
      "Montando o seu plano personalizado...",
    ],
    durationMs: 4000,
  },
];
