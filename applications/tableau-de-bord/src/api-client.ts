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

export interface InstantaneEsp {
  readonly experience: ProjectionExperience;
  readonly population: ProjectionPopulation;
  readonly agents: readonly ProjectionAgent[];
  readonly arbre: ProjectionArbre;
  readonly tresorerie: ProjectionTresorerie;
  readonly activite: readonly ProjectionEvenement[];
  readonly historique: readonly PointHistorique[];
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
  ] = await Promise.all([
    lireJson<ProjectionExperience>("/api/experience"),
    lireJson<ProjectionPopulation>("/api/population"),
    lireJson<{ agents: ProjectionAgent[] }>("/api/agents"),
    lireJson<ProjectionArbre>("/api/arbre-genealogique"),
    lireJson<ProjectionTresorerie>("/api/tresorerie"),
    lireJson<{ evenements: ProjectionEvenement[] }>("/api/activite-recente"),
    lireJson<{ points: PointHistorique[] }>("/api/historique"),
  ]);

  return {
    experience,
    population,
    agents: agentsCorps.agents,
    arbre,
    tresorerie,
    activite: activiteCorps.evenements,
    historique: historiqueCorps.points,
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
