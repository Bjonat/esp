/**
 * Politique expérimentale versionnée — reproduction autonome v0.1.
 * Aucune sélection par fitness ; opt-in via EXPERIENCE_CREEE.
 */

import { ETATS_SURVIE, type EtatSurvie } from "./etat-survie.js";

export const VERSION_POLITIQUE_REPRODUCTION_AUTONOME =
  "politique-reproduction-autonome-v01" as const;

export type PolitiqueReproductionAutonome = {
  readonly version: typeof VERSION_POLITIQUE_REPRODUCTION_AUTONOME;
  readonly active: boolean;
  /** États de survie autorisés à candidater (défaut : sain, contraint). */
  readonly etatsSurvieEligibles: readonly EtatSurvie[];
  /** Garde-fou cycle : nombre max de naissances retenues (>= 0). */
  readonly nombreMaxNaissancesParCycle: number;
};

export type PolitiqueReproductionAutonomeJson = {
  readonly version: string;
  readonly active: boolean;
  readonly etatsSurvieEligibles: readonly string[];
  readonly nombreMaxNaissancesParCycle: number;
};

export class PolitiqueReproductionAutonomeInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolitiqueReproductionAutonomeInvalideErreur";
  }
}

const ETATS_SURVIE_ENSEMBLE = new Set<string>(ETATS_SURVIE);

function estEtatSurvie(valeur: string): valeur is EtatSurvie {
  return ETATS_SURVIE_ENSEMBLE.has(valeur);
}

/** Politique désactivée par défaut — opt-in expérimental. */
export function creerPolitiqueReproductionAutonomeInactive(): PolitiqueReproductionAutonome {
  return {
    version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
    active: false,
    etatsSurvieEligibles: ["sain", "contraint"],
    nombreMaxNaissancesParCycle: 0,
  };
}

export function parserPolitiqueReproductionAutonome(
  brut: PolitiqueReproductionAutonomeJson,
): PolitiqueReproductionAutonome {
  if (brut.version !== VERSION_POLITIQUE_REPRODUCTION_AUTONOME) {
    throw new PolitiqueReproductionAutonomeInvalideErreur(
      `version politique reproduction autonome attendue ${VERSION_POLITIQUE_REPRODUCTION_AUTONOME}, reçu ${brut.version}`,
    );
  }
  if (typeof brut.active !== "boolean") {
    throw new PolitiqueReproductionAutonomeInvalideErreur(
      "active doit être booléen",
    );
  }
  if (!Array.isArray(brut.etatsSurvieEligibles)) {
    throw new PolitiqueReproductionAutonomeInvalideErreur(
      "etatsSurvieEligibles doit être un tableau",
    );
  }
  const etatsSurvieEligibles: EtatSurvie[] = [];
  for (const etat of brut.etatsSurvieEligibles) {
    if (typeof etat !== "string" || !estEtatSurvie(etat)) {
      throw new PolitiqueReproductionAutonomeInvalideErreur(
        `état de survie invalide : ${String(etat)}`,
      );
    }
    etatsSurvieEligibles.push(etat);
  }
  if (brut.active && etatsSurvieEligibles.length === 0) {
    throw new PolitiqueReproductionAutonomeInvalideErreur(
      "etatsSurvieEligibles ne peut pas être vide lorsque la politique est active",
    );
  }
  if (
    typeof brut.nombreMaxNaissancesParCycle !== "number" ||
    !Number.isInteger(brut.nombreMaxNaissancesParCycle) ||
    brut.nombreMaxNaissancesParCycle < 0
  ) {
    throw new PolitiqueReproductionAutonomeInvalideErreur(
      "nombreMaxNaissancesParCycle doit être un entier >= 0",
    );
  }
  if ("cycleMaximum" in brut) {
    throw new PolitiqueReproductionAutonomeInvalideErreur(
      "cycleMaximum n'appartient pas à la politique de reproduction — utiliser criteresArret",
    );
  }

  return {
    version: VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
    active: brut.active,
    etatsSurvieEligibles,
    nombreMaxNaissancesParCycle: brut.nombreMaxNaissancesParCycle,
  };
}

export function serialiserPolitiqueReproductionAutonome(
  politique: PolitiqueReproductionAutonome,
): PolitiqueReproductionAutonomeJson {
  return {
    version: politique.version,
    active: politique.active,
    etatsSurvieEligibles: [...politique.etatsSurvieEligibles],
    nombreMaxNaissancesParCycle: politique.nombreMaxNaissancesParCycle,
  };
}
