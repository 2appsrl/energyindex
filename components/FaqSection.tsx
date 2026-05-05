import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Inline frontmatter stripper. Our FAQ markdown is fully under our control,
// so a 5-line helper avoids pulling in gray-matter as a runtime dependency.
function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4).replace(/^\n/, "");
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

  // Naive markdown rendering: split on `## ` headings into Q&A blocks
  const sections = content.split(/^## /m).filter(Boolean);
  if (sections.length === 0) return null;

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Domande frequenti</h2>
      <div className="space-y-4">
        {sections.map((s, i) => {
          const [question, ...rest] = s.split("\n");
          const answer = rest.join("\n").trim();
          return (
            <div key={i} className="border-l-2 border-primary/30 pl-4">
              <h3 className="font-medium">{question.trim()}</h3>
              <p className="text-muted-foreground mt-1 whitespace-pre-line">
                {answer}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
