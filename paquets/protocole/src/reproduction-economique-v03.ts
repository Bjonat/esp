/**
 * Contrat pur — capacité reproductive économique ESP v0.3.
 *
 * Version : `reproduction-economique-v03`
 *
 * Sépare explicitement :
 * - ouverture de fenêtre reproductive (structurelle / inter-cycles, cooldown) ;
 * - autorisation économique unitaire d'une naissance (réévaluable, sans cooldown).
 *
 * La capacité théorique est descriptive / borne de planification —
 * JAMAIS un score, JAMAIS une clé de classement inter-parents.
 *
 * Aucune donnée relative à d'autres agents n'entre dans ces contrats.
 * Les comportements v0.1 / v0.2 restent inchangés (modules distincts).
 */

import {
  calculerValeurEconomiqueNette,
  type EtatEconomiqueAgent,
} from "./etat-economique.js";
import { estEtatMort, type EtatSurvie } from "./etat-survie.js";
import type { MotifRefusReproduction } from "./evenements-reproduction.js";
import {
  assertMicroUsdcNonNegatif,
  type MicroUsdc,
} from "./monnaie.js";

export const VERSION_REPRODUCTION_ECONOMIQUE_V03 =
  "reproduction-economique-v03" as const;

export class ReproductionEconomiqueV03InvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReproductionEconomiqueV03InvalideErreur";
  }
}

/**
 * Coût économique complet d'une naissance financée.
 *
 * `coutNaissance = dotationEnfant + coutReproduction`
 *
 * Fail-closed si montant négatif ou coût total nul (division de capacité
 * indéfinie).
 */
export function calculerCoutEconomiqueNaissanceV03(options: {
  readonly dotationEnfantMicroUsdc: MicroUsdc;
  readonly coutReproductionMicroUsdc: MicroUsdc;
}): MicroUsdc {
  assertMicroUsdcNonNegatif(
    options.dotationEnfantMicroUsdc,
    "dotationEnfant",
  );
  assertMicroUsdcNonNegatif(
    options.coutReproductionMicroUsdc,
    "coutReproduction",
  );
  const cout =
    options.dotationEnfantMicroUsdc + options.coutReproductionMicroUsdc;
  if (cout === 0n) {
    throw new ReproductionEconomiqueV03InvalideErreur(
      "coutNaissance nul interdit (dotation + coûtReproduction doit être > 0)",
    );
  }
  return cout;
}

/**
 * Surplus reproductif local.
 *
 * `surplus = max(0, VEN_canonique − reserveMinimaleParent)`
 *
 * VEN canonique = capitalLiquide − obligationsDues — ne pas resoustraire
 * obligations / loyers / redevances ici.
 *
 * Une VEN négative est un état économique valide : le surplus vaut `0`.
 * Une réserve minimale négative reste invalide.
 */
export function calculerSurplusReproductifV03(options: {
  readonly venMicroUsdc: MicroUsdc;
  readonly reserveMinimaleParentMicroUsdc: MicroUsdc;
}): MicroUsdc {
  assertMicroUsdcNonNegatif(
    options.reserveMinimaleParentMicroUsdc,
    "reserveMinimaleParent",
  );
  const delta = options.venMicroUsdc - options.reserveMinimaleParentMicroUsdc;
  return delta > 0n ? delta : 0n;
}

/**
 * Capacité reproductive théorique (descriptive), exactitude entière totale.
 *
 * `capaciteTheorique = floor(surplus / coutNaissance)` — opérandes et résultat
 * en `bigint` (aucun plafond artificiel, aucune conversion `number`).
 *
 * Rôles autorisés : observable, borne de planification.
 * Rôles interdits : score, classement inter-parents, fitness.
 * Conversion éventuelle vers `number` borné : uniquement en v03-B planification.
 */
export function calculerCapaciteReproductiveTheoriqueV03(options: {
  readonly surplusReproductifMicroUsdc: MicroUsdc;
  readonly coutNaissanceMicroUsdc: MicroUsdc;
}): bigint {
  assertMicroUsdcNonNegatif(
    options.surplusReproductifMicroUsdc,
    "surplusReproductif",
  );
  assertMicroUsdcNonNegatif(options.coutNaissanceMicroUsdc, "coutNaissance");
  if (options.coutNaissanceMicroUsdc === 0n) {
    throw new ReproductionEconomiqueV03InvalideErreur(
      "coutNaissance nul interdit pour calculer la capacité théorique",
    );
  }
  return options.surplusReproductifMicroUsdc / options.coutNaissanceMicroUsdc;
}

/**
 * Projection descriptive locale — pas une fitness, pas un rang.
 */
export type CapaciteReproductiveEconomiqueV03 = {
  readonly version: typeof VERSION_REPRODUCTION_ECONOMIQUE_V03;
  readonly venMicroUsdc: MicroUsdc;
  readonly reserveMinimaleMicroUsdc: MicroUsdc;
  readonly surplusReproductifMicroUsdc: MicroUsdc;
  readonly coutNaissanceMicroUsdc: MicroUsdc;
  /** Descriptive / borne `bigint` — jamais score ni clé de classement. */
  readonly capaciteTheorique: bigint;
  readonly nombreEnfantsRestants: number;
  readonly capaciteBorneeParEnfants: bigint;
};

export function projeterCapaciteReproductiveEconomiqueV03(options: {
  readonly etatParent: Pick<
    EtatEconomiqueAgent,
    "capitalLiquide" | "obligationsDues"
  >;
  readonly reserveMinimaleParentMicroUsdc: MicroUsdc;
  readonly dotationEnfantMicroUsdc: MicroUsdc;
  readonly coutReproductionMicroUsdc: MicroUsdc;
  readonly nombreEnfantsParent: number;
  readonly nombreMaxEnfantsParAgent: number;
}): CapaciteReproductiveEconomiqueV03 {
  if (
    !Number.isInteger(options.nombreEnfantsParent) ||
    options.nombreEnfantsParent < 0
  ) {
    throw new ReproductionEconomiqueV03InvalideErreur(
      "nombreEnfantsParent doit être un entier >= 0",
    );
  }
  if (
    !Number.isInteger(options.nombreMaxEnfantsParAgent) ||
    options.nombreMaxEnfantsParAgent < 0
  ) {
    throw new ReproductionEconomiqueV03InvalideErreur(
      "nombreMaxEnfantsParAgent doit être un entier >= 0",
    );
  }

  const venMicroUsdc = calculerValeurEconomiqueNette(options.etatParent);
  const coutNaissanceMicroUsdc = calculerCoutEconomiqueNaissanceV03({
    dotationEnfantMicroUsdc: options.dotationEnfantMicroUsdc,
    coutReproductionMicroUsdc: options.coutReproductionMicroUsdc,
  });
  const surplusReproductifMicroUsdc = calculerSurplusReproductifV03({
    venMicroUsdc,
    reserveMinimaleParentMicroUsdc: options.reserveMinimaleParentMicroUsdc,
  });
  const capaciteTheorique = calculerCapaciteReproductiveTheoriqueV03({
    surplusReproductifMicroUsdc,
    coutNaissanceMicroUsdc,
  });
  const nombreEnfantsRestants = Math.max(
    0,
    options.nombreMaxEnfantsParAgent - options.nombreEnfantsParent,
  );
  const capaciteBorneeParEnfants =
    capaciteTheorique < BigInt(nombreEnfantsRestants)
      ? capaciteTheorique
      : BigInt(nombreEnfantsRestants);

  return {
    version: VERSION_REPRODUCTION_ECONOMIQUE_V03,
    venMicroUsdc,
    reserveMinimaleMicroUsdc: options.reserveMinimaleParentMicroUsdc,
    surplusReproductifMicroUsdc,
    coutNaissanceMicroUsdc,
    capaciteTheorique,
    nombreEnfantsRestants,
    capaciteBorneeParEnfants,
  };
}

export type MotifRefusFenetreReproductiveV03 =
  | "reproduction_desactivee"
  | "agent_mort"
  | "etat_survie_non_eligible"
  | "naissance_meme_cycle"
  | "cooldown"
  | "nombre_enfants_max"
  | "population_maximale"
  | "reproductions_cycle_max";

export type ResultatOuvertureFenetreReproductiveV03 =
  | { readonly ouverte: true }
  | {
      readonly ouverte: false;
      readonly motif: MotifRefusFenetreReproductiveV03;
    };

/**
 * Ouverture de fenêtre reproductive v0.3 — **préfiltre au snapshot**.
 *
 * Signifie uniquement : « il existe actuellement une possibilité structurelle
 * d'ouvrir une fenêtre » (politique, survie, cooldown inter-cycles, plafonds
 * observés au snapshot).
 *
 * N'évalue PAS le financement d'une naissance précise.
 * Ne réserve AUCUNE place de population, AUCUN quota de cycle, AUCUNE
 * naissance, AUCUNE ressource économique.
 *
 * Les motifs `nombre_enfants_max` / `population_maximale` /
 * `reproductions_cycle_max` ici sont des préfiltres snapshot — l'autorité
 * courante pour chaque tentative reste
 * `evaluerAutorisationNaissanceEconomiqueV03` (réévaluée après chaque
 * naissance avec l'état réellement mis à jour). Une fenêtre ouverte ne
 * garantit jamais que toutes les tentatives prévues seront autorisées.
 */
export function evaluerOuvertureFenetreReproductiveV03(options: {
  readonly active: boolean;
  readonly etatSurvieParent: EtatSurvie;
  readonly etatsSurvieEligibles: readonly EtatSurvie[];
  readonly cycleNaissanceAgent: number;
  readonly numeroCycle: number;
  readonly cooldownCycles: number;
  readonly cycleDerniereNaissanceParent: number | null;
  readonly nombreEnfantsParent: number;
  readonly nombreMaxEnfantsParAgent: number;
  readonly populationTotale: number;
  readonly populationMaximale: number;
  readonly reproductionsDejaCeCycle: number;
  readonly nombreMaxReproductionsParCycle: number;
}): ResultatOuvertureFenetreReproductiveV03 {
  if (!options.active) {
    return { ouverte: false, motif: "reproduction_desactivee" };
  }
  if (estEtatMort(options.etatSurvieParent)) {
    return { ouverte: false, motif: "agent_mort" };
  }
  if (!options.etatsSurvieEligibles.includes(options.etatSurvieParent)) {
    return { ouverte: false, motif: "etat_survie_non_eligible" };
  }
  if (options.cycleNaissanceAgent === options.numeroCycle) {
    return { ouverte: false, motif: "naissance_meme_cycle" };
  }
  if (
    options.cooldownCycles > 0 &&
    options.cycleDerniereNaissanceParent !== null &&
    options.numeroCycle - options.cycleDerniereNaissanceParent <
      options.cooldownCycles
  ) {
    return { ouverte: false, motif: "cooldown" };
  }
  if (options.nombreEnfantsParent >= options.nombreMaxEnfantsParAgent) {
    return { ouverte: false, motif: "nombre_enfants_max" };
  }
  if (options.populationTotale + 1 > options.populationMaximale) {
    return { ouverte: false, motif: "population_maximale" };
  }
  if (
    options.reproductionsDejaCeCycle >= options.nombreMaxReproductionsParCycle
  ) {
    return { ouverte: false, motif: "reproductions_cycle_max" };
  }
  return { ouverte: true };
}

export type MotifRefusNaissanceEconomiqueV03 = Extract<
  MotifRefusReproduction,
  | "agent_mort"
  | "capital_insuffisant"
  | "reserve_minimale"
  | "nombre_enfants_max"
  | "population_maximale"
  | "reproductions_cycle_max"
>;

export type AutorisationNaissanceEconomiqueV03 =
  | {
      readonly autorisee: true;
      readonly coutNaissanceMicroUsdc: MicroUsdc;
      readonly venAvantMicroUsdc: MicroUsdc;
      readonly venApresMicroUsdc: MicroUsdc;
      readonly capitalLiquideAvantMicroUsdc: MicroUsdc;
      readonly capitalLiquideApresMicroUsdc: MicroUsdc;
    }
  | {
      readonly autorisee: false;
      readonly motif: MotifRefusNaissanceEconomiqueV03;
      readonly coutNaissanceMicroUsdc: MicroUsdc;
      readonly venAvantMicroUsdc: MicroUsdc;
    };

/**
 * Autorisation économique unitaire d'une naissance v0.3 — **autorité courante**.
 *
 * Répond uniquement : « cet agent peut-il financer cette naissance maintenant ? »
 * Réévaluable après chaque naissance avec l'état réellement mis à jour.
 * **Sans cooldown** (réservé au préfiltre de fenêtre).
 *
 * Chaîne attendue :
 * fenêtre ouverte → tentative 1 → naissance → état mis à jour → tentative 2…
 *
 * Les motifs structurels (`nombre_enfants_max`, `population_maximale`,
 * `reproductions_cycle_max`) sont ici l'autorité unitaire courante, distincte
 * du préfiltre snapshot de fenêtre.
 *
 * Entrées strictement locales au parent et aux compteurs restants —
 * aucune donnée d'un autre agent.
 */
export function evaluerAutorisationNaissanceEconomiqueV03(options: {
  readonly etatParent: EtatEconomiqueAgent;
  readonly dotationEnfantMicroUsdc: MicroUsdc;
  readonly coutReproductionMicroUsdc: MicroUsdc;
  readonly reserveMinimaleParentMicroUsdc: MicroUsdc;
  readonly nombreEnfantsParent: number;
  readonly nombreMaxEnfantsParAgent: number;
  readonly populationTotale: number;
  readonly populationMaximale: number;
  readonly reproductionsDejaCeCycle: number;
  readonly nombreMaxReproductionsParCycle: number;
}): AutorisationNaissanceEconomiqueV03 {
  const coutNaissanceMicroUsdc = calculerCoutEconomiqueNaissanceV03({
    dotationEnfantMicroUsdc: options.dotationEnfantMicroUsdc,
    coutReproductionMicroUsdc: options.coutReproductionMicroUsdc,
  });
  const venAvantMicroUsdc = calculerValeurEconomiqueNette(options.etatParent);

  if (estEtatMort(options.etatParent.etatSurvie)) {
    return {
      autorisee: false,
      motif: "agent_mort",
      coutNaissanceMicroUsdc,
      venAvantMicroUsdc,
    };
  }
  if (options.nombreEnfantsParent >= options.nombreMaxEnfantsParAgent) {
    return {
      autorisee: false,
      motif: "nombre_enfants_max",
      coutNaissanceMicroUsdc,
      venAvantMicroUsdc,
    };
  }
  if (options.populationTotale + 1 > options.populationMaximale) {
    return {
      autorisee: false,
      motif: "population_maximale",
      coutNaissanceMicroUsdc,
      venAvantMicroUsdc,
    };
  }
  if (
    options.reproductionsDejaCeCycle >= options.nombreMaxReproductionsParCycle
  ) {
    return {
      autorisee: false,
      motif: "reproductions_cycle_max",
      coutNaissanceMicroUsdc,
      venAvantMicroUsdc,
    };
  }
  if (options.etatParent.capitalLiquide < coutNaissanceMicroUsdc) {
    return {
      autorisee: false,
      motif: "capital_insuffisant",
      coutNaissanceMicroUsdc,
      venAvantMicroUsdc,
    };
  }

  assertMicroUsdcNonNegatif(
    options.reserveMinimaleParentMicroUsdc,
    "reserveMinimaleParent",
  );
  const venApresMicroUsdc = venAvantMicroUsdc - coutNaissanceMicroUsdc;
  if (venApresMicroUsdc < options.reserveMinimaleParentMicroUsdc) {
    return {
      autorisee: false,
      motif: "reserve_minimale",
      coutNaissanceMicroUsdc,
      venAvantMicroUsdc,
    };
  }

  return {
    autorisee: true,
    coutNaissanceMicroUsdc,
    venAvantMicroUsdc,
    venApresMicroUsdc,
    capitalLiquideAvantMicroUsdc: options.etatParent.capitalLiquide,
    capitalLiquideApresMicroUsdc:
      options.etatParent.capitalLiquide - coutNaissanceMicroUsdc,
  };
}
