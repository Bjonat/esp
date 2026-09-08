/**
 * CLI volontaire — 1 agent × 1 observation × 1 inférence OpenAI × 1 action simulée.
 *
 * Utilise le VRAI adaptateur @esp/adaptateur-openai via Xway (AUTH, réservation,
 * FournisseurInference). Jamais appelé par avancer / pnpm test / pnpm dev.
 *
 *   read -rsp "OPENAI_API_KEY: " OPENAI_API_KEY && echo && export OPENAI_API_KEY
 *   pnpm test:decision-reelle
 *   pnpm test:decision-reelle -- --executer
 *   unset OPENAI_API_KEY
 */
import { resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ControleurExperience,
  chargerConfigurationExperience,
} from "@esp/controleur";

function aFlag(nom: string): boolean {
  return process.argv.includes(nom);
}

function lireArg(nom: string): string | undefined {
  const index = process.argv.indexOf(nom);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

async function principal(): Promise<void> {
  const executer = aFlag("--executer");
  const configPath =
    lireArg("--config") ??
    resolve("experiences/developpement-decision-openai-v01.exemple.json");

  console.log(`
ESP — test:decision-reelle (opt-in strict)
Config: ${configPath}
Adaptateur: @esp/adaptateur-openai (gpt-5.6-luna / luna_reel_v01)
Bornes: 1 agent × 1 observation × 1 inférence × 1 action simulée
`);

  if (
    process.env.OPENAI_API_KEY === undefined ||
    process.env.OPENAI_API_KEY.trim() === ""
  ) {
    console.log(
      "OPENAI_API_KEY absente — affichage procédure uniquement (exit 0, CI-safe).",
    );
    console.log(`
Procédure :
  1. Lire documentation/FOURNISSEUR_IA_REEL.md et documentation/MOTEUR_DECISION_AGENT.md
  2. read -rsp "OPENAI_API_KEY: " OPENAI_API_KEY && echo && export OPENAI_API_KEY
  3. pnpm test:decision-reelle                # aperçu, aucun réseau
  4. pnpm test:decision-reelle -- --executer  # AU PLUS 1 appel réseau
  5. unset OPENAI_API_KEY

avancer / pnpm test / pnpm build / pnpm dev ne déclenchent JAMAIS OpenAI.
`);
    return;
  }

  const configuration = chargerConfigurationExperience(configPath);
  if (configuration.mode !== "decision_simulee") {
    throw new Error("La config doit être en mode decision_simulee");
  }
  if (configuration.xway?.fournisseur.selecteur !== "openai") {
    throw new Error("La config doit avoir xway.fournisseur=openai");
  }

  const base = mkdtempSync(join(tmpdir(), "esp-decision-reelle-"));
  const controleur = ControleurExperience.ouvrir({
    configuration,
    cheminSqlite: join(base, "esp.sqlite"),
    cheminKeystoreIdentites: join(base, "identites"),
    dateCreationFixe: "2026-09-08T00:00:00.000Z",
    datesEvenementsFixes: "2026-09-08T00:00:00.000Z",
  });

  try {
    const apercu = controleur.apercevoirDecisionReelleManuelle(
      lireArg("--agent"),
    );
    console.log("=== APERÇU DÉCISION RÉELLE (aucune exécution encore) ===");
    console.log(`identifiantAgent=${apercu.identifiantAgent}`);
    console.log(`numeroCycle=${String(apercu.numeroCycle)}`);
    console.log(
      `observation=${JSON.stringify(
        {
          identifiantObservation: apercu.observation.identifiantObservation,
          probabiliteSuccesBps: apercu.observation.probabiliteSuccesBps,
          gainSiSuccesMicroUsdc:
            apercu.observation.gainSiSuccesMicroUsdc.toString(10),
          perteSiEchecMicroUsdc:
            apercu.observation.perteSiEchecMicroUsdc.toString(10),
          fraisActionMicroUsdc:
            apercu.observation.fraisActionMicroUsdc.toString(10),
          actionsAutorisees: apercu.actionsAutorisees,
        },
        null,
        2,
      )}`,
    );
    console.log(`VEN=${apercu.venMicroUsdc} microUsdc`);
    console.log(`enjeu=${apercu.enjeuMicroUsdc} microUsdc`);
    console.log(
      `utiliserInference=${apercu.utiliserInference ? "oui" : "non"}`,
    );
    console.log(`modeleLogique=${apercu.modeleLogique ?? "n/a"}`);
    console.log(
      `budgetCognitifAutorise=${apercu.limiteDepenseAutoriseeMicroUsdc} microUsdc`,
    );
    console.log(
      `reservationMaximaleXway=${apercu.limiteDepenseAutoriseeMicroUsdc} microUsdc (borne budget)`,
    );
    console.log(
      `plafondComputeParCycle=${apercu.plafondComputeParCycleMicroUsdc ?? "n/a"}`,
    );
    console.log(
      `plafondFournisseurRestantMicroUsd=${apercu.plafondFournisseurRestantMicroUsd ?? "n/a"}`,
    );
    console.log(
      `actionsAutorisees=${apercu.actionsAutorisees.join(",")}`,
    );
    console.log(`selecteurFournisseur=${apercu.selecteurFournisseur ?? "n/a"}`);
    console.log(
      `nombreAppelsReseauMaximum=${String(apercu.nombreAppelsReseauMaximum)}`,
    );

    if (!executer) {
      console.log(
        "\nAUCUNE REQUÊTE RÉSEAU — relancer avec --executer pour autoriser exactement un appel via @esp/adaptateur-openai.",
      );
      return;
    }

    console.log(
      "\n=== EXÉCUTION (1 appel réseau max via FournisseurInferenceOpenAi) ===",
    );
    const resultat = await controleur.executerDecisionReelleManuelle({
      identifiantAgent: apercu.identifiantAgent,
    });
    console.log(`action=${resultat.action}`);
    console.log(`issue=${resultat.issue}`);
    console.log(`decision=${JSON.stringify(resultat.decision, null, 2)}`);
    console.log(`coutCognitifMicroUsdc=${resultat.coutCognitifMicroUsdc}`);
    console.log(
      `attributionsXway=${JSON.stringify(resultat.attributionsXway, null, 2)}`,
    );
  } finally {
    controleur.fermer();
  }
}

principal().catch((erreur: unknown) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
});
