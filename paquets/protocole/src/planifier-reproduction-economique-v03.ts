/**
 * Planification pure — reproduction économique multi-naissances v0.3.
 *
 * - Ordre inter-parents = priorité neutre (pas de ranking économique).
 * - Round-robin déterministe entre fenêtres ouvertes.
 * - Plan figé ≠ ressources réservées ≠ naissances garanties.
 * - Observabilité v03-C : descriptive, jamais entrée de décision.
 */

import type { EtatEconomiqueAgent } from "./etat-economique.js";
import { ecrireMontantChargeUtile } from "./evenements-economiques.js";
import {
  fabriquerIdentifiantEnfant,
  fabriquerIdentifiantReproduction,
} from "./reproduction.js";
import {
  evaluerOuvertureFenetreReproductiveV03,
  projeterCapaciteReproductiveEconomiqueV03,
} from "./reproduction-economique-v03.js";
import { MECANISME_REPRODUCTION_ECONOMIQUE_V03 } from "./mecanisme-reproduction-autonome.js";
import { ordonnerCandidatsParPrioriteNeutre } from "./politique-reproduction-autonome.js";
import type { ParametresReproductionExperience } from "./parametres-reproduction.js";
import type { PolitiqueReproductionAutonome } from "./parametres-reproduction-autonome.js";
import type {
  ChargeReproductionEconomiqueV03CyclePlanifiee,
  ObservabiliteParentReproductionEconomiqueV03,
  ParentReproductionEconomiqueV03Planifie,
  TentativeReproductionEconomiqueV03Planifiee,
} from "./evenements-reproduction-economique-v03.js";
import { ReproductionEconomiqueV03InvalideErreur } from "./reproduction-economique-v03.js";

export type CandidatReproductionEconomiqueV03 = {
  readonly identifiantAgent: string;
  readonly etatParent: EtatEconomiqueAgent;
  readonly nombreEnfantsParent: number;
  readonly cycleDerniereNaissanceParent: number | null;
  readonly cycleNaissanceAgent: number;
};

/**
 * Borne `capaciteTheorique` (bigint) par un plafond `number` sûr **avant**
 * toute conversion — jamais `Number(capaciteTheorique)` direct.
 */
export function bornerCapaciteTheoriqueVersNombreV03(
  capaciteTheorique: bigint,
  plafondNombreSur: number,
): number {
  if (
    !Number.isInteger(plafondNombreSur) ||
    plafondNombreSur < 0 ||
    plafondNombreSur > Number.MAX_SAFE_INTEGER
  ) {
    throw new ReproductionEconomiqueV03InvalideErreur(
      "plafondNombreSur doit être un entier dans [0, Number.MAX_SAFE_INTEGER]",
    );
  }
  if (capaciteTheorique <= 0n) {
    return 0;
  }
  const plafond = BigInt(plafondNombreSur);
  const borne = capaciteTheorique < plafond ? capaciteTheorique : plafond;
  return Number(borne);
}

type BrouillonObservabiliteParent = {
  readonly identifiantAgent: string;
  readonly nombreEnfantsParent: number;
  readonly projection: ReturnType<
    typeof projeterCapaciteReproductiveEconomiqueV03
  >;
  readonly fenetre: ObservabiliteParentReproductionEconomiqueV03["fenetre"];
};

export function planifierReproductionsEconomiquesV03(options: {
  readonly politique: PolitiqueReproductionAutonome;
  readonly parametresReproduction: ParametresReproductionExperience;
  readonly identifiantExperience: string;
  readonly graineExperience: number;
  readonly numeroCycle: number;
  readonly populationAuSnapshot: number;
  readonly reproductionsDejaAuSnapshot: number;
  readonly candidats: readonly CandidatReproductionEconomiqueV03[];
}): ChargeReproductionEconomiqueV03CyclePlanifiee {
  const {
    politique,
    parametresReproduction,
    identifiantExperience,
    graineExperience,
    numeroCycle,
    populationAuSnapshot,
    reproductionsDejaAuSnapshot,
  } = options;

  const placesGlobalesBrutes = Math.min(
    parametresReproduction.populationMaximale - populationAuSnapshot,
    parametresReproduction.nombreMaxReproductionsParCycle -
      reproductionsDejaAuSnapshot,
    politique.nombreMaxNaissancesParCycle,
  );
  const placesGlobalesPlanifiees = Math.max(0, placesGlobalesBrutes);

  const eligiblesOuverture: string[] = [];
  const tentativesMaxParParent = new Map<string, number>();
  const numeroEnfantBaseParParent = new Map<string, number>();
  const brouillonsObservabilite: BrouillonObservabiliteParent[] = [];

  for (const candidat of options.candidats) {
    const ouverture = evaluerOuvertureFenetreReproductiveV03({
      active: politique.active && parametresReproduction.active,
      etatSurvieParent: candidat.etatParent.etatSurvie,
      etatsSurvieEligibles: politique.etatsSurvieEligibles,
      cycleNaissanceAgent: candidat.cycleNaissanceAgent,
      numeroCycle,
      cooldownCycles: parametresReproduction.cooldownCycles,
      cycleDerniereNaissanceParent: candidat.cycleDerniereNaissanceParent,
      nombreEnfantsParent: candidat.nombreEnfantsParent,
      nombreMaxEnfantsParAgent: parametresReproduction.nombreMaxEnfantsParAgent,
      populationTotale: populationAuSnapshot,
      populationMaximale: parametresReproduction.populationMaximale,
      reproductionsDejaCeCycle: reproductionsDejaAuSnapshot,
      nombreMaxReproductionsParCycle:
        parametresReproduction.nombreMaxReproductionsParCycle,
    });

    // Capacité économique contrefactuelle locale — même si la fenêtre est
    // fermée par un garde-fou. Descriptive uniquement ; n'ouvre jamais la fenêtre.
    const projection = projeterCapaciteReproductiveEconomiqueV03({
      etatParent: candidat.etatParent,
      reserveMinimaleParentMicroUsdc:
        parametresReproduction.reserveMinimaleParentMicroUsdc,
      dotationEnfantMicroUsdc: parametresReproduction.dotationEnfantMicroUsdc,
      coutReproductionMicroUsdc:
        parametresReproduction.coutReproductionMicroUsdc,
      nombreEnfantsParent: candidat.nombreEnfantsParent,
      nombreMaxEnfantsParAgent: parametresReproduction.nombreMaxEnfantsParAgent,
    });

    const fenetre: ObservabiliteParentReproductionEconomiqueV03["fenetre"] =
      ouverture.ouverte
        ? { ouverte: true }
        : { ouverte: false, motif: ouverture.motif };

    let tentativesMaxLocales = 0;
    if (ouverture.ouverte) {
      tentativesMaxLocales = bornerCapaciteTheoriqueVersNombreV03(
        projection.capaciteTheorique,
        projection.nombreEnfantsRestants,
      );
      if (tentativesMaxLocales > 0) {
        eligiblesOuverture.push(candidat.identifiantAgent);
        tentativesMaxParParent.set(
          candidat.identifiantAgent,
          tentativesMaxLocales,
        );
        numeroEnfantBaseParParent.set(
          candidat.identifiantAgent,
          candidat.nombreEnfantsParent,
        );
      }
    }

    brouillonsObservabilite.push({
      identifiantAgent: candidat.identifiantAgent,
      nombreEnfantsParent: candidat.nombreEnfantsParent,
      projection,
      fenetre,
    });
  }

  const identifiantsParentsOrdonnes = ordonnerCandidatsParPrioriteNeutre(
    eligiblesOuverture,
    {
      versionPolitique: politique.version,
      graineExperience,
      numeroCycle,
    },
  );

  const emisesParParent = new Map<string, number>();
  for (const id of identifiantsParentsOrdonnes) {
    emisesParParent.set(id, 0);
  }

  const tentatives: TentativeReproductionEconomiqueV03Planifiee[] = [];
  let indexGlobal = 0;
  while (tentatives.length < placesGlobalesPlanifiees) {
    let ajouteCeTour = false;
    for (const identifiantParent of identifiantsParentsOrdonnes) {
      if (tentatives.length >= placesGlobalesPlanifiees) {
        break;
      }
      const max = tentativesMaxParParent.get(identifiantParent) ?? 0;
      const deja = emisesParParent.get(identifiantParent) ?? 0;
      if (deja >= max) {
        continue;
      }
      const indexTentativeParent = deja + 1;
      const numeroEnfant =
        (numeroEnfantBaseParParent.get(identifiantParent) ?? 0) +
        indexTentativeParent;
      const identifiantEnfant = fabriquerIdentifiantEnfant({
        identifiantParent,
        numeroEnfant,
      });
      const identifiantReproduction = fabriquerIdentifiantReproduction({
        identifiantExperience,
        identifiantParent,
        numeroEnfant,
      });
      tentatives.push({
        identifiantParent,
        indexTentativeParent,
        indexGlobal,
        numeroEnfant,
        identifiantEnfant,
        identifiantReproduction,
      });
      emisesParParent.set(identifiantParent, indexTentativeParent);
      indexGlobal += 1;
      ajouteCeTour = true;
    }
    if (!ajouteCeTour) {
      break;
    }
  }

  const parents: ParentReproductionEconomiqueV03Planifie[] =
    identifiantsParentsOrdonnes.map((identifiantParent) => ({
      identifiantParent,
      nombreTentativesPlanifiees: emisesParParent.get(identifiantParent) ?? 0,
    }));

  const observabiliteParents: ObservabiliteParentReproductionEconomiqueV03[] =
    brouillonsObservabilite.map((b) => ({
      identifiantAgent: b.identifiantAgent,
      numeroCycle,
      venMicroUsdc: ecrireMontantChargeUtile(b.projection.venMicroUsdc),
      reserveMinimaleMicroUsdc: ecrireMontantChargeUtile(
        b.projection.reserveMinimaleMicroUsdc,
      ),
      surplusReproductifMicroUsdc: ecrireMontantChargeUtile(
        b.projection.surplusReproductifMicroUsdc,
      ),
      coutNaissanceMicroUsdc: ecrireMontantChargeUtile(
        b.projection.coutNaissanceMicroUsdc,
      ),
      capaciteTheorique: b.projection.capaciteTheorique.toString(10),
      nombreEnfantsParent: b.nombreEnfantsParent,
      nombreEnfantsRestants: b.projection.nombreEnfantsRestants,
      capaciteBorneeParEnfants:
        b.projection.capaciteBorneeParEnfants.toString(10),
      fenetre: b.fenetre,
      nombreTentativesPlanifiees: emisesParParent.get(b.identifiantAgent) ?? 0,
    }));

  return {
    versionMecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    numeroCycle,
    versionPolitique: politique.version,
    populationAuSnapshot,
    reproductionsDejaAuSnapshot,
    placesGlobalesPlanifiees,
    identifiantsParentsOrdonnes,
    parents,
    tentatives,
    observabiliteParents,
  };
}

/**
 * Motifs pour lesquels les tentatives restantes du même parent dans le cycle
 * sont considérées impossibles sans événement économique intermédiaire.
 */
export const MOTIFS_ARRET_TENTATIVES_RESTANTES_V03 = [
  "capital_insuffisant",
  "reserve_minimale",
  "nombre_enfants_max",
  "population_maximale",
  "reproductions_cycle_max",
  "agent_mort",
] as const;

export type MotifArretTentativesRestantesV03 =
  (typeof MOTIFS_ARRET_TENTATIVES_RESTANTES_V03)[number];

export function estMotifArretTentativesRestantesV03(
  motif: string,
): motif is MotifArretTentativesRestantesV03 {
  return (MOTIFS_ARRET_TENTATIVES_RESTANTES_V03 as readonly string[]).includes(
    motif,
  );
}
