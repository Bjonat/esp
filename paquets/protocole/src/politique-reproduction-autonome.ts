/**
 * Politique de reproduction autonome v0.1.
 *
 * Priorité neutre (hash déterministe) — aucune sélection par fitness / VEN.
 * L'éligibilité économique réutilise `evaluerAutorisationReproduction`.
 * L'arbitrage de capacité est global au cycle (snapshot figé).
 */

import type { EtatEconomiqueAgent } from "./etat-economique.js";
import type { MotifRefusReproduction } from "./evenements-reproduction.js";
import type { ParametresReproductionExperience } from "./parametres-reproduction.js";
import type { PolitiqueReproductionAutonome } from "./parametres-reproduction-autonome.js";
import { evaluerAutorisationReproduction } from "./reproduction.js";
import { hacherDomaines } from "./tirage-deterministe.js";

export function calculerPrioriteReproductionNeutre(options: {
  readonly versionPolitique: string;
  readonly graineExperience: number;
  readonly numeroCycle: number;
  readonly identifiantAgent: string;
}): bigint {
  return hacherDomaines([
    options.versionPolitique,
    String(options.graineExperience),
    String(options.numeroCycle),
    options.identifiantAgent,
    "priorite-reproduction",
  ]);
}

export type ContextePrioriteReproductionNeutre = {
  readonly versionPolitique: string;
  readonly graineExperience: number;
  readonly numeroCycle: number;
};

/**
 * Ordonne les candidats par priorité neutre croissante.
 * Indépendant de l'ordre d'entrée ; départage rare par identifiant si hash égal.
 */
export function ordonnerCandidatsParPrioriteNeutre(
  candidats: readonly string[],
  contexte: ContextePrioriteReproductionNeutre,
): string[] {
  const avecPriorite = candidats.map((identifiantAgent) => ({
    identifiantAgent,
    priorite: calculerPrioriteReproductionNeutre({
      ...contexte,
      identifiantAgent,
    }),
  }));
  avecPriorite.sort((a, b) => {
    if (a.priorite < b.priorite) {
      return -1;
    }
    if (a.priorite > b.priorite) {
      return 1;
    }
    if (a.identifiantAgent < b.identifiantAgent) {
      return -1;
    }
    if (a.identifiantAgent > b.identifiantAgent) {
      return 1;
    }
    return 0;
  });
  return avecPriorite.map((c) => c.identifiantAgent);
}

export type ResultatEligibiliteReproductionAutonome =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly motif: MotifRefusReproduction };

export function evaluerEligibiliteReproductionAutonome(options: {
  readonly politique: PolitiqueReproductionAutonome;
  readonly parametresReproduction: ParametresReproductionExperience;
  readonly etatParent: EtatEconomiqueAgent;
  readonly populationTotale: number;
  readonly nombreEnfantsParent: number;
  readonly reproductionsDejaCeCycle: number;
  readonly cycleDerniereNaissanceParent: number | null;
  readonly numeroCycle: number;
  readonly cycleNaissanceAgent: number;
}): ResultatEligibiliteReproductionAutonome {
  if (!options.politique.active) {
    return { eligible: false, motif: "reproduction_desactivee" };
  }

  if (options.cycleNaissanceAgent === options.numeroCycle) {
    return { eligible: false, motif: "naissance_meme_cycle" };
  }

  if (
    !options.politique.etatsSurvieEligibles.includes(
      options.etatParent.etatSurvie,
    )
  ) {
    return { eligible: false, motif: "etat_survie_non_eligible" };
  }

  const autorisation = evaluerAutorisationReproduction({
    parametres: options.parametresReproduction,
    etatParent: options.etatParent,
    populationTotale: options.populationTotale,
    nombreEnfantsParent: options.nombreEnfantsParent,
    reproductionsDejaCeCycle: options.reproductionsDejaCeCycle,
    cycleDerniereNaissanceParent: options.cycleDerniereNaissanceParent,
    numeroCycle: options.numeroCycle,
  });

  if (!autorisation.autorisee) {
    return { eligible: false, motif: autorisation.motif };
  }

  return { eligible: true };
}

export type CandidatReproductionAutonome = {
  readonly identifiantAgent: string;
  readonly etatParent: EtatEconomiqueAgent;
  readonly nombreEnfantsParent: number;
  readonly cycleDerniereNaissanceParent: number | null;
  readonly cycleNaissanceAgent: number;
};

export type PlanReproductionAutonome = {
  readonly numeroCycle: number;
  readonly versionPolitique: string;
  readonly placesDisponibles: number;
  readonly identifiantsEligiblesOrdonnes: readonly string[];
  readonly identifiantsRetenus: readonly string[];
  readonly identifiantsRefusCapacite: readonly string[];
  readonly populationAuSnapshot: number;
  readonly reproductionsDejaAuSnapshot: number;
};

export function planifierReproductionsAutonomes(options: {
  readonly politique: PolitiqueReproductionAutonome;
  readonly parametresReproduction: ParametresReproductionExperience;
  readonly graineExperience: number;
  readonly numeroCycle: number;
  readonly populationAuSnapshot: number;
  readonly reproductionsDejaAuSnapshot: number;
  readonly candidats: readonly CandidatReproductionAutonome[];
}): PlanReproductionAutonome {
  const {
    politique,
    parametresReproduction,
    graineExperience,
    numeroCycle,
    populationAuSnapshot,
    reproductionsDejaAuSnapshot,
  } = options;

  const eligibles: string[] = [];
  for (const candidat of options.candidats) {
    const resultat = evaluerEligibiliteReproductionAutonome({
      politique,
      parametresReproduction,
      etatParent: candidat.etatParent,
      populationTotale: populationAuSnapshot,
      nombreEnfantsParent: candidat.nombreEnfantsParent,
      reproductionsDejaCeCycle: reproductionsDejaAuSnapshot,
      cycleDerniereNaissanceParent: candidat.cycleDerniereNaissanceParent,
      numeroCycle,
      cycleNaissanceAgent: candidat.cycleNaissanceAgent,
    });
    if (resultat.eligible) {
      eligibles.push(candidat.identifiantAgent);
    }
  }

  const identifiantsEligiblesOrdonnes = ordonnerCandidatsParPrioriteNeutre(
    eligibles,
    {
      versionPolitique: politique.version,
      graineExperience,
      numeroCycle,
    },
  );

  const placesBrutes = Math.min(
    parametresReproduction.populationMaximale - populationAuSnapshot,
    parametresReproduction.nombreMaxReproductionsParCycle -
      reproductionsDejaAuSnapshot,
    politique.nombreMaxNaissancesParCycle,
  );
  const placesDisponibles = Math.max(0, placesBrutes);

  const identifiantsRetenus = identifiantsEligiblesOrdonnes.slice(
    0,
    placesDisponibles,
  );
  const identifiantsRefusCapacite = identifiantsEligiblesOrdonnes.slice(
    placesDisponibles,
  );

  return {
    numeroCycle,
    versionPolitique: politique.version,
    placesDisponibles,
    identifiantsEligiblesOrdonnes,
    identifiantsRetenus,
    identifiantsRefusCapacite,
    populationAuSnapshot,
    reproductionsDejaAuSnapshot,
  };
}
