/**
 * Client HTTP de lecture — le dashboard n'écrit jamais dans SQLite
 * et ne recalcule pas les règles économiques.
 */

export type EtatConnexionApi = "connecte" | "deconnecte" | "chargement";

export interface MontantApi {
  readonly microUsdc: string;
  readonly usdc: string;
}

export interface ProjectionExperience {
  readonly identifiantExperience: string;
  readonly versionProtocole: string;
  readonly statut: string;
  readonly numeroCycleCourant: number;
  readonly dateCreation: string | null;
  readonly mode: string;
  readonly libelleMode: string;
  readonly graineSimulation: number;
  readonly taillePopulationInitiale: number;
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

export interface ProjectionAgent {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent: string | null;
  readonly cycleNaissance: number;
  readonly dateNaissance: string;
  readonly etatSurvie: string;
  readonly indexPopulation: number;
  readonly runway: number;
  readonly dernierCycleActif: number;
  readonly economie: {
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
  };
  readonly identifiantsEnfants: readonly string[];
  /** Identité cryptographique publique — jamais de clé privée. */
  readonly identite?: {
    readonly algorithme: "ed25519" | null;
    readonly empreinteClePublique: string | null;
    readonly clePubliqueAbregee: string | null;
    readonly clePubliqueBase64Url: string | null;
    readonly statut: "disponible" | "cle_privee_indisponible" | "non_configuree";
    readonly versionIdentite: string | null;
  };
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

export interface ProjectionTresorerie {
  readonly revenusLoyers: MontantApi;
  readonly revenusRedevances: MontantApi;
  readonly depensesInfrastructure: MontantApi;
  readonly soldeNet: MontantApi;
}

export interface ProjectionArbre {
  readonly noeuds: readonly {
    readonly identifiant: string;
    readonly generation: number;
    readonly identifiantParent: string | null;
    readonly etatSurvie: string;
    readonly valeurEconomiqueNette: MontantApi;
  }[];
  readonly relations: readonly {
    readonly identifiantParent: string;
    readonly identifiantEnfant: string;
  }[];
  readonly racines: readonly string[];
  readonly reproductionActivee: boolean;
  readonly message: string;
}

export interface PointHistorique {
  readonly numeroCycle: number;
  readonly venTotale: MontantApi;
  readonly populationParEtat: Readonly<Record<string, number>>;
  readonly tresorerieSoldeNet: MontantApi;
}

export interface ProjectionXwayGlobale {
  readonly active: boolean;
  readonly fournisseurSimule: boolean;
  readonly fournisseurReel: boolean;
  readonly selecteurFournisseur: "simule" | "openai";
  readonly libelleFournisseur: string;
  readonly banniereFournisseurReel: string | null;
  readonly demandesRecues: number;
  readonly demandesAutorisees: number;
  readonly demandesRefusees: number;
  readonly inferencesExecutees: number;
  readonly inferencesEchouees: number;
  readonly coutComputeCumule: MontantApi;
  readonly coutComputeCycleCourant: MontantApi;
  readonly coutFournisseurEstimeCumuleMicroUsd: string;
  readonly repartitionParModele: readonly {
    readonly modele: string;
    readonly executees: number;
    readonly refusees: number;
    readonly coutCumule: MontantApi;
  }[];
}

export interface ProjectionInferenceRecente {
  readonly numeroCycle: number;
  readonly modele: string | null;
  readonly jetonsEntree: number | null;
  readonly jetonsSortie: number | null;
  readonly coutImputeEsp: MontantApi | null;
  readonly coutFournisseurEstimeMicroUsd: string | null;
  readonly latenceMs: number | null;
  readonly statut: string;
  readonly propositionResume: string | null;
  readonly propositionAction: string | null;
  readonly propositionConfiance: number | null;
  readonly propositionValide: boolean | null;
}

export interface ProjectionXwayAgent {
  readonly identifiantAgent: string;
  readonly fournisseurSimule: boolean;
  readonly fournisseurReel: boolean;
  readonly selecteurFournisseur: "simule" | "openai";
  readonly libelleFournisseur: string;
  readonly nombreDemandes: number;
  readonly modelesUtilises: readonly string[];
  readonly inferencesRefusees: number;
  readonly inferencesExecutees: number;
  readonly jetonsEntreeCumules: number;
  readonly jetonsSortieCumules: number;
  readonly coutCumule: MontantApi;
  readonly coutFournisseurEstimeCumuleMicroUsd: string;
  readonly dernierAppel: {
    readonly numeroCycle: number;
    readonly type: string;
    readonly modele: string | null;
    readonly resume: string;
  } | null;
  readonly derniereInference: ProjectionInferenceRecente | null;
  readonly budgetCognitifDernierCycle: MontantApi | null;
}

export interface ProjectionDecisionAgent {
  readonly identifiantDecision: string;
  readonly identifiantObservation: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly observation: {
    readonly typeObservation: string;
    readonly probabiliteSuccesBps: number | null;
    readonly gainSiSucces: MontantApi | null;
    readonly perteSiEchec: MontantApi | null;
    readonly fraisAction: MontantApi | null;
    readonly description: string | null;
    readonly actionsAutorisees: readonly string[];
  };
  readonly choixCognitif: {
    readonly utiliserInference: boolean;
    readonly modeleLogique: string | null;
    readonly limiteDepense: MontantApi | null;
    readonly motif: string | null;
  } | null;
  readonly proposition: {
    readonly action: string;
    readonly confianceBps: number;
    readonly resume: string;
  } | null;
  readonly decision: {
    readonly action: string;
    readonly confianceBps: number;
    readonly resume: string;
    readonly sourceDecision: string;
    readonly modeleLogique: string | null;
    readonly statutValidation: string;
  } | null;
  readonly action: string | null;
  readonly resultat: {
    readonly issue: string;
    readonly revenuActivite: MontantApi;
    readonly perteActivite: MontantApi;
    readonly fraisExecution: MontantApi;
  } | null;
  readonly coutCognitif: MontantApi;
  readonly identifiantDemandeXway: string | null;
  readonly identifiantAction: string | null;
}

export interface ProjectionActiviteDecisionnelle {
  readonly decisions: number;
  readonly decisionsAvecInference: number;
  readonly decisionsSansInference: number;
  readonly actionsAgir: number;
  readonly actionsAttendre: number;
  readonly succes: number;
  readonly echecs: number;
  readonly computeCognitif: MontantApi;
  readonly revenusActivite: MontantApi;
  readonly pertesActivite: MontantApi;
  readonly coutCognitifParDecision: MontantApi | null;
  readonly resultatActiviteSurCoutCognitif: string | null;
  readonly cycleCourant: {
    readonly decisions: number;
    readonly pourcentAvecInference: number | null;
    readonly coutCognitif: MontantApi;
    readonly actionsAgir: number;
    readonly actionsAttendre: number;
    readonly succes: number;
    readonly echecs: number;
  };
}

export interface InstantaneEsp {
  readonly experience: ProjectionExperience;
  readonly population: ProjectionPopulation;
  readonly agents: readonly ProjectionAgent[];
  readonly arbre: ProjectionArbre;
  readonly tresorerie: ProjectionTresorerie;
  readonly activite: readonly ProjectionEvenement[];
  readonly historique: readonly PointHistorique[];
  readonly xway: ProjectionXwayGlobale;
  readonly activiteDecisionnelle: ProjectionActiviteDecisionnelle;
}

async function lireJson<T>(chemin: string, init?: RequestInit): Promise<T> {
  const reponse = await fetch(chemin, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!reponse.ok) {
    let detail = reponse.statusText;
    try {
      const corps = (await reponse.json()) as { erreur?: string };
      if (corps.erreur !== undefined) {
        detail = corps.erreur;
      }
    } catch {
      /* ignore */
    }
    throw new Error(`API ${String(reponse.status)} : ${detail}`);
  }
  return (await reponse.json()) as T;
}

export async function verifierSante(): Promise<boolean> {
  try {
    const sante = await lireJson<{ statut: string }>("/api/sante");
    return sante.statut === "ok";
  } catch {
    return false;
  }
}

export async function chargerInstantane(): Promise<InstantaneEsp> {
  const [
    experience,
    population,
    agentsCorps,
    arbre,
    tresorerie,
    activiteCorps,
    historiqueCorps,
    xway,
    activiteDecisionnelle,
  ] = await Promise.all([
    lireJson<ProjectionExperience>("/api/experience"),
    lireJson<ProjectionPopulation>("/api/population"),
    lireJson<{ agents: ProjectionAgent[] }>("/api/agents"),
    lireJson<ProjectionArbre>("/api/arbre-genealogique"),
    lireJson<ProjectionTresorerie>("/api/tresorerie"),
    lireJson<{ evenements: ProjectionEvenement[] }>("/api/activite-recente"),
    lireJson<{ points: PointHistorique[] }>("/api/historique"),
    lireJson<ProjectionXwayGlobale>("/api/xway"),
    lireJson<ProjectionActiviteDecisionnelle>("/api/activite-decisionnelle"),
  ]);

  return {
    experience,
    population,
    agents: agentsCorps.agents,
    arbre,
    tresorerie,
    activite: activiteCorps.evenements,
    historique: historiqueCorps.points,
    xway,
    activiteDecisionnelle,
  };
}

export async function avancerCycle(): Promise<void> {
  await lireJson("/api/experience/avancer", { method: "POST" });
}

export async function demarrerExperience(): Promise<void> {
  await lireJson("/api/experience/demarrer", { method: "POST" });
}

export async function pauseExperience(): Promise<void> {
  await lireJson("/api/experience/pause", { method: "POST" });
}

export async function chargerEvenementsAgent(
  identifiant: string,
): Promise<readonly ProjectionEvenement[]> {
  const corps = await lireJson<{ evenements: ProjectionEvenement[] }>(
    `/api/agents/${encodeURIComponent(identifiant)}/evenements`,
  );
  return corps.evenements;
}

export async function chargerXwayAgent(
  identifiant: string,
): Promise<ProjectionXwayAgent> {
  return lireJson<ProjectionXwayAgent>(
    `/api/agents/${encodeURIComponent(identifiant)}/xway`,
  );
}

export async function chargerDecisionsAgent(
  identifiant: string,
): Promise<readonly ProjectionDecisionAgent[]> {
  const corps = await lireJson<{
    decisions: ProjectionDecisionAgent[];
  }>(`/api/agents/${encodeURIComponent(identifiant)}/decisions`);
  return corps.decisions;
}
