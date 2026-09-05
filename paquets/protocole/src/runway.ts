import type { EtatSurvie } from "./etat-survie.js";
import {
  calculerValeurEconomiqueNette,
  type EtatEconomiqueAgent,
} from "./etat-economique.js";
import type { MicroUsdc } from "./monnaie.js";
import type { ParametresEconomiquesExperience } from "./parametres-economiques.js";

/**
 * Runway v0.1 : nombre de cycles opérationnels minimaux encore finançables.
 *
 * Capital disponible = VEN = capitalLiquide - obligationsDues.
 * Les obligations ne sont soustraites qu'une seule fois via la VEN
 * (pas de double retrait).
 */
export function calculerRunwayEnCycles(
  etat: Pick<EtatEconomiqueAgent, "capitalLiquide" | "obligationsDues">,
  coutOperationnelMinimalParCycleMicroUsdc: MicroUsdc,
): number {
  const capitalDisponible = calculerValeurEconomiqueNette(etat);
  if (capitalDisponible <= 0n) {
    return 0;
  }
  if (coutOperationnelMinimalParCycleMicroUsdc <= 0n) {
    // Garde-fou : un contrat valide exige un coût > 0.
    return Number.MAX_SAFE_INTEGER;
  }
  const cycles = capitalDisponible / coutOperationnelMinimalParCycleMicroUsdc;
  if (cycles > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(cycles);
}

/**
 * Détermine l'état de survie cible à partir du runway et des seuils du contrat.
 * Ne gère pas encore la mort par dormance prolongée.
 */
export function determinerEtatSurvieDepuisRunway(
  runway: number,
  parametres: Pick<
    ParametresEconomiquesExperience,
    "seuilRunwaySainEnCycles" | "seuilRunwayContraintEnCycles"
  >,
): Exclude<EtatSurvie, "mort"> {
  if (runway >= parametres.seuilRunwaySainEnCycles) {
    return "sain";
  }
  if (runway >= parametres.seuilRunwayContraintEnCycles) {
    return "contraint";
  }
  if (runway >= 1) {
    return "critique";
  }
  return "dormant";
}

export type ResultatSurvieCycle = {
  readonly etatSurvie: EtatSurvie;
  readonly cyclesDormanceConsecutifs: number;
  readonly runway: number;
};

/**
 * Recalcule survie + compteur de dormance + passage éventuel à mort.
 * La mort est irréversible (déléquée à transitionnerEtatSurvie côté appelant).
 */
export function calculerSurvieApresCycle(
  etatActuel: Pick<
    EtatEconomiqueAgent,
    "etatSurvie" | "cyclesDormanceConsecutifs" | "capitalLiquide" | "obligationsDues"
  >,
  parametres: Pick<
    ParametresEconomiquesExperience,
    | "seuilRunwaySainEnCycles"
    | "seuilRunwayContraintEnCycles"
    | "cyclesDormanceAvantMort"
    | "coutOperationnelMinimalParCycleMicroUsdc"
  >,
): ResultatSurvieCycle {
  if (etatActuel.etatSurvie === "mort") {
    return {
      etatSurvie: "mort",
      cyclesDormanceConsecutifs: etatActuel.cyclesDormanceConsecutifs,
      runway: 0,
    };
  }

  const runway = calculerRunwayEnCycles(
    etatActuel,
    parametres.coutOperationnelMinimalParCycleMicroUsdc,
  );
  let etatSurvie: EtatSurvie = determinerEtatSurvieDepuisRunway(
    runway,
    parametres,
  );
  let cyclesDormanceConsecutifs = etatActuel.cyclesDormanceConsecutifs;

  if (etatSurvie === "dormant") {
    cyclesDormanceConsecutifs += 1;
    if (cyclesDormanceConsecutifs >= parametres.cyclesDormanceAvantMort) {
      etatSurvie = "mort";
    }
  } else {
    cyclesDormanceConsecutifs = 0;
  }

  return { etatSurvie, cyclesDormanceConsecutifs, runway };
}
