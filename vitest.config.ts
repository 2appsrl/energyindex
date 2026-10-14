import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // I worktree locali dell'agent (.claude/worktrees/*) contengono copie
    // del repo con il proprio node_modules: raccoglierli duplica i test e
    // fa esplodere React ("invalid hook call" da due copie di react-dom).
    exclude: ["**/node_modules/**", "**/.next/**", ".claude/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws at import in non-RSC contexts. In vitest (Node),
      // alias to the empty shim shipped by the package (same as Next.js RSC).
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
});
