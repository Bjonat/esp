/**
 * Projections statistiques de reproduction — source de vérité = registre.
 */

import type { EvenementEsp, MotifRefusReproduction } from "@esp/protocole";
import { lireMontantChargeUtile } from "@esp/protocole";
import type { MontantApi } from "./serialisation-api.js";
import { serialiserMontantApi } from "./serialisation-api.js";

export type ProjectionStatistiquesReproductionAgent = {
  readonly reproductionsDemandees: number;
  readonly reproductionsAutorisees: number;
  readonly reproductionsRefusees: number;
  readonly reproductionsTerminees: number;
  readonly dotationsCumulees: MontantApi;
  readonly coutsReproductifsCumules: MontantApi;
  readonly nombreEnfants: number;
  readonly refusParMotif: Readonly<Record<string, number>>;
};

const MOTIFS_CONNUS: readonly MotifRefusReproduction[] = [
  "agent_mort",
  "capital_insuffisant",
  "reserve_minimale",
  "population_maximale",
  "cooldown",
  "nombre_enfants_max",
  "reproductions_cycle_max",
  "reproduction_desactivee",
  "identifiant_ambigu",
  "etat_survie_non_eligible",
  "capacite_insuffisante",
  "naissance_meme_cycle",
];

/**
 * Agrège les statistiques reproductives d'un agent (en tant que parent)
 * exclusivement depuis le registre.
 */
export function projeterStatistiquesReproductionAgent(options: {
  readonly identifiantParent: string;
  readonly evenements: readonly EvenementEsp[];
  readonly identifiantsEnfants: readonly string[];
}): ProjectionStatistiquesReproductionAgent {
  const parent = options.identifiantParent;
  let demandees = 0;
  let autorisees = 0;
  let refusees = 0;
  let terminees = 0;
  let dotations = 0n;
  let couts = 0n;
  const refusParMotif: Record<string, number> = {};
  for (const motif of MOTIFS_CONNUS) {
    refusParMotif[motif] = 0;
  }

  const ordonnes = [...options.evenements].sort(
    (a, b) => a.sequence - b.sequence,
  );

  for (const evenement of ordonnes) {
    const charge = evenement.chargeUtile;
    if (evenement.type === "REPRODUCTION_DEMANDEE") {
      if (charge.identifiantParent === parent) {
        demandees += 1;
      }
      continue;
    }
    if (evenement.type === "REPRODUCTION_AUTORISEE") {
      if (charge.identifiantParent === parent) {
        autorisees += 1;
      }
      continue;
    }
    if (evenement.type === "REPRODUCTION_REFUSEE") {
      if (charge.identifiantParent === parent) {
        refusees += 1;
        const motif =
          typeof charge.motif === "string" ? charge.motif : "autre";
        refusParMotif[motif] = (refusParMotif[motif] ?? 0) + 1;
      }
      continue;
    }
    if (evenement.type === "REPRODUCTION_TERMINEE") {
      if (charge.identifiantParent === parent) {
        terminees += 1;
      }
      continue;
    }
    if (
      evenement.type === "TRANSFERT_INTERNE" &&
      evenement.identifiantAgent === parent &&
      charge.sens === "sortie" &&
      charge.motif === "dotation_naissance"
    ) {
      try {
        dotations += lireMontantChargeUtile(charge, "montantMicroUsdc");
      } catch {
        // ignore charge mal formée
      }
      continue;
    }
    if (
      evenement.type === "COUT_REPRODUCTION_PAYE" &&
      evenement.identifiantAgent === parent
    ) {
      try {
        couts += lireMontantChargeUtile(charge, "montantMicroUsdc");
      } catch {
        // ignore
      }
    }
  }

  return {
    reproductionsDemandees: demandees,
    reproductionsAutorisees: autorisees,
    reproductionsRefusees: refusees,
    reproductionsTerminees: terminees,
    dotationsCumulees: serialiserMontantApi(dotations),
    coutsReproductifsCumules: serialiserMontantApi(couts),
    nombreEnfants: options.identifiantsEnfants.length,
    refusParMotif,
  };
}
