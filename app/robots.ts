import type { MetadataRoute } from "next";

// Crawler AI esplicitamente ammessi: sono quelli che alimentano le risposte
// di ChatGPT (GPTBot/OAI-SearchBot), Claude (ClaudeBot/Claude-SearchBot),
// Gemini (Google-Extended) e Perplexity. La regola "*" li coprirebbe gia`,
// ma elencarli rende la policy esplicita e non ambigua.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "PerplexityBot",
  "Perplexity-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
      },
    ],
    sitemap: "https://energyindex.it/sitemap.xml",
  };
}
