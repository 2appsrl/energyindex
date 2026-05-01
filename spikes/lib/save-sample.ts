import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function saveSample(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  console.log(`[saved] ${path}`);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function reportPath(spikeName: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `spikes/reports/${spikeName}-${ts}.md`;
}
