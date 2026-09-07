/**
 * CLI volontaire — 1 agent, 1 requête OpenAI réelle.
 * Affiche l'aperçu AVANT l'appel. Exécute uniquement si --executer.
 *
 *   read -rsp "OPENAI_API_KEY: " OPENAI_API_KEY && echo && export OPENAI_API_KEY
 *   pnpm test:inference-reelle -- --agent agent-000 --executer
 *   unset OPENAI_API_KEY
 *
 * Option diagnostic (jamais persistée) :
 *   --diagnostiquer-sortie  affiche le texte brut de sortie dans le terminal
 */
import { resolve } from "node:path";
import {
  ControleurExperience,
  type ApercuInferenceTest,
  type ResultatInferenceTest,
} from "@esp/controleur";

function lireArg(nom: string): string | undefined {
  const index = process.argv.indexOf(nom);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function afficherApercu(apercu: ApercuInferenceTest): void {
  console.log("=== APERÇU INFÉRENCE RÉELLE (aucune exécution encore) ===");
  console.log(`identifiantAgent=${apercu.identifiantAgent}`);
  console.log(`venAgentMicroUsdc=${apercu.venAgentMicroUsdc}`);
  console.log(
    `limiteDepenseCognitiveMicroUsdc=${apercu.limiteDepenseCognitiveMicroUsdc}`,
  );
  console.log(`modeleLogique=${apercu.modeleLogique}`);
  console.log(`modeleFournisseur=${apercu.modeleExterne ?? "n/a"}`);
  console.log(`nombreMaxJetonsSortie=${String(apercu.nombreMaxJetonsSortie)}`);
  console.log(
    `estimationMaximaleXwayMicroUsdc=${apercu.estimationMaximaleXwayMicroUsdc}`,
  );
  console.log(
    `reservationCognitiveMaximaleMicroUsdc=${apercu.reservationCognitiveMaximaleMicroUsdc}`,
  );
  console.log(
    `plafondFournisseurReelTotalMicroUsd=${apercu.plafondFournisseurReelTotalMicroUsd ?? "n/a"}`,
  );
  console.log(
    `depenseFournisseurEstimeeCumuleeMicroUsd=${apercu.depenseFournisseurEstimeeCumuleeMicroUsd}`,
  );
  console.log(
    `plafondFournisseurReelRestantMicroUsd=${apercu.plafondFournisseurReelRestantMicroUsd ?? "n/a"}`,
  );
  console.log(
    `borneHauteCoutFournisseurCetAppelMicroUsd=${apercu.borneHauteCoutFournisseurCetAppelMicroUsd ?? "n/a"}`,
  );
  console.log(
    `nombreAppelsReseauMaximum=${String(apercu.nombreAppelsReseauMaximum)}`,
  );
  console.log(`fournisseur=${apercu.fournisseur}`);
  console.log(`autorisable=${apercu.autorisable ? "oui" : "non"}`);
  if (!apercu.autorisable) {
    console.log(`motifRefus=${apercu.motifRefus ?? "n/a"}`);
    console.log(`detailRefus=${apercu.detailRefus ?? "n/a"}`);
  }
  console.log(
    "AUCUNE REQUÊTE RÉSEAU EFFECTUÉE — utiliser --executer pour autoriser exactement un appel.",
  );
}

function afficherResultatExecution(
  resultat: ResultatInferenceTest,
  options: { readonly diagnostiquerSortie: boolean },
): void {
  console.log("\n=== RÉSULTAT ===");
  console.log(`statutESP=${resultat.statut}`);
  console.log(
    `proposition=${JSON.stringify(resultat.proposition, null, 2)}`,
  );

  const d = resultat.diagnostic;
  console.log("\n=== DIAGNOSTIC FOURNISSEUR (métadonnées) ===");
  if (d === undefined) {
    console.log("diagnostic=absent");
  } else {
    console.log(
      `identifiantReponseFournisseur=${d.identifiantReponseFournisseur ?? "n/a"}`,
    );
    console.log(`statutFournisseurBrut=${d.statutFournisseurBrut ?? "n/a"}`);
    console.log(
      `etatResultatFournisseur=${d.etatResultatFournisseur ?? "n/a"}`,
    );
    console.log(`inputTokens=${d.inputTokens ?? "n/a"}`);
    console.log(`cachedTokens=${d.cachedTokens ?? "n/a"}`);
    console.log(`outputTokens=${d.outputTokens ?? "n/a"}`);
    console.log(`reasoningTokens=${d.reasoningTokens ?? "n/a"}`);
    console.log(
      `coutImputeAgentMicroUsdc=${d.coutImputeAgentMicroUsdc ?? "n/a"}`,
    );
    console.log(
      `coutFournisseurEstimeMicroUsd=${d.coutFournisseurEstimeMicroUsd ?? "n/a"}`,
    );
    console.log(
      `reservationInitialeMicroUsdc=${d.reservationInitialeMicroUsdc ?? "n/a"}`,
    );
    console.log(
      `reservationLibereeMicroUsdc=${d.reservationLibereeMicroUsdc ?? "n/a"}`,
    );
    if (d.motifIncomplet !== null) {
      console.log(`motifIncomplet=${d.motifIncomplet}`);
    }
    if (d.detailResultatFournisseur !== null) {
      console.log(`detailResultatFournisseur=${d.detailResultatFournisseur}`);
    }
  }

  const audit = resultat.auditRegistre;
  console.log("\n=== AUDIT REGISTRE (causal par identifiantDemande) ===");
  if (audit === undefined) {
    console.log("audit=absent");
  } else {
    console.log(`identifiantDemande=${audit.identifiantDemande}`);
    console.log(
      `nombreINFERENCE_EXECUTEE=${String(audit.nombreInferenceExecutee)}`,
    );
    console.log(
      `nombreAttributionsDEPENSE_COMPUTE=${String(audit.nombreAttributionsDepenseCompute)}`,
    );
    console.log(
      `montantAttribueMicroUsdc=${audit.montantAttribueMicroUsdc}`,
    );
    console.log(
      `coutImputeAgentMicroUsdc=${audit.coutImputeAgentMicroUsdc ?? "n/a"}`,
    );
    console.log(
      `correspondanceMontant=${audit.correspondanceMontant ? "oui" : "non"}`,
    );
    console.log(
      `attributionUnique=${audit.attributionUnique ? "oui" : "non"}`,
    );
  }

  if (options.diagnostiquerSortie) {
    console.log(
      "\n=== SORTIE TEXTUELLE BRUTE (diagnostic CLI — non persistée) ===",
    );
    console.log(d?.texteBrutDiagnostic ?? "(absent)");
  }
}

const agent = lireArg("--agent") ?? "agent-000";
const config =
  lireArg("--config") ??
  resolve("experiences/developpement-openai-v01.exemple.json");
const sqlite =
  lireArg("--sqlite") ?? resolve("data/developpement/openai-smoke.sqlite");
const executer = process.argv.includes("--executer");
const diagnostiquerSortie = process.argv.includes("--diagnostiquer-sortie");

const controleur = ControleurExperience.depuisFichiers({
  cheminConfiguration: config,
  cheminSqlite: sqlite,
});

try {
  const agents = controleur.projeterAgents();
  const agentCible =
    agents.find((a) => a.identifiant === agent) ?? agents[0];
  if (agentCible === undefined) {
    throw new Error("Aucun agent dans l'expérience");
  }

  const apercu = controleur.apercevoirInferenceTest(agentCible.identifiant);
  afficherApercu(apercu);

  if (!executer) {
    process.exitCode = apercu.autorisable ? 0 : 1;
  } else if (!apercu.autorisable) {
    console.error(
      "\n--executer refusé : conditions d'autorisation non remplies (aucun appel réseau).",
    );
    process.exitCode = 1;
  } else if (
    process.env.OPENAI_API_KEY === undefined ||
    process.env.OPENAI_API_KEY.length === 0
  ) {
    console.error("OPENAI_API_KEY absente — fail closed.");
    process.exitCode = 2;
  } else {
    const resultat = await controleur.executerInferenceTest(
      agentCible.identifiant,
      { inclureTexteBrutDiagnostic: diagnostiquerSortie },
    );
    afficherResultatExecution(resultat, { diagnostiquerSortie });
    if (resultat.statut !== "executee") {
      process.exitCode = 1;
    }
  }
} finally {
  controleur.fermer();
}
