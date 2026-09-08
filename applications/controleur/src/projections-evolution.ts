/**
 * Projections dynamique évolutive — reproduction autonome.
 * Descriptives uniquement : aucune sélection, aucun ranking fitness.
 */

import type {
  EvenementEsp,
  ParametresReproductionExperience,
  PolitiqueBudgetCognitifBase,
  PolitiqueReproductionAutonome,
} from "@esp/protocole";
import {
  calculerValeurEconomiqueNette,
  evaluerEligibiliteReproductionAutonome,
  serialiserMicroUsdc,
} from "@esp/protocole";
import type { AgentExperience } from "./projections.js";
import { construireMapEnfants } from "./projections.js";
import type { ProjectionGeneDiversite } from "./projections-mutation.js";
import {
  empreinteConfigurationAgent,
  projeterDiversiteHeritablePopulation,
} from "./projections-mutation.js";

export const AVERTISSEMENT_DYNAMIQUE_EVOLUTIVE =
  "SELECTION_EMERGENTE_SANS_RANKING_FITNESS" as const;

export type ProjectionSuccesReproductifAgent = {
  readonly nombreEnfants: number;
  /** Alias de nombreEnfants (descendants de génération +1). */
  readonly nombreDescendantsDirects: number;
  readonly nombreDescendantsTotaux: number;
  /** Cycle première naissance enfant − cycleNaissance parent, ou null. */
  readonly agePremiereReproduction: number | null;
  /** Écart moyen entre cycles de naissance successifs des enfants, ou null si <2. */
  readonly intervalleMoyenReproductions: number | null;
  /** Éligibilité évaluée ce cycle (PLANIFIEE ou recalcul), sinon null. */
  readonly eligibleReproduction: boolean | null;
  readonly motifNonEligibilite: string | null;
  /** Dotation + coût reproduction (micro USDC). */
  readonly coutNecessaireMicroUsdc: string;
  /** VEN − besoin si calcul d'éligibilité, sinon null. */
  readonly reserveApresReproductionMicroUsdc: string | null;
  readonly dernierCycleReproduction: number | null;
};

export type ProjectionLigneeEvolutive = {
  readonly identifiantLignee: string;
  readonly membresCumules: number;
  readonly membresVivants: number;
  readonly naissancesCumulees: number;
  /** membresVivants × 10000 / populationVivanteTotale (0 si aucune). */
  readonly partPopulationVivanteBps: number;
};

export type ProjectionFrequenceGenotype = {
  readonly empreinteConfiguration: string;
  readonly agentsVivants: number;
  readonly agentsCumules: number;
  readonly partPopulationVivanteBps: number;
};

export type ProjectionDynamiqueEvolutive = {
  readonly populationActuelle: number;
  readonly naissancesCycle: number;
  readonly generationsPresentes: readonly number[];
  readonly ligneesVivantes: number;
  /** Éligibles ordonnés du dernier PLANIFIEE ce cycle, sinon 0. */
  readonly candidatsReproduction: number;
  /** Retenus PLANIFIEE, sinon naissancesCycle. */
  readonly reproductionsAutorisees: number;
  /** Agents candidats évalués non éligibles (recalcul). */
  readonly refusEconomiques: number;
  /** Refus capacité du PLANIFIEE ce cycle, sinon 0. */
  readonly refusCapacite: number;
  readonly configurationsHeritablesDistinctes: number;
  readonly lignees: readonly ProjectionLigneeEvolutive[];
  readonly frequencesGenotypes: readonly ProjectionFrequenceGenotype[];
  /** Distributions de gènes — même source que projections-mutation. */
  readonly genes: readonly ProjectionGeneDiversite[];
  readonly avertissement: typeof AVERTISSEMENT_DYNAMIQUE_EVOLUTIVE;
};

export type ChargePlanReproductionAutonomeLue = {
  readonly numeroCycle: number;
  readonly identifiantsEligiblesOrdonnes: readonly string[];
  readonly identifiantsRetenus: readonly string[];
  readonly identifiantsRefusCapacite: readonly string[];
};

/**
 * Lit le dernier REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE pour un cycle.
 */
export function lirePlanReproductionAutonomeCycle(
  evenements: readonly EvenementEsp[],
  numeroCycle: number,
): ChargePlanReproductionAutonomeLue | undefined {
  let trouve: ChargePlanReproductionAutonomeLue | undefined;
  for (const evenement of evenements) {
    if (
      evenement.type !== "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE" ||
      evenement.numeroCycle !== numeroCycle
    ) {
      continue;
    }
    const charge = evenement.chargeUtile;
    const eligibles = charge.identifiantsEligiblesOrdonnes;
    const retenus = charge.identifiantsRetenus;
    const refus = charge.identifiantsRefusCapacite;
    if (
      typeof charge.numeroCycle !== "number" ||
      !Array.isArray(eligibles) ||
      !Array.isArray(retenus) ||
      !Array.isArray(refus)
    ) {
      continue;
    }
    trouve = {
      numeroCycle: charge.numeroCycle,
      identifiantsEligiblesOrdonnes: eligibles as string[],
      identifiantsRetenus: retenus as string[],
      identifiantsRefusCapacite: refus as string[],
    };
  }
  return trouve;
}

function partBps(numerateur: number, denominateur: number): number {
  if (denominateur <= 0) {
    return 0;
  }
  return Math.floor((numerateur * 10_000) / denominateur);
}

function construireArbreEnfants(
  agents: readonly AgentExperience[],
): Map<string, string[]> {
  return construireMapEnfants(agents);
}

function compterDescendantsTotaux(
  identifiant: string,
  enfantsParParent: ReadonlyMap<string, readonly string[]>,
): number {
  let total = 0;
  const file = [...(enfantsParParent.get(identifiant) ?? [])];
  while (file.length > 0) {
    const enfant = file.shift()!;
    total += 1;
    const petits = enfantsParParent.get(enfant);
    if (petits !== undefined) {
      file.push(...petits);
    }
  }
  return total;
}

function cyclesNaissanceEnfants(
  identifiantParent: string,
  agents: readonly AgentExperience[],
): number[] {
  return agents
    .filter((a) => a.identite.identifiantParent === identifiantParent)
    .map((a) => a.identite.cycleNaissance)
    .sort((a, b) => a - b);
}

function agentEstCandidatEvaluation(options: {
  readonly agent: AgentExperience;
  readonly numeroCycle: number;
}): boolean {
  return (
    options.agent.etatEconomique.etatSurvie !== "mort" &&
    options.agent.identite.cycleNaissance !== options.numeroCycle
  );
}

function coutNecessaire(
  parametres: ParametresReproductionExperience | undefined,
): bigint {
  if (parametres === undefined) {
    return 0n;
  }
  return (
    parametres.dotationEnfantMicroUsdc + parametres.coutReproductionMicroUsdc
  );
}

function evaluerAgentReproduction(options: {
  readonly agent: AgentExperience;
  readonly agents: readonly AgentExperience[];
  readonly numeroCycle: number;
  readonly politique: PolitiqueReproductionAutonome;
  readonly parametresReproduction: ParametresReproductionExperience;
  readonly reproductionsDejaCeCycle: number;
}): {
  readonly eligible: boolean;
  readonly motif: string | null;
  readonly reserveApres: bigint;
} {
  const enfants = options.agents.filter(
    (a) => a.identite.identifiantParent === options.agent.identite.identifiant,
  );
  const cycleDerniere =
    enfants.length === 0
      ? null
      : Math.max(...enfants.map((e) => e.identite.cycleNaissance));
  const besoin = coutNecessaire(options.parametresReproduction);
  const reserveApres =
    calculerValeurEconomiqueNette(options.agent.etatEconomique) - besoin;
  const resultat = evaluerEligibiliteReproductionAutonome({
    politique: options.politique,
    parametresReproduction: options.parametresReproduction,
    etatParent: options.agent.etatEconomique,
    populationTotale: options.agents.length,
    nombreEnfantsParent: enfants.length,
    reproductionsDejaCeCycle: options.reproductionsDejaCeCycle,
    cycleDerniereNaissanceParent: cycleDerniere,
    numeroCycle: options.numeroCycle,
    cycleNaissanceAgent: options.agent.identite.cycleNaissance,
  });
  if (resultat.eligible) {
    return { eligible: true, motif: null, reserveApres };
  }
  return { eligible: false, motif: resultat.motif, reserveApres };
}

/**
 * Succès reproductif d'un agent — descriptif, pas une fitness.
 */
export function projeterSuccesReproductifAgent(options: {
  readonly agent: AgentExperience;
  readonly agents: readonly AgentExperience[];
  readonly evenements: readonly EvenementEsp[];
  readonly cycleCourant: number;
  readonly parametresReproduction?: ParametresReproductionExperience;
  readonly politiqueReproductionAutonome?: PolitiqueReproductionAutonome;
}): ProjectionSuccesReproductifAgent {
  const enfantsParParent = construireArbreEnfants(options.agents);
  const identifiant = options.agent.identite.identifiant;
  const enfantsDirects = enfantsParParent.get(identifiant) ?? [];
  const nombreEnfants = enfantsDirects.length;
  const cyclesEnfants = cyclesNaissanceEnfants(identifiant, options.agents);

  let agePremiereReproduction: number | null = null;
  let intervalleMoyenReproductions: number | null = null;
  let dernierCycleReproduction: number | null = null;

  if (cyclesEnfants.length > 0) {
    const premier = cyclesEnfants[0]!;
    agePremiereReproduction = premier - options.agent.identite.cycleNaissance;
    dernierCycleReproduction = cyclesEnfants[cyclesEnfants.length - 1]!;
    if (cyclesEnfants.length >= 2) {
      let somme = 0;
      for (let i = 1; i < cyclesEnfants.length; i += 1) {
        somme += cyclesEnfants[i]! - cyclesEnfants[i - 1]!;
      }
      intervalleMoyenReproductions = somme / (cyclesEnfants.length - 1);
    }
  }

  const besoin = coutNecessaire(options.parametresReproduction);
  const coutNecessaireMicroUsdc = serialiserMicroUsdc(besoin);

  let eligibleReproduction: boolean | null = null;
  let motifNonEligibilite: string | null = null;
  let reserveApresReproductionMicroUsdc: string | null = null;

  const plan = lirePlanReproductionAutonomeCycle(
    options.evenements,
    options.cycleCourant,
  );
  const politique = options.politiqueReproductionAutonome;
  const parametres = options.parametresReproduction;
  const estCandidat = agentEstCandidatEvaluation({
    agent: options.agent,
    numeroCycle: options.cycleCourant,
  });

  if (politique !== undefined && parametres !== undefined && estCandidat) {
    const detail = evaluerAgentReproduction({
      agent: options.agent,
      agents: options.agents,
      numeroCycle: options.cycleCourant,
      politique,
      parametresReproduction: parametres,
      reproductionsDejaCeCycle: 0,
    });
    reserveApresReproductionMicroUsdc = serialiserMicroUsdc(detail.reserveApres);

    if (plan !== undefined) {
      const eligiblesPlan = new Set(plan.identifiantsEligiblesOrdonnes);
      if (eligiblesPlan.has(identifiant)) {
        eligibleReproduction = true;
        motifNonEligibilite = null;
      } else {
        eligibleReproduction = false;
        motifNonEligibilite = detail.motif;
      }
    } else {
      eligibleReproduction = detail.eligible;
      motifNonEligibilite = detail.motif;
    }
  }

  return {
    nombreEnfants,
    nombreDescendantsDirects: nombreEnfants,
    nombreDescendantsTotaux: compterDescendantsTotaux(
      identifiant,
      enfantsParParent,
    ),
    agePremiereReproduction,
    intervalleMoyenReproductions,
    eligibleReproduction,
    motifNonEligibilite,
    coutNecessaireMicroUsdc,
    reserveApresReproductionMicroUsdc,
    dernierCycleReproduction,
  };
}

export function projeterLigneesEvolutives(options: {
  readonly agents: readonly AgentExperience[];
}): readonly ProjectionLigneeEvolutive[] {
  const populationVivanteTotale = options.agents.filter(
    (a) => a.etatEconomique.etatSurvie !== "mort",
  ).length;

  const parLignee = new Map<
    string,
    { membresCumules: number; membresVivants: number; naissancesCumulees: number }
  >();

  for (const agent of options.agents) {
    const id = agent.identite.identifiantLignee;
    const courant = parLignee.get(id) ?? {
      membresCumules: 0,
      membresVivants: 0,
      naissancesCumulees: 0,
    };
    courant.membresCumules += 1;
    if (agent.etatEconomique.etatSurvie !== "mort") {
      courant.membresVivants += 1;
    }
    if (agent.identite.identifiantParent !== undefined) {
      courant.naissancesCumulees += 1;
    }
    parLignee.set(id, courant);
  }

  return [...parLignee.entries()]
    .map(([identifiantLignee, stats]) => ({
      identifiantLignee,
      membresCumules: stats.membresCumules,
      membresVivants: stats.membresVivants,
      naissancesCumulees: stats.naissancesCumulees,
      partPopulationVivanteBps: partBps(
        stats.membresVivants,
        populationVivanteTotale,
      ),
    }))
    .sort((a, b) => a.identifiantLignee.localeCompare(b.identifiantLignee));
}

export function projeterFrequencesGenotypes(options: {
  readonly agents: readonly AgentExperience[];
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): readonly ProjectionFrequenceGenotype[] {
  const populationVivanteTotale = options.agents.filter(
    (a) => a.etatEconomique.etatSurvie !== "mort",
  ).length;

  const parEmpreinte = new Map<
    string,
    { agentsVivants: number; agentsCumules: number }
  >();

  for (const agent of options.agents) {
    const empreinte = empreinteConfigurationAgent({
      ...(agent.configurationHeritable !== undefined
        ? { configurationHeritable: agent.configurationHeritable }
        : {}),
      ...(options.politiqueBase !== undefined
        ? { politiqueBase: options.politiqueBase }
        : {}),
    });
    const courant = parEmpreinte.get(empreinte) ?? {
      agentsVivants: 0,
      agentsCumules: 0,
    };
    courant.agentsCumules += 1;
    if (agent.etatEconomique.etatSurvie !== "mort") {
      courant.agentsVivants += 1;
    }
    parEmpreinte.set(empreinte, courant);
  }

  return [...parEmpreinte.entries()]
    .map(([empreinteConfiguration, stats]) => ({
      empreinteConfiguration,
      agentsVivants: stats.agentsVivants,
      agentsCumules: stats.agentsCumules,
      partPopulationVivanteBps: partBps(
        stats.agentsVivants,
        populationVivanteTotale,
      ),
    }))
    .sort((a, b) =>
      a.empreinteConfiguration.localeCompare(b.empreinteConfiguration),
    );
}

/**
 * Agrégats population de dynamique évolutive (émergence sans ranking fitness).
 */
export function projeterDynamiqueEvolutive(options: {
  readonly agents: readonly AgentExperience[];
  readonly evenements: readonly EvenementEsp[];
  readonly cycleCourant: number;
  readonly parametresReproduction?: ParametresReproductionExperience;
  readonly politiqueReproductionAutonome?: PolitiqueReproductionAutonome;
  readonly politiqueBase?: PolitiqueBudgetCognitifBase;
}): ProjectionDynamiqueEvolutive {
  const generations = new Set<number>();
  const ligneesVivantes = new Set<string>();
  let naissancesCycle = 0;

  for (const agent of options.agents) {
    generations.add(agent.identite.generation);
    if (agent.etatEconomique.etatSurvie !== "mort") {
      ligneesVivantes.add(agent.identite.identifiantLignee);
    }
    if (
      agent.identite.identifiantParent !== undefined &&
      agent.identite.cycleNaissance === options.cycleCourant
    ) {
      naissancesCycle += 1;
    }
  }

  const plan = lirePlanReproductionAutonomeCycle(
    options.evenements,
    options.cycleCourant,
  );

  let candidatsReproduction = 0;
  let reproductionsAutorisees = naissancesCycle;
  let refusCapacite = 0;
  let refusEconomiques = 0;

  if (plan !== undefined) {
    candidatsReproduction = plan.identifiantsEligiblesOrdonnes.length;
    reproductionsAutorisees = plan.identifiantsRetenus.length;
    refusCapacite = plan.identifiantsRefusCapacite.length;
  }

  const politique = options.politiqueReproductionAutonome;
  const parametres = options.parametresReproduction;
  if (politique !== undefined && parametres !== undefined) {
    for (const agent of options.agents) {
      if (
        !agentEstCandidatEvaluation({
          agent,
          numeroCycle: options.cycleCourant,
        })
      ) {
        continue;
      }
      const detail = evaluerAgentReproduction({
        agent,
        agents: options.agents,
        numeroCycle: options.cycleCourant,
        politique,
        parametresReproduction: parametres,
        reproductionsDejaCeCycle: 0,
      });
      if (!detail.eligible) {
        refusEconomiques += 1;
      }
    }
  }

  const frequencesGenotypes = projeterFrequencesGenotypes({
    agents: options.agents,
    ...(options.politiqueBase !== undefined
      ? { politiqueBase: options.politiqueBase }
      : {}),
  });

  const diversite = projeterDiversiteHeritablePopulation({
    agents: options.agents,
    evenements: options.evenements,
    cycleCourant: options.cycleCourant,
    ...(options.politiqueBase !== undefined
      ? { politiqueBase: options.politiqueBase }
      : {}),
  });

  return {
    populationActuelle: options.agents.length,
    naissancesCycle,
    generationsPresentes: [...generations].sort((a, b) => a - b),
    ligneesVivantes: ligneesVivantes.size,
    candidatsReproduction,
    reproductionsAutorisees,
    refusEconomiques,
    refusCapacite,
    configurationsHeritablesDistinctes: frequencesGenotypes.length,
    lignees: projeterLigneesEvolutives({ agents: options.agents }),
    frequencesGenotypes,
    genes: diversite.genes,
    avertissement: AVERTISSEMENT_DYNAMIQUE_EVOLUTIVE,
  };
}
