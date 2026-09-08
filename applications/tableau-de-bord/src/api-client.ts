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

export interface ProjectionGeneNumeriqueMicroUsdc {
  readonly cle: string;
  readonly type: "micro_usdc";
  readonly min: string | null;
  readonly mediane: string | null;
  readonly max: string | null;
}

export interface ProjectionGeneNumeriqueBps {
  readonly cle: string;
  readonly type: "bps";
  readonly min: number | null;
  readonly mediane: number | null;
  readonly max: number | null;
}

export interface ProjectionGeneCategoriel {
  readonly cle: string;
  readonly type: "categoriel";
  readonly comptesParValeur: Readonly<Record<string, number>>;
}

export type ProjectionGeneDiversite =
  | ProjectionGeneNumeriqueMicroUsdc
  | ProjectionGeneNumeriqueBps
  | ProjectionGeneCategoriel;

export interface ProjectionDiversiteHeritablePopulation {
  readonly avertissement: string;
  readonly versionCatalogueGenes: string;
  readonly cycleCourant: number;
  readonly nombreConfigurationsHeritablesDistinctes: number;
  readonly nombreMutationsCumulees: number;
  readonly nombreMutationsCycle: number;
  readonly nombreAgentsAvecAuMoinsUneMutationDepuisParent: number;
  readonly genes: readonly ProjectionGeneDiversite[];
}

export interface ProjectionLigneeEvolutive {
  readonly identifiantLignee: string;
  readonly membresCumules: number;
  readonly membresVivants: number;
  readonly naissancesCumulees: number;
  readonly partPopulationVivanteBps: number;
}

export interface ProjectionFrequenceGenotype {
  readonly empreinteConfiguration: string;
  readonly agentsVivants: number;
  readonly agentsCumules: number;
  readonly partPopulationVivanteBps: number;
}

/** Dynamique évolutive — descriptive, sans ranking fitness. */
export interface ProjectionDynamiqueEvolutive {
  readonly populationActuelle: number;
  readonly naissancesCycle: number;
  readonly generationsPresentes: readonly number[];
  readonly ligneesVivantes: number;
  readonly candidatsReproduction: number;
  readonly reproductionsAutorisees: number;
  readonly refusEconomiques: number;
  readonly refusCapacite: number;
  readonly configurationsHeritablesDistinctes: number;
  readonly lignees: readonly ProjectionLigneeEvolutive[];
  readonly frequencesGenotypes: readonly ProjectionFrequenceGenotype[];
  readonly genes: readonly ProjectionGeneDiversite[];
  readonly avertissement: string;
}

/** Succès reproductif agent — descriptif, pas une fitness. */
export interface ProjectionSuccesReproductifAgent {
  readonly nombreEnfants: number;
  readonly nombreDescendantsDirects: number;
  readonly nombreDescendantsTotaux: number;
  readonly agePremiereReproduction: number | null;
  readonly intervalleMoyenReproductions: number | null;
  readonly eligibleReproduction: boolean | null;
  readonly motifNonEligibilite: string | null;
  readonly coutNecessaireMicroUsdc: string;
  readonly reserveApresReproductionMicroUsdc: string | null;
  readonly dernierCycleReproduction: number | null;
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
  readonly naissancesCumulees?: number;
  readonly naissancesCycle?: number;
  readonly nombreLigneesVivantes?: number;
  readonly ligneesVivantes?: number;
  readonly taillePopulationActuelle?: number;
  readonly dotationsInternesCumulees?: MontantApi;
  readonly coutsReproductifsCumules?: MontantApi;
  readonly generationsPresentes?: readonly number[];
  readonly diversiteHeritable?: ProjectionDiversiteHeritablePopulation;
  readonly dynamiqueEvolutive?: ProjectionDynamiqueEvolutive;
}

export interface ProjectionAgent {
  readonly identifiant: string;
  readonly generation: number;
  readonly identifiantParent: string | null;
  readonly identifiantLignee?: string;
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
  readonly configurationHeritable?: {
    readonly version: string;
    readonly parametres: Readonly<Record<string, string | number | boolean>>;
  };
  readonly reproduction?: {
    readonly reproductionsDemandees: number;
    readonly reproductionsAutorisees: number;
    readonly reproductionsRefusees: number;
    readonly reproductionsTerminees: number;
    readonly dotationsCumulees: MontantApi;
    readonly coutsReproductifsCumules: MontantApi;
    readonly nombreEnfants: number;
    readonly refusParMotif: Readonly<Record<string, number>>;
  };
  /** Héritage / variation — descriptif, aucune sélection. */
  readonly heritageVariation?: ProjectionHeritageVariationAgent;
  /** Succès reproductif — descriptif, pas une fitness. */
  readonly succesReproductif?: ProjectionSuccesReproductifAgent;
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

export interface ProjectionMutationNaissance {
  readonly cleGene: string;
  readonly valeurParent: string | number | boolean;
  readonly valeurEnfant: string | number | boolean;
  readonly operateur: string;
  readonly versionMutation: string;
  readonly identifiantReproduction: string;
}

export interface ProjectionDifferenceGene {
  readonly cle: string;
  readonly parent: string;
  readonly enfant: string;
}

export interface ProjectionHeritageVariationAgent {
  readonly avertissement: string;
  readonly identifiantParent: string | null;
  readonly empreinteConfiguration: string;
  readonly configurationHeritable: {
    readonly version: string;
    readonly parametres: Readonly<Record<string, string | number | boolean>>;
  };
  readonly differencesAvecParent: readonly ProjectionDifferenceGene[] | null;
  readonly mutationsALaNaissance: readonly ProjectionMutationNaissance[];
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
  readonly revenusCoutsReproduction?: MontantApi;
  readonly depensesInfrastructure: MontantApi;
  readonly soldeNet: MontantApi;
}

export interface ProjectionArbre {
  readonly noeuds: readonly {
    readonly identifiant: string;
    readonly generation: number;
    readonly identifiantParent: string | null;
    readonly identifiantLignee?: string;
    readonly etatSurvie: string;
    readonly valeurEconomiqueNette: MontantApi;
    readonly nombreMutationsNaissance: number;
    readonly empreinteConfiguration: string;
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

/** EV / regret exact (rationnel) + approximation affichage. */
export interface ValeurAttendueExacteApi {
  readonly numerateurMicroUsdcBps: string;
  readonly denominateurBps: number;
  readonly microUsdcArrondiAffichage: MontantApi;
}

export interface ProjectionFitnessAgent {
  readonly versionMesuresFitness: string;
  readonly identifiantAgent: string;
  readonly avertissement: string;
  readonly economie: {
    readonly venDebut: MontantApi;
    readonly venFin: MontantApi;
    readonly variationVen: MontantApi;
    readonly capitalLiquideFin: MontantApi;
    readonly obligationsFin: MontantApi;
    readonly capitalisationExogene: MontantApi;
    readonly variationVenNeutraliseeExogenes: MontantApi;
    readonly resultatActiviteBrut: MontantApi;
    readonly resultatOperationnelAvantContrat: MontantApi;
    readonly resultatApresContrat: MontantApi;
    readonly depensesCompute: MontantApi;
    readonly loyersPayes: MontantApi;
    readonly redevancesProprietairePayees: MontantApi;
  };
  readonly decision: {
    readonly nombreDecisions: number;
    readonly nombreDecisionsAvecInference: number;
    readonly nombreDecisionsSansInference: number;
    readonly nombreActionsAgir: number;
    readonly nombreActionsAttendre: number;
    readonly nombreDecisionsOptimalesExAnte: number;
    readonly tauxDecisionsOptimalesExAnteBps: number | null;
    readonly regretExAnteCumule: ValeurAttendueExacteApi;
    readonly nombreSuccesRealises: number;
    readonly nombreEchecsRealises: number;
    readonly resultatActiviteRealise: MontantApi;
    readonly tauxOptimalesAvecInferenceBps: number | null;
    readonly tauxOptimalesSansInferenceBps: number | null;
  };
  readonly cognition: {
    readonly nombreDemandesInference: number;
    readonly nombreInferencesExecutees: number;
    readonly nombreRefusXway: number;
    readonly coutCognitifTotal: MontantApi;
    readonly ratioResultatOperationnelSurCoutCognitif: {
      readonly numerateur: MontantApi;
      readonly denominateur: MontantApi;
      readonly quotientEchelleMillion: string | null;
      readonly note: string;
    } | null;
  };
  readonly risque: {
    readonly picVen: MontantApi;
    readonly drawdownMax: MontantApi;
    readonly drawdownMaxBps: number | null;
    readonly cycleDuDrawdownMax: number | null;
    readonly runwayMinimumObserve: number | null;
  };
  readonly survie: {
    readonly cycleNaissance: number;
    readonly cyclesVecus: number;
    readonly etatCourant: string;
    readonly cycleMort: number | null;
    readonly causeMort: string | null;
  };
  readonly resilience: {
    readonly nombreCyclesSain: number;
    readonly nombreCyclesContraint: number;
    readonly nombreCyclesCritique: number;
    readonly nombreCyclesDormant: number;
    readonly nombreTransitionsEtat: number;
    readonly nombrePassagesCritiqueVersSain: number;
  };
  readonly contribution: {
    readonly loyersPayes: MontantApi;
    readonly redevancesPayees: MontantApi;
    readonly contributionProprietaireTotale: MontantApi;
  };
}

export interface ProjectionLigneFitnessPopulation {
  readonly identifiantAgent: string;
  readonly etatSurvie: string;
  readonly venFin: MontantApi;
  readonly resultatApresContrat: MontantApi;
  readonly depensesCompute: MontantApi;
  readonly tauxDecisionsOptimalesExAnteBps: number | null;
  readonly regretExAnteCumule: ValeurAttendueExacteApi;
  readonly drawdownMax: MontantApi;
  readonly runwayMinimumObserve: number | null;
  readonly contributionProprietaire: MontantApi;
}

export interface ProjectionFitnessPopulation {
  readonly versionMesuresFitness: string;
  readonly avertissement: string;
  readonly agents: readonly ProjectionLigneFitnessPopulation[];
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

export async function chargerFitnessAgent(
  identifiant: string,
): Promise<ProjectionFitnessAgent> {
  return lireJson<ProjectionFitnessAgent>(
    `/api/agents/${encodeURIComponent(identifiant)}/fitness`,
  );
}

export async function chargerFitnessPopulation(): Promise<ProjectionFitnessPopulation> {
  return lireJson<ProjectionFitnessPopulation>("/api/fitness");
}
