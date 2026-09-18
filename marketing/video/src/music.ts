import { getStaticFiles } from "remotion";

/**
 * Music slot: place your file at `public/music.mp3`. If it's there, both
 * compositions play it at MUSIC_VOLUME; if not, they render silent.
 *
 * We check via Remotion's getStaticFiles() so the detection runs in the
 * bundle (webpack) without pulling in Node built-ins.
 *
 * Suggested tracks (Apple keynote style — cinematic tech minimal, uplifting
 * piano / synth): Artlist "corporate uplifting", Musicbed "cinematic tech",
 * Epidemic Sound "minimal keynote". Any 60s+ clip works.
 */
export const HAS_MUSIC = getStaticFiles().some((f) => f.name === "music.mp3");

/** 0-1. Keep low so voice-over or captions stay legible. */
export const MUSIC_VOLUME = 0.35;
