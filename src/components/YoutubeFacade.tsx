import { useState } from "react";

interface YoutubeFacadeProps {
  videoId: string;
  label?: string;
  /** Proporção do vídeo. "vertical" (padrão) para depoimento gravado no celular, "wide" para 16:9. */
  aspect?: "vertical" | "wide";
  className?: string;
}

/**
 * Vídeo em formato "capa clicável": mostra a thumbnail do YouTube e só carrega
 * o player (com autoplay) depois do clique. Nunca reproduz sozinho — evita
 * consumo de dados e distração antes do usuário decidir assistir.
 */
export function YoutubeFacade({ videoId, label, aspect = "vertical", className = "" }: YoutubeFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const ratio = aspect === "vertical" ? "aspect-[9/16] max-w-[280px]" : "aspect-video w-full";

  return (
    <div className={`mx-auto overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${ratio} ${className}`}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={label ?? "Vídeo"}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={label ?? "Assistir vídeo"}
          className="group relative block h-full w-full cursor-pointer"
        >
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt={label ?? "Prévia do vídeo"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
          <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary shadow-lg transition-transform group-hover:scale-110">
            <span className="ml-1 inline-block h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-primary-foreground" />
          </span>
        </button>
      )}
    </div>
  );
}
