"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

/**
 * Video intro della landing Pro.
 *
 * I browser bloccano l'autoplay con audio finche' l'utente non interagisce
 * con la pagina. Si prova comunque a partire con l'audio; se il browser
 * rifiuta, il video gira muto come anteprima e il pulsante lo riavvia
 * dall'inizio con l'audio, cosi' l'apertura non va persa.
 */
export function ProIntroVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = false;
    video.play().catch(() => {
      video.muted = true;
      video.loop = true;
      setPreview(true);
      video.play().catch(() => {});
    });
  }, []);

  function playWithSound() {
    const video = ref.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    video.loop = false;
    setPreview(false);
    video.play().catch(() => {});
  }

  return (
    <div className="relative">
      <video
        ref={ref}
        className="w-full aspect-video"
        src={src}
        poster={poster}
        playsInline
        controls={!preview}
        preload="auto"
      />
      {preview && (
        <button
          type="button"
          onClick={playWithSound}
          className="absolute inset-0 flex items-center justify-center bg-stone-950/30 transition-colors hover:bg-stone-950/40"
          aria-label="Guarda il video dall'inizio con l'audio"
        >
          <span className="inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-xl">
            <Volume2 className="h-5 w-5" aria-hidden />
            Guarda con l&apos;audio
          </span>
        </button>
      )}
    </div>
  );
}
