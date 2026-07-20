import type { MetadataRoute } from "next";

/**
 * Robots con regole esplicite per AI crawlers (Google AI Overview /
 * SGE, ChatGPT Search, Perplexity, Claude, Bing AI, ecc.).
 *
 * Tecnicamente la regola wildcard `*` allow gia' permette tutto, ma
 * dichiarare esplicitamente ogni AI agent e' il segnale che vogliono
 * vedere:
 *  - Indica intenzione esplicita di essere indicizzati come fonte
 *  - Alcuni AI bot rispettano solo regole nominali, ignorando `*`
 *  - Da' visibilita' chiara sul Search Console quali bot stiamo
 *    permettendo
 */
export default function robots(): MetadataRoute.Robots {
  const allow = "/";
  return {
    rules: [
      { userAgent: "*", allow },
      // ─── Google AI (Bard, Gemini, AI Overview / SGE) ───
      { userAgent: "Google-Extended", allow },
      // ─── OpenAI ───
      { userAgent: "GPTBot", allow }, // training crawl
      { userAgent: "ChatGPT-User", allow }, // user-initiated browsing
      { userAgent: "OAI-SearchBot", allow }, // SearchGPT
      // ─── Anthropic Claude ───
      { userAgent: "ClaudeBot", allow },
      { userAgent: "Claude-Web", allow },
      { userAgent: "anthropic-ai", allow },
      // ─── Perplexity AI ───
      { userAgent: "PerplexityBot", allow },
      { userAgent: "Perplexity-User", allow },
      // ─── Common Crawl (fonte upstream per molti LLM) ───
      { userAgent: "CCBot", allow },
      // ─── Apple (Siri Search, Spotlight, Apple Intelligence) ───
      { userAgent: "Applebot", allow },
      { userAgent: "Applebot-Extended", allow },
      // ─── Microsoft Bing AI / Copilot ───
      { userAgent: "Bingbot", allow },
      // ─── Meta AI (Llama) ───
      { userAgent: "Meta-ExternalAgent", allow },
      { userAgent: "FacebookBot", allow },
      // ─── Mistral ───
      { userAgent: "MistralAI-User", allow },
      // ─── You.com ───
      { userAgent: "YouBot", allow },
      // ─── ByteDance (Doubao, Volcano AI) ───
      { userAgent: "Bytespider", allow },
      // ─── Diffbot (knowledge graph fonte per molti AI) ───
      { userAgent: "Diffbot", allow },
      // ─── Cohere ───
      { userAgent: "cohere-ai", allow },
    ],
    sitemap: "https://energyindex.it/sitemap.xml",
    host: "energyindex.it",
  };
}
