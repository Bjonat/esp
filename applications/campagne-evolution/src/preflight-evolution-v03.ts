/**
 * Préflight bloquant campagne évolution v0.3.
 * Échoue avant toute création de résultat partiel.
 */

import { MECANISME_REPRODUCTION_ECONOMIQUE_V03 } from "@esp/protocole";
import { parserConfigurationExperience } from "@esp/controleur";
import {
  comparerStructureAB_V03,
  comparerStructureBC_V03,
  comparerStructureCD_V03,
  fabriquerConfigurationRunV03,
  memeEnvironnementExogeneV03,
} from "./conditions-v03.js";
import { ProtocoleEvolutionInvalideErreur } from "./protocole-evolution.js";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
  type ProtocoleExperienceEvolutionV03,
} from "./protocole-evolution-v03.js";

export class PreflightEvolutionV03Erreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreflightEvolutionV03Erreur";
  }
}

/**
 * Vérifie les invariants structurels avant lancement de campagne v0.3.
 */
export function validerPreflightCampagneEvolutionV03(
  protocole: ProtocoleExperienceEvolutionV03,
): void {
  if (protocole.version !== VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03) {
    throw new PreflightEvolutionV03Erreur(
      `préflight v0.3 : version protocole attendue ${VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03}`,
    );
  }

  if (protocole.environnementDecision === undefined) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : environnementDecision absent",
    );
  }
  if (protocole.politiqueBudgetCognitif === undefined) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : politiqueBudgetCognitif absente",
    );
  }
  if (
    protocole.fournisseur.identifiant !== "fournisseur-inference-simule" ||
    protocole.fournisseur.selecteur !== "simule"
  ) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : fournisseur simulé requis",
    );
  }
  if (
    protocole.reproductionAutonome.mecanisme !==
    MECANISME_REPRODUCTION_ECONOMIQUE_V03
  ) {
    throw new PreflightEvolutionV03Erreur(
      `préflight v0.3 : mécanisme requis ${MECANISME_REPRODUCTION_ECONOMIQUE_V03}`,
    );
  }
  if (protocole.tauxMutationConditionDBps <= 0) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : tauxMutationConditionDBps doit être > 0",
    );
  }

  const seedTemoin = protocole.seedsActives[0];
  if (seedTemoin === undefined) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : aucune seed active",
    );
  }

  const configsParCondition = new Map<
    string,
    ReturnType<typeof fabriquerConfigurationRunV03>
  >();

  for (const condition of protocole.conditions) {
    let conf;
    try {
      conf = fabriquerConfigurationRunV03(protocole, condition, seedTemoin);
    } catch (erreur) {
      const message =
        erreur instanceof Error ? erreur.message : String(erreur);
      throw new PreflightEvolutionV03Erreur(
        `préflight v0.3 : fabrication configuration condition ${condition} échouée — ${message}`,
      );
    }

    if (conf.mode !== "decision_simulee") {
      throw new PreflightEvolutionV03Erreur(
        `préflight v0.3 : mode run doit être decision_simulee (reçu ${String(conf.mode)})`,
      );
    }
    if (conf.environnementDecision === undefined) {
      throw new PreflightEvolutionV03Erreur(
        "préflight v0.3 : environnementDecision absent de la configuration fabriquée",
      );
    }
    if (conf.politiqueBudgetCognitif === undefined) {
      throw new PreflightEvolutionV03Erreur(
        "préflight v0.3 : politiqueBudgetCognitif absente de la configuration fabriquée",
      );
    }
    const fournisseur = conf.xway?.fournisseur;
    const identifiant =
      typeof fournisseur === "object" && fournisseur !== null
        ? fournisseur.identifiant
        : undefined;
    if (identifiant !== "fournisseur-inference-simule") {
      throw new PreflightEvolutionV03Erreur(
        "préflight v0.3 : fournisseur réseau détecté — seul fournisseur-inference-simule autorisé",
      );
    }

    // Matrice A/B/C/D
    if (condition === "A") {
      if (conf.reproductionAutonome?.active !== false) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : A exige reproduction autonome désactivée",
        );
      }
      if (conf.mutation?.active !== false) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : A exige mutation désactivée",
        );
      }
    }
    if (condition === "B") {
      if (conf.reproductionAutonome?.active !== true) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : B exige reproduction autonome active",
        );
      }
      if (
        conf.reproductionAutonome?.mecanisme !==
        MECANISME_REPRODUCTION_ECONOMIQUE_V03
      ) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : B exige reproduction-economique-v03",
        );
      }
      if (conf.mutation?.active !== false) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : B exige mutation désactivée",
        );
      }
    }
    if (condition === "C") {
      if (
        conf.reproductionAutonome?.mecanisme !==
        MECANISME_REPRODUCTION_ECONOMIQUE_V03
      ) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : C exige reproduction-economique-v03",
        );
      }
      if (conf.mutation?.active !== true) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : C exige mutation active (sham)",
        );
      }
      if (conf.mutation?.tauxMutationParGeneBps !== 0) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : C exige tauxMutation = 0",
        );
      }
    }
    if (condition === "D") {
      if (
        conf.reproductionAutonome?.mecanisme !==
        MECANISME_REPRODUCTION_ECONOMIQUE_V03
      ) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : D exige reproduction-economique-v03",
        );
      }
      if (conf.mutation?.active !== true) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : D exige mutation active",
        );
      }
      if (
        conf.mutation?.tauxMutationParGeneBps !==
        protocole.tauxMutationConditionDBps
      ) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : D exige tauxMutation = tauxMutationConditionDBps",
        );
      }
      if ((conf.mutation?.tauxMutationParGeneBps ?? 0) <= 0) {
        throw new PreflightEvolutionV03Erreur(
          "préflight v0.3 : D refuse tauxMutation = 0",
        );
      }
    }

    try {
      parserConfigurationExperience(conf);
    } catch (erreur) {
      const message =
        erreur instanceof Error ? erreur.message : String(erreur);
      throw new PreflightEvolutionV03Erreur(
        `préflight v0.3 : configuration expérience invalide (${condition}) — ${message}`,
      );
    }

    configsParCondition.set(condition, conf);
  }

  const confA = configsParCondition.get("A");
  const confB = configsParCondition.get("B");
  const confC = configsParCondition.get("C");
  const confD = configsParCondition.get("D");
  if (
    confA === undefined ||
    confB === undefined ||
    confC === undefined ||
    confD === undefined
  ) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : matrice A/B/C/D incomplète",
    );
  }

  if (!memeEnvironnementExogeneV03([confA, confB, confC, confD])) {
    throw new PreflightEvolutionV03Erreur(
      "préflight v0.3 : environnement exogène divergent entre A/B/C/D",
    );
  }

  const ab = comparerStructureAB_V03(confA, confB);
  if (!ab.ok) {
    throw new PreflightEvolutionV03Erreur(
      `préflight v0.3 : différences A/B hors reproduction — ${ab.differencesDetectees.join(", ")}`,
    );
  }
  const bc = comparerStructureBC_V03(confB, confC);
  if (!bc.ok) {
    throw new PreflightEvolutionV03Erreur(
      `préflight v0.3 : différences B/C hors sham mutation — ${bc.differencesDetectees.join(", ")}`,
    );
  }
  const cd = comparerStructureCD_V03(
    confC,
    confD,
    protocole.tauxMutationConditionDBps,
  );
  if (!cd.ok) {
    throw new PreflightEvolutionV03Erreur(
      `préflight v0.3 : différences C/D hors taux mutation — ${cd.differencesDetectees.join(", ")}`,
    );
  }
}

export function assertPreflightEvolutionV03OuEchouer(
  protocole: ProtocoleExperienceEvolutionV03,
): void {
  try {
    validerPreflightCampagneEvolutionV03(protocole);
  } catch (erreur) {
    if (
      erreur instanceof PreflightEvolutionV03Erreur ||
      erreur instanceof ProtocoleEvolutionInvalideErreur
    ) {
      throw erreur;
    }
    throw new PreflightEvolutionV03Erreur(
      erreur instanceof Error ? erreur.message : String(erreur),
    );
  }
}
