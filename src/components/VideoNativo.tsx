// Vídeo próprio (mp4) dentro da tela, feito pro celular: começa tocando sem som
// (o navegador só deixa assim), com um aviso grande de "toque para ouvir". No toque,
// volta pro início com som e mostra os controles. Altura limitada pra o botão
// "Continuar" aparecer sem rolar a tela.
import { useRef, useState } from "react";

type Props = { src: string; poster?: string; className?: string };

export function VideoNativo({ src, poster, className = "" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [comSom, setComSom] = useState(false);

  const ativarSom = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.loop = false;
    void v.play();
    setComSom(true);
  };

  return (
    <div className={`relative mx-auto w-full overflow-hidden rounded-xl bg-black shadow-sm ${className}`}
         style={{ aspectRatio: "9 / 16", maxHeight: "62svh", maxWidth: "calc(62svh * 9 / 16)" }}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        className="h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={comSom}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
      />
      {!comSom && (
        <button
          type="button"
          onClick={ativarSom}
          className="absolute inset-0 flex items-center justify-center bg-black/25"
          aria-label="Assistir com som"
        >
          <span className="rounded-2xl bg-primary px-5 py-4 text-center font-bold leading-tight text-primary-foreground shadow-lg">
            <span className="block text-3xl">🔊</span>
            <span className="block text-base">Toque para assistir com som</span>
          </span>
        </button>
      )}
    </div>
  );
}
