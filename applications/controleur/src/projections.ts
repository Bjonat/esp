import type {
  Agent,
  EtatEconomiqueAgent,
  EtatSurvie,
  EvenementEconomique,
  MicroUsdc,
  TresorerieProprietaire,
} from "@esp/protocole";
import {
  calculerRunwayEnCycles,
  calculerSoldeNetTresorerie,
  calculerValeurEconomiqueNette,
  creerTresorerieProprietaire,
  enregistrerDepenseInfrastructureProprietaire,
  enregistrerLoyerEncaisse,
  enregistrerRedevanceEncaissee,
  lireMontantChargeUtile,
  reconstruireEtatEconomique,
} from "@esp/protocole";
import type { ParametresEconomiquesExperience } from "@esp/protocole";
import type { MontantApi } from "./serialisation-api.js";
import { serialiserMontantApi } from "./serialisation-api.js";
import type { ModeExperience, StatutExperience } from "./configuration-experience.js";
import type { ProjectionIdentiteAgent } from "./projections-identite.js";

/** Identité d'agent enrichie pour l'observation (généalogie prête). */
export interface IdentiteAgentExperience {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent?: string;
  readonly indexPopulation: number;
  readonly cycleNaissance: number;
  readonly dateNaissance: string;
}

export interface AgentExperience {
  readonly identite: IdentiteAgentExperience;
  readonly etatEconomique: EtatEconomiqueAgent;
}

export interface ProjectionMontantsAgent {
  readonly capitalLiquide: MontantApi;
  readonly obligations: MontantApi;
  readonly valeurEconomiqueNette: MontantApi;
  readonly highWaterMark: MontantApi;
  readonly revenusCumules: MontantApi;
  readonly pertesCumulees: MontantApi;
  readonly compute: MontantApi;
  readonly donnees: MontantApi;
  readonly fraisExecution: MontantApi;
  readonly loyers: MontantApi;
  readonly redevances: MontantApi;
}

export interface ProjectionAgent {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent: string | null;
  readonly cycleNaissance: number;
  readonly dateNaissance: string;
  readonly etatSurvie: EtatSurvie;
  readonly indexPopulation: number;
  readonly runway: number;
  readonly dernierCycleActif: number;
  readonly economie: ProjectionMontantsAgent;
  readonly identifiantsEnfants: readonly string[];
  /** Identité cryptographique publique — jamais de clé privée. */
  readonly identite?: ProjectionIdentiteAgent;
}

export interface ProjectionPopulation {
  readonly populationTotale: number;
  readonly agentsSain: number;
  readonly agentsContraints: number;
  readonly agentsCritiques: number;
  readonly agentsDormants: number;
  readonly agentsMorts: number;
  readonly agentsVivants: number;
  readonly generationMaximale: number;
  readonly cycleCourant: number;
  readonly venTotale: MontantApi;
  readonly capitalLiquideTotal: MontantApi;
  readonly obligationsTotales: MontantApi;
  readonly loyersCumulesVerses: MontantApi;
  readonly redevancesCumulees: MontantApi;
}

export interface ProjectionTresorerie {
  readonly revenusLoyers: MontantApi;
  readonly revenusRedevances: MontantApi;
  readonly depensesInfrastructure: MontantApi;
  readonly soldeNet: MontantApi;
}

export interface NoeudArbreGenealogique {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent: string | null;
  readonly etatSurvie: EtatSurvie;
  readonly valeurEconomiqueNette: MontantApi;
}

export interface RelationArbreGenealogique {
  readonly identifiantParent: string;
  readonly identifiantEnfant: string;
}

export interface ProjectionArbreGenealogique {
  readonly noeuds: readonly NoeudArbreGenealogique[];
  readonly relations: readonly RelationArbreGenealogique[];
  readonly racines: readonly string[];
  readonly reproductionActivee: false;
  readonly message: "Reproduction non activée";
}

export interface ProjectionEvenement {
  readonly identifiant: string;
  readonly type: string;
  readonly identifiantAgent: string | null;
  readonly numeroCycle: number;
  readonly sequence: number;
  readonly chargeUtile: Readonly<Record<string, unknown>>;
  readonly dateEnregistrement: string | null;
  readonly montant: MontantApi | null;
  readonly resume: string;
}

export interface PointHistoriqueVen {
  readonly numeroCycle: number;
  readonly venTotale: MontantApi;
  readonly populationParEtat: Readonly<Record<EtatSurvie, number>>;
  readonly tresorerieSoldeNet: MontantApi;
}

export interface ProjectionExperience {
  readonly identifiantExperience: string;
  readonly versionProtocole: string;
  readonly statut: StatutExperience;
  readonly numeroCycleCourant: number;
  readonly dateCreation: string | null;
  readonly mode: ModeExperience;
  readonly libelleMode: "SIMULATION DÉTERMINISTE";
  readonly graineSimulation: number;
  readonly taillePopulationInitiale: number;
  readonly parametresEconomiques: {
    readonly version: string;
    readonly loyerInfrastructureMicroUsdc: string;
    readonly periodeLoyerEnCycles: number;
    readonly tauxRedevanceProprietairePointsDeBase: string;
    readonly coutOperationnelMinimalParCycleMicroUsdc: string;
    readonly seuilRunwaySainEnCycles: number;
    readonly seuilRunwayContraintEnCycles: number;
    readonly cyclesDormanceAvantMort: number;
  };
}

function compterParEtat(
  agents: readonly AgentExperience[],
): Record<EtatSurvie, number> {
  const compteurs: Record<EtatSurvie, number> = {
    sain: 0,
    contraint: 0,
    critique: 0,
    dormant: 0,
    mort: 0,
  };
  for (const agent of agents) {
    compteurs[agent.etatEconomique.etatSurvie] += 1;
  }
  return compteurs;
}

function sommer(
  agents: readonly AgentExperience[],
  selecteur: (etat: EtatEconomiqueAgent) => MicroUsdc,
): MicroUsdc {
  let total = 0n;
  for (const agent of agents) {
    total += selecteur(agent.etatEconomique);
  }
  return total;
}

export function projeterMontantsAgent(
  etat: EtatEconomiqueAgent,
): ProjectionMontantsAgent {
  return {
    capitalLiquide: serialiserMontantApi(etat.capitalLiquide),
    obligations: serialiserMontantApi(etat.obligationsDues),
    valeurEconomiqueNette: serialiserMontantApi(
      calculerValeurEconomiqueNette(etat),
    ),
    highWaterMark: serialiserMontantApi(etat.highWaterMarkProprietaire),
    revenusCumules: serialiserMontantApi(etat.totalRevenusActivite),
    pertesCumulees: serialiserMontantApi(etat.totalPertesActivite),
    compute: serialiserMontantApi(etat.totalDepensesCompute),
    donnees: serialiserMontantApi(etat.totalDepensesDonnees),
    fraisExecution: serialiserMontantApi(etat.totalFraisExecution),
    loyers: serialiserMontantApi(etat.totalLoyersPayes),
    redevances: serialiserMontantApi(etat.totalRedevancesProprietairePayees),
  };
}

export function projeterAgent(
  agent: AgentExperience,
  parametres: ParametresEconomiquesExperience,
  enfantsParParent: ReadonlyMap<string, readonly string[]>,
  projectionIdentite?: ProjectionIdentiteAgent,
): ProjectionAgent {
  const runway = calculerRunwayEnCycles(
    agent.etatEconomique,
    parametres.coutOperationnelMinimalParCycleMicroUsdc,
  );
  return {
    identifiant: agent.identite.identifiant,
    generation: agent.identite.generation,
    identifiantParent: agent.identite.identifiantParent ?? null,
    cycleNaissance: agent.identite.cycleNaissance,
    dateNaissance: agent.identite.dateNaissance,
    etatSurvie: agent.etatEconomique.etatSurvie,
    indexPopulation: agent.identite.indexPopulation,
    runway,
    dernierCycleActif: agent.etatEconomique.dernierNumeroCycle,
    economie: projeterMontantsAgent(agent.etatEconomique),
    identifiantsEnfants: enfantsParParent.get(agent.identite.identifiant) ?? [],
    ...(projectionIdentite !== undefined
      ? { identite: projectionIdentite }
      : {}),
  };
}

export function projeterPopulation(
  agents: readonly AgentExperience[],
  numeroCycleCourant: number,
  tresorerie: TresorerieProprietaire,
): ProjectionPopulation {
  const parEtat = compterParEtat(agents);
  const vivants =
    parEtat.sain + parEtat.contraint + parEtat.critique + parEtat.dormant;
  let generationMaximale = 0;
  for (const agent of agents) {
    if (agent.identite.generation > generationMaximale) {
      generationMaximale = agent.identite.generation;
    }
  }

  const capitalLiquideTotal = sommer(agents, (e) => e.capitalLiquide);
  const obligationsTotales = sommer(agents, (e) => e.obligationsDues);
  const venTotale = capitalLiquideTotal - obligationsTotales;
  const loyersCumulesVerses = sommer(agents, (e) => e.totalLoyersPayes);
  const redevancesCumulees = sommer(
    agents,
    (e) => e.totalRedevancesProprietairePayees,
  );

  void tresorerie;

  return {
    populationTotale: agents.length,
    agentsSain: parEtat.sain,
    agentsContraints: parEtat.contraint,
    agentsCritiques: parEtat.critique,
    agentsDormants: parEtat.dormant,
    agentsMorts: parEtat.mort,
    agentsVivants: vivants,
    generationMaximale,
    cycleCourant: numeroCycleCourant,
    venTotale: serialiserMontantApi(venTotale),
    capitalLiquideTotal: serialiserMontantApi(capitalLiquideTotal),
    obligationsTotales: serialiserMontantApi(obligationsTotales),
    loyersCumulesVerses: serialiserMontantApi(loyersCumulesVerses),
    redevancesCumulees: serialiserMontantApi(redevancesCumulees),
  };
}

export function projeterTresorerie(
  tresorerie: TresorerieProprietaire,
): ProjectionTresorerie {
  return {
    revenusLoyers: serialiserMontantApi(tresorerie.revenusLoyers),
    revenusRedevances: serialiserMontantApi(tresorerie.revenusRedevances),
    depensesInfrastructure: serialiserMontantApi(
      tresorerie.depensesInfrastructure,
    ),
    soldeNet: serialiserMontantApi(calculerSoldeNetTresorerie(tresorerie)),
  };
}

export function projeterArbreGenealogique(
  agents: readonly AgentExperience[],
): ProjectionArbreGenealogique {
  const noeuds: NoeudArbreGenealogique[] = agents.map((agent) => ({
    identifiant: agent.identite.identifiant,
    generation: agent.identite.generation,
    identifiantParent: agent.identite.identifiantParent ?? null,
    etatSurvie: agent.etatEconomique.etatSurvie,
    valeurEconomiqueNette: serialiserMontantApi(
      calculerValeurEconomiqueNette(agent.etatEconomique),
    ),
  }));

  const relations: RelationArbreGenealogique[] = [];
  for (const agent of agents) {
    if (agent.identite.identifiantParent !== undefined) {
      relations.push({
        identifiantParent: agent.identite.identifiantParent,
        identifiantEnfant: agent.identite.identifiant,
      });
    }
  }

  const racines = agents
    .filter((agent) => agent.identite.identifiantParent === undefined)
    .map((agent) => agent.identite.identifiant);

  return {
    noeuds,
    relations,
    racines,
    reproductionActivee: false,
    message: "Reproduction non activée",
  };
}

function extraireMontantEvenement(
  evenement: {
    readonly type: string;
    readonly chargeUtile: Readonly<Record<string, unknown>>;
  },
): MontantApi | null {
  const brut = evenement.chargeUtile.montantMicroUsdc;
  if (typeof brut !== "string") {
    return null;
  }
  try {
    return serialiserMontantApi(lireMontantChargeUtile(evenement.chargeUtile, "montantMicroUsdc"));
  } catch {
    return null;
  }
}

function resumerEvenement(evenement: {
  readonly type: string;
  readonly chargeUtile: Readonly<Record<string, unknown>>;
}): string {
  if (evenement.type === "ETAT_SURVIE_MODIFIE") {
    const depuis = String(evenement.chargeUtile.depuis ?? "?");
    const vers = String(evenement.chargeUtile.vers ?? "?");
    return `${depuis} → ${vers}`;
  }
  if (evenement.type === "DEMANDE_INFERENCE_AUTORISEE") {
    return `modèle ${String(evenement.chargeUtile.modeleDemande ?? "?")}`;
  }
  if (evenement.type === "DEMANDE_INFERENCE_REFUSEE") {
    const motif = String(evenement.chargeUtile.motifRefus ?? "refus");
    if (motif === "authentification_invalide") {
      return "authentification refusée";
    }
    return motif;
  }
  if (evenement.type === "IDENTITE_AGENT_ENREGISTREE") {
    const emp = evenement.chargeUtile.empreinteClePublique;
    return `ed25519 · ${typeof emp === "string" ? `${emp.slice(0, 12)}…` : "?"}`;
  }
  if (evenement.type === "INFERENCE_EXECUTEE") {
    const jetonsEntree = evenement.chargeUtile.jetonsEntree;
    const jetonsSortie = evenement.chargeUtile.jetonsSortie;
    const cout = evenement.chargeUtile.coutFinalMicroUsdc;
    let coutAffiche = "";
    if (typeof cout === "string") {
      try {
        coutAffiche = ` · coût ${serialiserMontantApi(lireMontantChargeUtile(evenement.chargeUtile, "coutFinalMicroUsdc")).usdc} USDC`;
      } catch {
        coutAffiche = "";
      }
    }
    return `${String(jetonsEntree ?? "?")}+${String(jetonsSortie ?? "?")} jetons${coutAffiche}`;
  }
  const montant = extraireMontantEvenement(evenement);
  if (montant !== null) {
    const signe =
      evenement.type === "REVENU_ACTIVITE" ||
      evenement.type === "CAPITAL_INITIAL_ATTRIBUE"
        ? "+"
        : "-";
    return `${signe}${montant.usdc} USDC`;
  }
  return evenement.type;
}

export function projeterEvenement(
  evenement: {
    readonly identifiant: string;
    readonly type: string;
    readonly identifiantAgent?: string;
    readonly numeroCycle: number;
    readonly sequence: number;
    readonly chargeUtile: Readonly<Record<string, unknown>>;
    readonly dateEnregistrement?: string;
  },
): ProjectionEvenement {
  return {
    identifiant: evenement.identifiant,
    type: evenement.type,
    identifiantAgent: evenement.identifiantAgent ?? null,
    numeroCycle: evenement.numeroCycle,
    sequence: evenement.sequence,
    chargeUtile: evenement.chargeUtile,
    dateEnregistrement: evenement.dateEnregistrement ?? null,
    montant: extraireMontantEvenement(evenement),
    resume: resumerEvenement(evenement),
  };
}

/**
 * Reconstruit la trésorerie propriétaire exclusivement depuis les événements
 * d'encaissement / dépense réelle (jamais les dettes non réglées).
 */
export function reconstruireTresorerieProprietaire(
  evenements: readonly EvenementEconomique[],
): TresorerieProprietaire {
  const ordonnes = [...evenements].sort((a, b) => a.sequence - b.sequence);
  let tresorerie = creerTresorerieProprietaire();

  for (const evenement of ordonnes) {
    if (evenement.type === "LOYER_INFRASTRUCTURE_PAYE") {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      tresorerie = enregistrerLoyerEncaisse(tresorerie, montant);
    } else if (evenement.type === "REDEVANCE_PROPRIETAIRE_PAYEE") {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      tresorerie = enregistrerRedevanceEncaissee(tresorerie, montant);
    } else if (evenement.type === "DEPENSE_INFRASTRUCTURE_PROPRIETAIRE") {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      tresorerie = enregistrerDepenseInfrastructureProprietaire(
        tresorerie,
        montant,
      );
    } else if (evenement.type === "DETTE_REGLEE") {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      const motif = evenement.chargeUtile.motif;
      if (motif === "loyer_infrastructure") {
        tresorerie = enregistrerLoyerEncaisse(tresorerie, montant);
      } else if (motif === "redevance_proprietaire") {
        tresorerie = enregistrerRedevanceEncaissee(tresorerie, montant);
      }
    }
  }

  return tresorerie;
}

export function reconstruireIdentitesDepuisEvenements(
  evenements: readonly EvenementEconomique[],
): IdentiteAgentExperience[] {
  const parAgent = new Map<string, IdentiteAgentExperience>();

  const ordonnes = [...evenements].sort((a, b) => a.sequence - b.sequence);
  for (const evenement of ordonnes) {
    if (evenement.type !== "AGENT_CREE" || evenement.identifiantAgent === undefined) {
      continue;
    }
    const generationBrute = evenement.chargeUtile.generation;
    const indexBrut = evenement.chargeUtile.indexPopulation;
    const parentBrut = evenement.chargeUtile.identifiantParent;
    const generation =
      typeof generationBrute === "number" ? generationBrute : 0;
    const indexPopulation =
      typeof indexBrut === "number" ? indexBrut : parAgent.size;
    const dateNaissance =
      typeof evenement.chargeUtile.dateNaissance === "string"
        ? evenement.chargeUtile.dateNaissance
        : (evenement.dateEnregistrement ?? `cycle:${evenement.numeroCycle}`);

    const identite: IdentiteAgentExperience = {
      identifiant: evenement.identifiantAgent,
      generation,
      indexPopulation,
      cycleNaissance: evenement.numeroCycle,
      dateNaissance,
      ...(typeof parentBrut === "string"
        ? { identifiantParent: parentBrut }
        : {}),
    };
    parAgent.set(evenement.identifiantAgent, identite);
  }

  return [...parAgent.values()].sort(
    (a, b) => a.indexPopulation - b.indexPopulation,
  );
}

export function reconstruirePopulationDepuisEvenements(
  evenements: readonly EvenementEconomique[],
): AgentExperience[] {
  const identites = reconstruireIdentitesDepuisEvenements(evenements);
  return identites.map((identite) => ({
    identite,
    etatEconomique: reconstruireEtatEconomique(
      evenements,
      identite.identifiant,
    ),
  }));
}

/**
 * Construit l'historique VEN population / états / trésorerie par cycle
 * à partir des CYCLE_TERMINE et événements de trésorerie.
 */
export function reconstruireHistoriqueParCycle(
  evenements: readonly EvenementEconomique[],
  agentsFinaux: readonly AgentExperience[],
): PointHistoriqueVen[] {
  const cycles = new Set<number>();
  for (const evenement of evenements) {
    if (evenement.numeroCycle > 0) {
      cycles.add(evenement.numeroCycle);
    }
  }

  const cyclesOrdonnes = [...cycles].sort((a, b) => a - b);
  const points: PointHistoriqueVen[] = [];

  for (const numeroCycle of cyclesOrdonnes) {
    const evenementsJusqua = evenements.filter(
      (e) => e.numeroCycle <= numeroCycle,
    );
    const population = reconstruirePopulationDepuisEvenements(evenementsJusqua);
    const tresorerie = reconstruireTresorerieProprietaire(evenementsJusqua);
    const parEtat = compterParEtat(population);
    const capital = sommer(population, (e) => e.capitalLiquide);
    const obligations = sommer(population, (e) => e.obligationsDues);

    points.push({
      numeroCycle,
      venTotale: serialiserMontantApi(capital - obligations),
      populationParEtat: parEtat,
      tresorerieSoldeNet: serialiserMontantApi(
        calculerSoldeNetTresorerie(tresorerie),
      ),
    });
  }

  void agentsFinaux;
  return points;
}

export function agentVersIdentiteInitiale(
  agent: Agent,
  indexPopulation: number,
  cycleNaissance: number,
): IdentiteAgentExperience {
  return {
    identifiant: agent.identifiant,
    generation: agent.generation,
    indexPopulation,
    cycleNaissance,
    dateNaissance: agent.dateNaissance,
    ...(agent.identifiantParent !== undefined
      ? { identifiantParent: agent.identifiantParent }
      : {}),
  };
}

export function construireMapEnfants(
  agents: readonly AgentExperience[],
): Map<string, string[]> {
  const enfants = new Map<string, string[]>();
  for (const agent of agents) {
    const parent = agent.identite.identifiantParent;
    if (parent === undefined) {
      continue;
    }
    const liste = enfants.get(parent) ?? [];
    liste.push(agent.identite.identifiant);
    enfants.set(parent, liste);
  }
  return enfants;
}
