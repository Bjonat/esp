import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ControleurExperience } from "./controleur.js";
import { demarrerServeurApi } from "./api.js";

const repertoireRacine = resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);

const cheminConfiguration =
  process.env.ESP_CONFIG ??
  resolve(repertoireRacine, "experiences/developpement-population-v01.json");

const cheminSqlite =
  process.env.ESP_SQLITE ??
  resolve(repertoireRacine, "data/developpement/esp.sqlite");

const port = Number(process.env.ESP_PORT ?? "3001");
const hote = process.env.ESP_HOTE ?? "127.0.0.1";

const controleur = ControleurExperience.depuisFichiers({
  cheminConfiguration,
  cheminSqlite,
});

const serveur = await demarrerServeurApi({
  controleur,
  hote,
  port,
});

const experience = controleur.projeterExperience();

console.log("ESP contrôleur d'expérience v0.1");
console.log(`  API          http://${serveur.hote}:${String(serveur.port)}`);
console.log(`  Expérience   ${experience.identifiantExperience}`);
console.log(`  Mode         ${experience.libelleMode}`);
console.log(`  Statut       ${experience.statut}`);
console.log(`  Cycle        ${String(experience.numeroCycleCourant)}`);
console.log(
  `  Population   ${String(controleur.projeterPopulation().populationTotale)}`,
);
console.log(`  SQLite       ${cheminSqlite}`);
console.log("  Source vérité registre (EXPERIENCE_CREEE + événements)");

function arreter(): void {
  console.log("Arrêt du contrôleur…");
  void serveur.fermer().then(() => {
    controleur.fermer();
    process.exit(0);
  });
}

process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
