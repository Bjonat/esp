/**
 * Journal déterministe des tentatives de calibration.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { serialiserJsonCanonique } from "./empreinte.js";
import type { EtapeCalibration, SurchargeCalibration } from "./parametres-calibration-autorises.js";

export type DecisionCalibration =
  | "rejete"
  | "conserve"
  | "candidat_suivant"
  | "retenu";

export type EntreeJournalCalibration = {
  readonly identifiantCalibration: string;
  readonly etape: EtapeCalibration;
  readonly parametresChanges: SurchargeCalibration;
  readonly hypotheseOperationnelle: string;
  readonly criteresExamines: readonly string[];
  readonly resultatCriteres: Readonly<Record<string, boolean>>;
  readonly decision: DecisionCalibration;
  readonly dureeMs: number;
  readonly empreinteProtocoleCandidat: string;
};

const PHRASES_BANIES_DECISION = [
  "D-C",
  "D−C",
  "differenceVen",
  "regret D-C",
  "regretDC",
  "VEN D vs C",
  "contribution propriétaire D-C",
] as const;

export class DecisionCalibrationInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionCalibrationInvalideErreur";
  }
}

export function validateDecisionCalibration(texte: string): void {
  const bas = texte.toLowerCase();
  for (const motif of PHRASES_BANIES_DECISION) {
    if (texte.includes(motif) || bas.includes(motif.toLowerCase())) {
      throw new DecisionCalibrationInvalideErreur(
        `texte de décision calibration contient motif interdit « ${motif} »`,
      );
    }
  }
}

/**
 * Construit une entrée de journal (structure figée, sérialisation canonique).
 */
export function fabriquerEntreeJournalCalibration(
  entree: EntreeJournalCalibration,
): EntreeJournalCalibration {
  validateDecisionCalibration(entree.decision);
  validateDecisionCalibration(entree.hypotheseOperationnelle);
  validateDecisionCalibration(JSON.stringify(entree.resultatCriteres));
  // Ordre de clés stable via sérialisation / reparse.
  return JSON.parse(
    serialiserJsonCanonique(entree),
  ) as EntreeJournalCalibration;
}

export function serialiserEntreeJournalCalibration(
  entree: EntreeJournalCalibration,
): string {
  return serialiserJsonCanonique(fabriquerEntreeJournalCalibration(entree));
}

/**
 * Append JSONL (une ligne par entrée) ou, si chemin .json, tableau JSON.
 */
export function appendreJournalCalibration(
  chemin: string,
  entree: EntreeJournalCalibration,
): void {
  const ligne = serialiserEntreeJournalCalibration(entree);
  mkdirSync(dirname(chemin), { recursive: true });
  if (chemin.endsWith(".json") && !chemin.endsWith(".jsonl")) {
    let tableau: EntreeJournalCalibration[] = [];
    if (existsSync(chemin)) {
      const brut = readFileSync(chemin, "utf8").trim();
      if (brut.length > 0) {
        tableau = JSON.parse(brut) as EntreeJournalCalibration[];
        if (!Array.isArray(tableau)) {
          throw new Error("journal calibration .json doit être un tableau");
        }
      }
    }
    tableau.push(fabriquerEntreeJournalCalibration(entree));
    writeFileSync(
      chemin,
      `${serialiserJsonCanonique(tableau)}\n`,
      "utf8",
    );
    return;
  }
  appendFileSync(chemin, `${ligne}\n`, "utf8");
}
