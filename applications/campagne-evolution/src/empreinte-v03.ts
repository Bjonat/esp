/**
 * Empreinte scientifique v0.3 — SHA-256 canonique.
 *
 * IDENTIFIE la trajectoire causale / résultat pertinent.
 *
 * Inclus (influence causale) :
 * - trajectoire économique (VEN, capital, revenus, pertes, compute…) ;
 * - décisions / cognition (demandes inference, regret, …) ;
 * - reproduction, naissances, généalogie ;
 * - mutations effectives, configurations héritables ;
 * - métriques observabilité reproduction économique v03-C ;
 * - resultatEconomiqueHorsReproduction (projection canonique).
 *
 * EXCLUS (sans influence causale) :
 * - chemin filesystem / dossier de sortie ;
 * - horodatage wall-clock / dateLancement ;
 * - concurrence ;
 * - labels décoratifs / statutArtefact ;
 * - clés Ed25519 / IDENTITE_AGENT_ENREGISTREE ;
 * - mutation.active déclaratif du sham B/C (causalement neutre à taux 0).
 *
 * Distinct de l'empreinte protocole (choix expérimentaux figés).
 */

import {
  FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE,
  construireChargeResultatScientifique,
  empreinteSha256Canonique,
} from "./empreinte.js";

export const FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE_V03 =
  "empreinte-resultat-scientifique-sha256-v03" as const;

export type AgregatsObservabiliteReproductionV03Resume = {
  readonly capaciteEconomiqueTheoriqueEligible: string;
  readonly capaciteBloqueeParPlafondParent: string;
  readonly capaciteBloqueeParPlafondsGlobaux: string;
  readonly opportunitesBloqueesParGardeFous: string;
  readonly tentativesPlanifiees: number;
  readonly naissancesRealisees: number;
  readonly placesGlobalesNonUtilisees: number;
  readonly placesNonDemandeesParLePlan: number;
  readonly tentativesPlanifieesNonRealisees: number;
  /**
   * Ratio exact sans float : numérateur / dénominateur.
   * Critère < 5 % NON figé ici (calibration v03-F/G).
   */
  readonly pressionGardeFous: {
    readonly numerateur: string;
    readonly denominateur: string;
  };
};

export type ChargeResultatScientifiqueV03 = {
  readonly format: typeof FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE_V03;
  readonly chargeV01Compatible: ReturnType<
    typeof construireChargeResultatScientifique
  >;
  readonly observabiliteReproductionEconomique: AgregatsObservabiliteReproductionV03Resume | null;
  readonly resultatEconomiqueHorsReproductionPopulationMicroUsdc: string;
  readonly mutationsEffectives: number;
  readonly configurationsHeritablesDistinctes: number;
  readonly genealogie: {
    readonly naissancesCumulees: number;
    readonly generationMaximale: number;
    readonly descendantsCumules: number;
  };
};

export function construireChargeResultatScientifiqueV03(options: {
  readonly empreinteProtocole: string;
  readonly seed: number;
  readonly points: readonly Readonly<Record<string, unknown>>[];
  readonly resume: Readonly<Record<string, unknown>>;
  readonly observabiliteReproductionEconomique: AgregatsObservabiliteReproductionV03Resume | null;
  readonly resultatEconomiqueHorsReproductionPopulationMicroUsdc: string;
}): ChargeResultatScientifiqueV03 {
  const chargeV01 = construireChargeResultatScientifique({
    empreinteProtocole: options.empreinteProtocole,
    seed: options.seed,
    points: options.points,
    resume: options.resume,
  });

  const mutationsEffectives =
    typeof options.resume.mutationsCumulees === "number"
      ? options.resume.mutationsCumulees
      : 0;
  const configurationsHeritablesDistinctes =
    typeof options.resume.configurationsDistinctesFinales === "number"
      ? options.resume.configurationsDistinctesFinales
      : 0;

  return {
    format: FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE_V03,
    chargeV01Compatible: {
      ...chargeV01,
      format: FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE,
    },
    observabiliteReproductionEconomique:
      options.observabiliteReproductionEconomique,
    resultatEconomiqueHorsReproductionPopulationMicroUsdc:
      options.resultatEconomiqueHorsReproductionPopulationMicroUsdc,
    mutationsEffectives,
    configurationsHeritablesDistinctes,
    genealogie: {
      naissancesCumulees:
        typeof options.resume.naissancesCumulees === "number"
          ? options.resume.naissancesCumulees
          : 0,
      generationMaximale:
        typeof options.resume.generationMaximale === "number"
          ? options.resume.generationMaximale
          : 0,
      descendantsCumules:
        typeof options.resume.descendantsCumules === "number"
          ? options.resume.descendantsCumules
          : 0,
    },
  };
}

export function calculerEmpreinteResultatScientifiqueV03(
  charge: ChargeResultatScientifiqueV03,
): string {
  return empreinteSha256Canonique(charge);
}

export function calculerEmpreinteResultatScientifiqueV03DepuisRun(options: {
  readonly empreinteProtocole: string;
  readonly seed: number;
  readonly points: readonly Readonly<Record<string, unknown>>[];
  readonly resume: Readonly<Record<string, unknown>>;
  readonly observabiliteReproductionEconomique: AgregatsObservabiliteReproductionV03Resume | null;
  readonly resultatEconomiqueHorsReproductionPopulationMicroUsdc: string;
}): string {
  return calculerEmpreinteResultatScientifiqueV03(
    construireChargeResultatScientifiqueV03(options),
  );
}
