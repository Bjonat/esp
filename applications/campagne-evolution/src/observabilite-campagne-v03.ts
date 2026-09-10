/**
 * Consommation des projections v03-C — sans recalcul divergent.
 * Transporte numérateurs/dénominateurs ; ne fige PAS le critère < 5 %.
 */

import {
  calculerResultatEconomiqueHorsReproductionV03,
  projeterObservabiliteReproductionEconomiqueV03,
  type EvenementPourObservabiliteV03,
  type ObservabiliteReproductionEconomiqueV03Cycle,
} from "@esp/protocole";
import type { AgregatsObservabiliteReproductionV03Resume } from "./empreinte-v03.js";

export type EvenementPourCampagneV03 = EvenementPourObservabiliteV03;

/**
 * Agrège les projections cycle v03-C sur un run complet.
 * Délègue exclusivement à `projeterObservabiliteReproductionEconomiqueV03`.
 */
export function agregerObservabiliteReproductionEconomiqueV03(options: {
  readonly evenements: readonly EvenementPourCampagneV03[];
  readonly cyclesMaximum: number;
}): {
  readonly parCycle: readonly (ObservabiliteReproductionEconomiqueV03Cycle | null)[];
  readonly agregat: AgregatsObservabiliteReproductionV03Resume | null;
} {
  const parCycle: (ObservabiliteReproductionEconomiqueV03Cycle | null)[] = [];
  let capaciteEligible = 0n;
  let bloqueeParent = 0n;
  let bloqueeGlobaux = 0n;
  let opportunitesBloquees = 0n;
  let tentativesPlanifiees = 0;
  let naissancesRealisees = 0;
  let placesGlobalesNonUtilisees = 0;
  let placesNonDemandeesParLePlan = 0;
  let tentativesPlanifieesNonRealisees = 0;
  let auMoinsUnCycle = false;

  for (let c = 1; c <= options.cyclesMaximum; c += 1) {
    const obs = projeterObservabiliteReproductionEconomiqueV03({
      evenements: options.evenements,
      numeroCycle: c,
    });
    parCycle.push(obs);
    if (obs === null) {
      continue;
    }
    auMoinsUnCycle = true;
    capaciteEligible += obs.capaciteEconomiqueTheoriqueEligible;
    bloqueeParent += obs.capaciteBloqueeParPlafondParent;
    bloqueeGlobaux += obs.capaciteBloqueeParPlafondsGlobaux;
    opportunitesBloquees += obs.opportunitesBloqueesParGardeFous;
    tentativesPlanifiees += obs.tentativesPlanifiees;
    naissancesRealisees += obs.naissancesRealisees;
    placesGlobalesNonUtilisees += obs.placesGlobalesNonUtilisees;
    placesNonDemandeesParLePlan += obs.placesNonDemandeesParLePlan;
    tentativesPlanifieesNonRealisees += obs.tentativesPlanifieesNonRealisees;
  }

  if (!auMoinsUnCycle) {
    return { parCycle, agregat: null };
  }

  return {
    parCycle,
    agregat: {
      capaciteEconomiqueTheoriqueEligible: capaciteEligible.toString(10),
      capaciteBloqueeParPlafondParent: bloqueeParent.toString(10),
      capaciteBloqueeParPlafondsGlobaux: bloqueeGlobaux.toString(10),
      opportunitesBloqueesParGardeFous: opportunitesBloquees.toString(10),
      tentativesPlanifiees,
      naissancesRealisees,
      placesGlobalesNonUtilisees,
      placesNonDemandeesParLePlan,
      tentativesPlanifieesNonRealisees,
      pressionGardeFous: {
        numerateur: opportunitesBloquees.toString(10),
        denominateur: capaciteEligible.toString(10),
      },
    },
  };
}

/**
 * Résultat économique hors reproduction — projection canonique protocole.
 * Fenêtre arbitraire ; E n'est PAS figée (v03-F).
 */
export function calculerResultatsHorsReproductionParAgentV03(options: {
  readonly evenements: readonly EvenementPourCampagneV03[];
  readonly identifiantsAgents: readonly string[];
  readonly cycleDebut: number;
  readonly cycleFin: number;
}): readonly {
  readonly identifiantAgent: string;
  readonly resultatEconomiqueHorsReproductionMicroUsdc: string;
  readonly cycleDebut: number;
  readonly cycleFin: number;
}[] {
  return options.identifiantsAgents.map((identifiantAgent) => ({
    identifiantAgent,
    resultatEconomiqueHorsReproductionMicroUsdc:
      calculerResultatEconomiqueHorsReproductionV03({
        identifiantAgent,
        evenements: options.evenements,
        fenetre: {
          cycleDebut: options.cycleDebut,
          cycleFin: options.cycleFin,
        },
      }).toString(10),
    cycleDebut: options.cycleDebut,
    cycleFin: options.cycleFin,
  }));
}

export function sommerResultatsHorsReproductionV03(
  lignes: readonly {
    readonly resultatEconomiqueHorsReproductionMicroUsdc: string;
  }[],
): string {
  let total = 0n;
  for (const l of lignes) {
    total += BigInt(l.resultatEconomiqueHorsReproductionMicroUsdc);
  }
  return total.toString(10);
}

/** Réexport explicite — le runner doit importer la projection canonique. */
export { calculerResultatEconomiqueHorsReproductionV03 };
