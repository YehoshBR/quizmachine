// Logo de partículas da página premium: amostra a imagem do logo e anima num canvas.
// Versão enxuta do motor do lobo da página da Matilha (matilha.joemello.pro): só a forma do logo,
// com os trilhos e a onda de choque do Gateway Flow (21st.dev, @mengto), mouse que afasta e olhos que acendem.

type Ponto = [number, number, number];
type Particula = { x: number; y: number; vx: number; vy: number; br: number; olho: boolean; cor: number; t0: number };

export type OpcoesParticulas = {
  /** pixels da imagem (largura x altura) */
  largura: number;
  altura: number;
  /** coordenadas dos olhos na imagem, em pixels; acendem e seguem o mouse */
  olhos?: [number, number][];
  /** cores do mais escuro ao mais claro */
  cores?: string[];
};

const CORES = ["#8C6835", "#B48A45", "#D6B36A", "#E8C784", "#F1D79A", "#FFF1C9"];
const suaviza = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

function amostrar(img: HTMLImageElement, o: OpcoesParticulas, N: number, T: number): Ponto[] {
  const c = document.createElement("canvas");
  c.width = c.height = T;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const esc = 0.95 / Math.max(o.largura, o.altura);
  g.save();
  g.beginPath();
  g.ellipse(T / 2, T * 0.53, T * 0.44, T * 0.5, 0, 0, Math.PI * 2);
  g.clip();
  g.drawImage(img, (T - o.largura * esc * T) / 2, T * 0.025, o.largura * esc * T, o.altura * esc * T);
  g.restore();
  const d = g.getImageData(0, 0, T, T).data;
  const pontos: Ponto[] = [];
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const i = (y * T + x) * 4, l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (l > 40) pontos.push([x / T - 0.5, y / T - 0.5, l / 255]);
    }
  const out: Ponto[] = [];
  for (let k = 0; k < N && pontos.length; k++) {
    let p = pontos[(Math.random() * pontos.length) | 0];
    let tent = 0;
    while (Math.random() > p[2] * 1.1 && tent++ < 6) p = pontos[(Math.random() * pontos.length) | 0];
    out.push([p[0] + (Math.random() - 0.5) / T, p[1] + (Math.random() - 0.5) / T, p[2]]);
  }
  return out;
}

export class LogoDeParticulas {
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private S = 1;
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private celular = window.innerWidth < 760;
  private N = this.celular ? 1600 : 3600;
  private alvo: Ponto[] = [];
  private ps: Particula[] = [];
  private mouse = { x: -9999, y: -9999, ativo: false };
  private ondas: { x: number; y: number; raio: number; vida: number }[] = [];
  private olho = { x: 0, y: 0 };
  private trilhos: { esq: boolean; y0: number; pt: number; v: number }[] = [];
  private inicio = performance.now();
  private raf = 0;
  private visivel = true;
  private observador: IntersectionObserver;
  private cores: string[];

  constructor(private palco: HTMLElement, private cv: HTMLCanvasElement, img: HTMLImageElement, o: OpcoesParticulas) {
    this.ctx = cv.getContext("2d")!;
    this.cores = o.cores ?? CORES;
    this.medir();
    window.addEventListener("resize", this.medir);
    this.alvo = amostrar(img, o, this.N, this.celular ? 240 : 320);

    const esc = 0.95 / Math.max(o.largura, o.altura);
    const paraForma = (px: number, py: number) => [(px - o.largura / 2) * esc, 0.025 + py * esc - 0.5];
    const olhos = (o.olhos ?? []).map(([x, y]) => paraForma(x, y));
    for (const a of this.alvo) {
      this.ps.push({
        x: Math.random() < 0.5 ? -20 : this.W + 20, y: Math.random() * this.H, vx: 0, vy: 0, br: a[2],
        olho: olhos.some((e) => Math.hypot(a[0] - e[0], a[1] - e[1]) < 0.024),
        cor: Math.random(), t0: Math.random() * Math.PI * 2,
      });
    }
    const NT = this.celular ? 22 : 44;
    for (let t = 0; t < NT; t++) this.trilhos.push({ esq: t % 2 === 0, y0: (t / NT) * 1.4 - 0.2, pt: Math.random(), v: 0.0015 + Math.random() * 0.002 });

    this.observador = new IntersectionObserver((es) => { this.visivel = es[0].isIntersecting; });
    this.observador.observe(palco);
    this.raf = requestAnimationFrame(this.quadro);
  }

  private medir = () => {
    const r = this.palco.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.S = Math.min(this.W * (this.celular ? 0.78 : 0.42), this.H * 0.62);
  };

  moverMouse(x: number, y: number) { this.mouse = { x, y, ativo: true }; }
  soltarMouse() { this.mouse = { x: -9999, y: -9999, ativo: false }; }

  /** onda de choque no ponto do clique */
  explodir(x: number, y: number) {
    this.ondas.push({ x, y, raio: 0, vida: 1 });
    for (const p of this.ps) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < 260) { const f = ((260 - d) / 260) * 26; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
    }
  }

  private quadro = (agora: number) => {
    this.raf = requestAnimationFrame(this.quadro);
    if (!this.visivel) return;
    const { ctx, W, H, S, ps, mouse, cores } = this;
    const tempo = (agora - this.inicio) / 1000, cx = W / 2, cy = H * 0.46;
    ctx.clearRect(0, 0, W, H);

    // trilhos convergindo pro logo
    ctx.lineWidth = 1; ctx.setLineDash([1, 5]); ctx.strokeStyle = "rgba(214,179,106,.12)";
    for (const c of this.trilhos) {
      const y0 = c.y0 * H;
      const p0 = [c.esq ? 0 : W, y0], p1 = [c.esq ? cx * 0.5 : W - cx * 0.5, y0], p2 = [c.esq ? cx * 0.8 : W - cx * 0.8, cy];
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], cx, cy); ctx.stroke();
      c.pt += c.v; if (c.pt > 1) c.pt = 0;
      const t = c.pt, u = 1 - t;
      const qx = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * cx;
      const qy = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * cy;
      ctx.fillStyle = "rgba(241,215,154,.65)"; ctx.fillRect(qx - 1.5, qy - 1.5, 3, 3);
    }
    ctx.setLineDash([]);
    for (const o of this.ondas) {
      o.raio += 14; o.vida -= 0.02;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.raio, 0, Math.PI * 2); ctx.strokeStyle = `rgba(241,215,154,${o.vida * 0.55})`; ctx.lineWidth = 2; ctx.stroke();
    }
    this.ondas = this.ondas.filter((o) => o.vida > 0);

    const ox = mouse.ativo ? ((mouse.x - cx) / W) * 16 : Math.sin(tempo * 0.7) * 3;
    const oy = mouse.ativo ? ((mouse.y - cy) / H) * 12 : 0;
    this.olho.x += (ox - this.olho.x) * 0.08; this.olho.y += (oy - this.olho.y) * 0.08;
    const respira = 1 + Math.sin(tempo * 1.4) * 0.012, montagem = suaviza(tempo / 2.8);
    const k = montagem < 1 ? 0.004 + montagem * 0.05 : 0.055, R = this.celular ? 70 : 110;
    const baldes: number[][] = [[], [], [], [], [], []], brilhos: number[] = [];

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], a = this.alvo[i];
      let alvoX = cx + a[0] * S * respira, alvoY = cy + a[1] * S * respira;
      if (p.olho) { alvoX += this.olho.x; alvoY += this.olho.y; }
      alvoX += Math.sin(tempo * 2 + p.t0 * 3) * 1.1; alvoY += Math.cos(tempo * 1.7 + p.t0 * 2) * 1.1;
      p.vx += (alvoX - p.x) * k; p.vy += (alvoY - p.y) * k;
      if (mouse.ativo) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = ((R - d) / R) * 3.4; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      }
      p.vx *= 0.85; p.vy *= 0.85; p.x += p.vx; p.y += p.vy;
      const c = Math.min(5, Math.floor(p.br * 4.2 + (Math.abs(p.vx) + Math.abs(p.vy)) * 0.25 + p.cor * 0.8));
      baldes[c].push(p.x, p.y);
      if (p.olho) brilhos.push(p.x, p.y);
    }
    for (let ci = 0; ci < 6; ci++) {
      const arr = baldes[ci], s = ci > 3 ? 1.9 : 1.5;
      ctx.fillStyle = cores[ci] ?? cores[cores.length - 1];
      for (let j = 0; j < arr.length; j += 2) ctx.fillRect(arr[j], arr[j + 1], s, s);
    }
    const pisca = Math.min(1, 0.55 + 0.45 * Math.max(0, Math.sin(tempo * 1.3)) + (Math.sin(tempo * 0.45) > 0.97 ? 1 : 0));
    ctx.fillStyle = `rgba(255,246,220,${pisca})`;
    for (let e = 0; e < brilhos.length; e += 2) ctx.fillRect(brilhos[e] - 1.4, brilhos[e + 1] - 1.4, 2.8, 2.8);
  };

  destruir() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.medir);
    this.observador.disconnect();
  }
}
