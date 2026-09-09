/**
 * Préflight bloquant campagne évolution v0.2.
 * Refuse de démarrer si les invariants causaux structurels sont absents.
 */

import { parserConfigurationExperience } from "@esp/controleur";
import { fabriquerConfigurationRunV02 } from "./conditions-v02.js";
import { ProtocoleEvolutionInvalideErreur } from "./protocole-evolution.js";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  type ProtocoleExperienceEvolutionV02,
} from "./protocole-evolution-v02.js";

export class PreflightEvolutionV02Erreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreflightEvolutionV02Erreur";
  }
}

/**
 * Vérifie les invariants structurels avant lancement de campagne v0.2.
 * Le contrôle de sensibilité phénotypique complet reste un test CI dédié.
 */
export function validerPreflightCampagneEvolutionV02(
  protocole: ProtocoleExperienceEvolutionV02,
): void {
  if (protocole.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02) {
    throw new PreflightEvolutionV02Erreur(
      `préflight v0.2 : version protocole attendue ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02}`,
    );
  }

  if (protocole.environnementDecision === undefined) {
    throw new PreflightEvolutionV02Erreur(
      "préflight v0.2 : environnementDecision absent",
    );
  }
  if (protocole.politiqueBudgetCognitif === undefined) {
    throw new PreflightEvolutionV02Erreur(
      "préflight v0.2 : politiqueBudgetCognitif absente",
    );
  }
  if (
    protocole.fournisseur.identifiant !== "fournisseur-inference-simule" ||
    protocole.fournisseur.selecteur !== "simule"
  ) {
    throw new PreflightEvolutionV02Erreur(
      "préflight v0.2 : fournisseur simulé requis",
    );
  }

  const seedTemoin = protocole.seedsActives[0];
  if (seedTemoin === undefined) {
    throw new PreflightEvolutionV02Erreur(
      "préflight v0.2 : aucune seed active",
    );
  }

  for (const condition of protocole.conditions) {
    let conf;
    try {
      conf = fabriquerConfigurationRunV02(protocole, condition, seedTemoin);
    } catch (erreur) {
      const message =
        erreur instanceof Error ? erreur.message : String(erreur);
      throw new PreflightEvolutionV02Erreur(
        `préflight v0.2 : fabrication configuration condition ${condition} échouée — ${message}`,
      );
    }

    if (conf.mode !== "decision_simulee") {
      throw new PreflightEvolutionV02Erreur(
        `préflight v0.2 : mode run doit être decision_simulee (reçu ${String(conf.mode)})`,
      );
    }
    if (conf.environnementDecision === undefined) {
      throw new PreflightEvolutionV02Erreur(
        "préflight v0.2 : environnementDecision absent de la configuration fabriquée",
      );
    }
    if (conf.politiqueBudgetCognitif === undefined) {
      throw new PreflightEvolutionV02Erreur(
        "préflight v0.2 : politiqueBudgetCognitif absente de la configuration fabriquée",
      );
    }
    const fournisseur = conf.xway?.fournisseur;
    const identifiant =
      typeof fournisseur === "object" && fournisseur !== null
        ? fournisseur.identifiant
        : undefined;
    if (identifiant !== "fournisseur-inference-simule") {
      throw new PreflightEvolutionV02Erreur(
        "préflight v0.2 : fournisseur réseau détecté — seul fournisseur-inference-simule autorisé",
      );
    }

    try {
      parserConfigurationExperience(conf);
    } catch (erreur) {
      const message =
        erreur instanceof Error ? erreur.message : String(erreur);
      throw new PreflightEvolutionV02Erreur(
        `préflight v0.2 : configuration expérience invalide (${condition}) — ${message}`,
      );
    }
  }
}

/** Alias explicite pour les appels CLI / runner. */
export function assertPreflightEvolutionV02OuEchouer(
  protocole: ProtocoleExperienceEvolutionV02,
): void {
  try {
    validerPreflightCampagneEvolutionV02(protocole);
  } catch (erreur) {
    if (
      erreur instanceof PreflightEvolutionV02Erreur ||
      erreur instanceof ProtocoleEvolutionInvalideErreur
    ) {
      throw erreur;
    }
    throw new PreflightEvolutionV02Erreur(
      erreur instanceof Error ? erreur.message : String(erreur),
    );
  }
}
