import { spawn } from "node:child_process";

/**
 * Lance contrôleur + tableau de bord en développement local.
 * Aucune dépendance supplémentaire (pas de concurrently).
 */
const processus = [
  spawn("pnpm", ["dev:controleur"], {
    stdio: "inherit",
    shell: true,
  }),
  spawn("pnpm", ["dev:tableau-de-bord"], {
    stdio: "inherit",
    shell: true,
  }),
];

function arreter(code = 0): void {
  for (const enfant of processus) {
    if (!enfant.killed) {
      enfant.kill("SIGTERM");
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => {
  arreter(0);
});
process.on("SIGTERM", () => {
  arreter(0);
});

for (const enfant of processus) {
  enfant.on("exit", (code) => {
    arreter(code ?? 0);
  });
}
