import type { ReactNode } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Card } from "@/components/ui/card";

// Inline frontmatter stripper. Our FAQ markdown is fully under our control,
// so a 5-line helper avoids pulling in gray-matter as a runtime dependency.
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4).replace(/^\n/, "");
}

// Render a tiny subset of inline markdown: [text](url) -> <a href>.
// Keeps the FAQ markdown readable without pulling a full markdown lib.
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={key++}
        href={match[2]}
        target={match[2].startsWith("http") ? "_blank" : undefined}
        rel={match[2].startsWith("http") ? "noopener" : undefined}
        className="text-primary underline-offset-2 hover:underline font-medium"
      >
        {match[1]}
      </a>,
    );
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export async function FaqSection({ slug }: { slug: string }) {
  let content = "";
  try {
    const file = await readFile(
      join(process.cwd(), "content/it/faq", `${slug}.md`),
      "utf-8",
    );
    content = stripFrontmatter(file);
  } catch {
    return null;
  }

  // Markdown rendering: split on `## ` headings into Q&A blocks.
  // Filter out the leading whitespace-only chunk (if any) before the first heading.
  const sections = content.split(/^## /m).filter((s) => s.trim());
  if (sections.length === 0) return null;

  const items = sections.map((s) => {
    const [question, ...rest] = s.split("\n");
    const answer = rest.join("\n").trim();
    return { question: question.trim(), answer };
  });

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Domande frequenti
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => (
          <Card
            key={i}
            className="group p-6 transition-all hover:shadow-md hover:-translate-y-0.5 bg-card"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold tabular-nums text-sm">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <h3 className="font-semibold text-foreground leading-snug">
                  {item.question}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {renderInline(item.answer)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
