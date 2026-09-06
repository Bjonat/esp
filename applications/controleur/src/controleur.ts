import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  EntreeEvenementEsp,
  EtatEconomiqueAgent,
  EvenementEsp,
  SnapshotCreationExperience,
  TresorerieProprietaire,
} from "@esp/protocole";
import {
  AgentMortInactifErreur,
  attribuerCapitalInitial,
  creerAgent,
  creerEntreeControleExperience,
  creerEntreeCycleExperienceAvance,
  creerEntreeExperienceCreee,
  creerTresorerieProprietaire,
  executerCycleEconomique,
  filtrerEvenementsEconomiques,
  parserSnapshotCreationExperience,
  reconstruireStatutExperience,
  serialiserMicroUsdc,
} from "@esp/protocole";
import type { RegistreEvenements } from "@esp/registre-evenements";
import {
  creerRegistreEvenementsMemoire,
  creerRegistreEvenementsSqlite,
  type RegistreEvenementsSqlite,
} from "@esp/registre-evenements";
import type {
  ConfigurationExperience,
  StatutExperience,
} from "./configuration-experience.js";
import { chargerConfigurationExperience } from "./configuration-experience.js";
import type {
  AgentExperience,
  PointHistoriqueVen,
  ProjectionAgent,
  ProjectionArbreGenealogique,
  ProjectionEvenement,
  ProjectionExperience,
  ProjectionPopulation,
  ProjectionTresorerie,
} from "./projections.js";
import {
  construireMapEnfants,
  projeterAgent,
  projeterArbreGenealogique,
  projeterEvenement,
  projeterPopulation,
  projeterTresorerie,
  reconstruireHistoriqueParCycle,
  reconstruirePopulationDepuisEvenements,
  reconstruireTresorerieProprietaire,
} from "./projections.js";
import {
  IDENTIFIANT_SIMULATEUR_DEVELOPPEMENT,
  VERSION_SIMULATEUR_DEVELOPPEMENT,
  simulerActiviteCycle,
} from "./simulateur-developpement.js";

export type OptionsControleurExperience = {
  /**
   * Configuration d'entrée pour CRÉER une nouvelle expérience.
   * Ignorée pour les paramètres historiques si l'expérience existe déjà dans le registre
   * (sauf pour localiser l'identifiantExperience).
   */
  readonly configuration?: ConfigurationExperience;
  readonly identifiantExperience?: string;
  readonly registre?: RegistreEvenements;
  readonly cheminSqlite?: string;
  /** Horodatage fixe pour tests déterministes (sinon ISO wall-clock informatif). */
  readonly dateCreationFixe?: string;
  readonly datesEvenementsFixes?: string;
};

export class ControleurExperienceErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControleurExperienceErreur";
  }
}

/**
 * Contrôleur d'expérience — SEUL écrivain de l'expérience.
 * Source de vérité : le registre (événements d'expérience + économiques).
 */
export class ControleurExperience {
  /** Snapshot historique figé à EXPERIENCE_CREEE — pas le JSON courant. */
  readonly configuration: ConfigurationExperience;
  readonly registre: RegistreEvenements;
  private readonly datesEvenementsFixes: string | undefined;
  private statut: StatutExperience;
  private dateCreation: string | null;
  private numeroCycleCourant: number;
  private agents: AgentExperience[];
  private tresorerie: TresorerieProprietaire;
  private historique: PointHistoriqueVen[];
  private registreSqlite: RegistreEvenementsSqlite | undefined;
  private snapshotSimulateur: SnapshotCreationExperience["simulateur"];

  private constructor(options: {
    configuration: ConfigurationExperience;
    registre: RegistreEvenements;
    datesEvenementsFixes?: string;
    statut: StatutExperience;
    dateCreation: string | null;
    numeroCycleCourant: number;
    agents: AgentExperience[];
    tresorerie: TresorerieProprietaire;
    historique: PointHistoriqueVen[];
    snapshotSimulateur: SnapshotCreationExperience["simulateur"];
    registreSqlite?: RegistreEvenementsSqlite;
  }) {
    this.configuration = options.configuration;
    this.registre = options.registre;
    this.datesEvenementsFixes = options.datesEvenementsFixes;
    this.statut = options.statut;
    this.dateCreation = options.dateCreation;
    this.numeroCycleCourant = options.numeroCycleCourant;
    this.agents = options.agents;
    this.tresorerie = options.tresorerie;
    this.historique = options.historique;
    this.snapshotSimulateur = options.snapshotSimulateur;
    this.registreSqlite = options.registreSqlite;
  }

  static ouvrir(options: OptionsControleurExperience): ControleurExperience {
    const { registre, registreSqlite } = ouvrirRegistre(options);

    const identifiant =
      options.identifiantExperience ??
      options.configuration?.identifiantExperience;
    if (identifiant === undefined || identifiant.trim() === "") {
      throw new ControleurExperienceErreur(
        "identifiantExperience requis (configuration ou option explicite)",
      );
    }

    const evenements = registre.listerParExperience(identifiant);

    if (evenements.length === 0) {
      if (options.configuration === undefined) {
        throw new ControleurExperienceErreur(
          `Aucune expérience « ${identifiant} » dans le registre et aucune configuration de création fournie`,
        );
      }
      if (options.configuration.identifiantExperience !== identifiant) {
        throw new ControleurExperienceErreur(
          "identifiantExperience incohérent entre options et configuration",
        );
      }
      return ControleurExperience.creerNouvelle(options.configuration, {
        registre,
        ...(registreSqlite !== undefined ? { registreSqlite } : {}),
        ...(options.dateCreationFixe !== undefined
          ? { dateCreationFixe: options.dateCreationFixe }
          : {}),
        ...(options.datesEvenementsFixes !== undefined
          ? { datesEvenementsFixes: options.datesEvenementsFixes }
          : {}),
      });
    }

    return ControleurExperience.reconstruireDepuisEvenements(evenements, {
      registre,
      ...(registreSqlite !== undefined ? { registreSqlite } : {}),
      ...(options.datesEvenementsFixes !== undefined
        ? { datesEvenementsFixes: options.datesEvenementsFixes }
        : {}),
    });
  }

  /**
   * Reprise depuis le registre seul — sans fichier JSON de configuration.
   */
  static ouvrirDepuisRegistre(options: {
    registre?: RegistreEvenements;
    cheminSqlite?: string;
    identifiantExperience: string;
    datesEvenementsFixes?: string;
  }): ControleurExperience {
    return ControleurExperience.ouvrir({
      identifiantExperience: options.identifiantExperience,
      ...(options.registre !== undefined ? { registre: options.registre } : {}),
      ...(options.cheminSqlite !== undefined
        ? { cheminSqlite: options.cheminSqlite }
        : {}),
      ...(options.datesEvenementsFixes !== undefined
        ? { datesEvenementsFixes: options.datesEvenementsFixes }
        : {}),
    });
  }

  static depuisFichiers(options: {
    cheminConfiguration: string;
    cheminSqlite: string;
  }): ControleurExperience {
    const configuration = chargerConfigurationExperience(
      options.cheminConfiguration,
    );
    return ControleurExperience.ouvrir({
      configuration,
      cheminSqlite: options.cheminSqlite,
    });
  }

  private static creerNouvelle(
    configuration: ConfigurationExperience,
    options: {
      registre: RegistreEvenements;
      registreSqlite?: RegistreEvenementsSqlite;
      dateCreationFixe?: string;
      datesEvenementsFixes?: string;
    },
  ): ControleurExperience {
    const dateCreation =
      options.dateCreationFixe ?? new Date().toISOString();
    const snapshotSimulateur = {
      identifiant: IDENTIFIANT_SIMULATEUR_DEVELOPPEMENT,
      version: VERSION_SIMULATEUR_DEVELOPPEMENT,
    };
    const snapshot: SnapshotCreationExperience = {
      identifiantExperience: configuration.identifiantExperience,
      versionProtocole: configuration.versionProtocole,
      mode: configuration.mode,
      graineSimulation: configuration.graineSimulation,
      taillePopulationInitiale: configuration.taillePopulationInitiale,
      capitalInitialParAgentMicroUsdc:
        configuration.capitalInitialParAgentMicroUsdc,
      parametresEconomiques: configuration.parametresEconomiques,
      simulateur: snapshotSimulateur,
      dateCreation,
    };

    const controleur = new ControleurExperience({
      configuration,
      registre: options.registre,
      statut: "configuree",
      dateCreation,
      numeroCycleCourant: 0,
      agents: [],
      tresorerie: creerTresorerieProprietaire(),
      historique: [],
      snapshotSimulateur,
      ...(options.datesEvenementsFixes !== undefined
        ? { datesEvenementsFixes: options.datesEvenementsFixes }
        : {}),
      ...(options.registreSqlite !== undefined
        ? { registreSqlite: options.registreSqlite }
        : {}),
    });

    controleur.enregistrerEvenements([
      creerEntreeExperienceCreee({
        snapshot,
        ...(options.datesEvenementsFixes !== undefined
          ? { dateEnregistrement: options.datesEvenementsFixes }
          : { dateEnregistrement: dateCreation }),
      }),
    ]);
    controleur.creerPopulationGenesis();
    controleur.statut = "prete";
    return controleur;
  }

  private static reconstruireDepuisEvenements(
    evenements: readonly EvenementEsp[],
    options: {
      registre: RegistreEvenements;
      registreSqlite?: RegistreEvenementsSqlite;
      datesEvenementsFixes?: string;
    },
  ): ControleurExperience {
    const creation = evenements.find((e) => e.type === "EXPERIENCE_CREEE");
    if (creation === undefined) {
      throw new ControleurExperienceErreur(
        "Registre d'expérience sans EXPERIENCE_CREEE — impossible de reconstruire",
      );
    }
    const snapshot = parserSnapshotCreationExperience(creation.chargeUtile);
    const configuration: ConfigurationExperience = {
      identifiantExperience: snapshot.identifiantExperience,
      versionProtocole: snapshot.versionProtocole,
      mode: snapshot.mode,
      graineSimulation: snapshot.graineSimulation,
      taillePopulationInitiale: snapshot.taillePopulationInitiale,
      capitalInitialParAgentMicroUsdc: snapshot.capitalInitialParAgentMicroUsdc,
      parametresEconomiques: snapshot.parametresEconomiques,
    };

    const economiques = filtrerEvenementsEconomiques(evenements);
    const agents = reconstruirePopulationDepuisEvenements(economiques);
    const tresorerie = reconstruireTresorerieProprietaire(economiques);
    const numeroCycleCourant = determinerCycleCourant(evenements);
    const historique = reconstruireHistoriqueParCycle(economiques, agents);
    const statut = reconstruireStatutExperience(evenements);

    return new ControleurExperience({
      configuration,
      registre: options.registre,
      statut,
      dateCreation: snapshot.dateCreation,
      numeroCycleCourant,
      agents,
      tresorerie,
      historique,
      snapshotSimulateur: snapshot.simulateur,
      ...(options.datesEvenementsFixes !== undefined
        ? { datesEvenementsFixes: options.datesEvenementsFixes }
        : {}),
      ...(options.registreSqlite !== undefined
        ? { registreSqlite: options.registreSqlite }
        : {}),
    });
  }

  obtenirStatut(): StatutExperience {
    return this.statut;
  }

  obtenirNumeroCycleCourant(): number {
    return this.numeroCycleCourant;
  }

  obtenirAgents(): readonly AgentExperience[] {
    return this.agents;
  }

  obtenirTresorerie(): TresorerieProprietaire {
    return this.tresorerie;
  }

  obtenirSnapshotSimulateur(): SnapshotCreationExperience["simulateur"] {
    return this.snapshotSimulateur;
  }

  private enregistrerControle(
    type: "EXPERIENCE_DEMARREE" | "EXPERIENCE_MISE_EN_PAUSE" | "EXPERIENCE_REPRISE" | "EXPERIENCE_TERMINEE",
  ): void {
    this.enregistrerEvenements([
      creerEntreeControleExperience({
        type,
        identifiantExperience: this.configuration.identifiantExperience,
        numeroCycle: this.numeroCycleCourant,
        indiceUnicite: this.registre.consulterProchaineSequence(
          this.configuration.identifiantExperience,
        ),
        ...(this.datesEvenementsFixes !== undefined
          ? { dateEnregistrement: this.datesEvenementsFixes }
          : {}),
      }),
    ]);
  }

  demarrer(): ProjectionExperience {
    if (this.statut === "terminee") {
      throw new ControleurExperienceErreur(
        "Impossible de démarrer une expérience terminée",
      );
    }
    if (this.statut === "en_cours") {
      return this.projeterExperience();
    }
    if (this.statut === "en_pause") {
      this.enregistrerControle("EXPERIENCE_REPRISE");
    } else {
      this.enregistrerControle("EXPERIENCE_DEMARREE");
    }
    this.statut = "en_cours";
    return this.projeterExperience();
  }

  mettreEnPause(): ProjectionExperience {
    if (this.statut !== "en_cours") {
      throw new ControleurExperienceErreur(
        "Seule une expérience en cours peut être mise en pause",
      );
    }
    this.enregistrerControle("EXPERIENCE_MISE_EN_PAUSE");
    this.statut = "en_pause";
    return this.projeterExperience();
  }

  /**
   * Avance l'expérience d'un cycle expérimental.
   * L'horloge wall-clock n'influence aucune règle économique.
   */
  avancerUnCycle(): {
    numeroCycle: number;
    population: ProjectionPopulation;
    experience: ProjectionExperience;
  } {
    if (this.statut === "terminee") {
      throw new ControleurExperienceErreur(
        "Expérience terminée — aucun cycle supplémentaire",
      );
    }
    if (this.statut === "configuree") {
      throw new ControleurExperienceErreur("Population non initialisée");
    }

    if (this.statut === "en_pause") {
      this.enregistrerControle("EXPERIENCE_REPRISE");
    } else if (this.statut === "prete") {
      this.enregistrerControle("EXPERIENCE_DEMARREE");
    }

    const numeroCycle = this.numeroCycleCourant + 1;

    this.enregistrerEvenements([
      creerEntreeCycleExperienceAvance({
        identifiantExperience: this.configuration.identifiantExperience,
        numeroCycle,
        ...(this.datesEvenementsFixes !== undefined
          ? { dateEnregistrement: this.datesEvenementsFixes }
          : {}),
      }),
    ]);

    const agentsApres: AgentExperience[] = [];
    let tresorerie = this.tresorerie;

    for (const agent of this.agents) {
      if (agent.etatEconomique.etatSurvie === "mort") {
        agentsApres.push(agent);
        continue;
      }

      const activite = simulerActiviteCycle({
        graineSimulation: this.configuration.graineSimulation,
        identifiantAgent: agent.identite.identifiant,
        numeroCycle,
      });

      let resultat;
      try {
        resultat = executerCycleEconomique({
          identifiantExperience: this.configuration.identifiantExperience,
          identifiantAgent: agent.identite.identifiant,
          numeroCycle,
          parametres: this.configuration.parametresEconomiques,
          etat: agent.etatEconomique,
          tresorerie,
          activite,
          prefixeIdentifiant: `${agent.identite.identifiant}-`,
          ...(this.datesEvenementsFixes !== undefined
            ? { dateEnregistrement: this.datesEvenementsFixes }
            : {}),
        });
      } catch (erreur) {
        if (erreur instanceof AgentMortInactifErreur) {
          agentsApres.push(agent);
          continue;
        }
        throw erreur;
      }

      this.enregistrerEvenements(resultat.evenements);
      tresorerie = resultat.tresorerie;
      agentsApres.push({
        identite: agent.identite,
        etatEconomique: resultat.etat,
      });
    }

    this.agents = agentsApres;
    this.tresorerie = tresorerie;
    this.numeroCycleCourant = numeroCycle;
    this.statut = "en_cours";
    this.historique = [
      ...this.historique,
      {
        numeroCycle,
        venTotale: projeterPopulation(
          this.agents,
          numeroCycle,
          this.tresorerie,
        ).venTotale,
        populationParEtat: {
          sain: this.agents.filter((a) => a.etatEconomique.etatSurvie === "sain")
            .length,
          contraint: this.agents.filter(
            (a) => a.etatEconomique.etatSurvie === "contraint",
          ).length,
          critique: this.agents.filter(
            (a) => a.etatEconomique.etatSurvie === "critique",
          ).length,
          dormant: this.agents.filter(
            (a) => a.etatEconomique.etatSurvie === "dormant",
          ).length,
          mort: this.agents.filter((a) => a.etatEconomique.etatSurvie === "mort")
            .length,
        },
        tresorerieSoldeNet: projeterTresorerie(this.tresorerie).soldeNet,
      },
    ];

    return {
      numeroCycle,
      population: this.projeterPopulation(),
      experience: this.projeterExperience(),
    };
  }

  reconstruireDepuisRegistre(): void {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    const creation = evenements.find((e) => e.type === "EXPERIENCE_CREEE");
    if (creation === undefined) {
      throw new ControleurExperienceErreur(
        "Registre d'expérience sans EXPERIENCE_CREEE — impossible de reconstruire",
      );
    }
    const snapshot = parserSnapshotCreationExperience(creation.chargeUtile);
    const economiques = filtrerEvenementsEconomiques(evenements);
    this.agents = reconstruirePopulationDepuisEvenements(economiques);
    this.tresorerie = reconstruireTresorerieProprietaire(economiques);
    this.numeroCycleCourant = determinerCycleCourant(evenements);
    this.historique = reconstruireHistoriqueParCycle(economiques, this.agents);
    this.statut = reconstruireStatutExperience(evenements);
    this.dateCreation = snapshot.dateCreation;
    this.snapshotSimulateur = snapshot.simulateur;
  }

  fermer(): void {
    this.registreSqlite?.fermer();
  }

  projeterExperience(): ProjectionExperience {
    const p = this.configuration.parametresEconomiques;
    return {
      identifiantExperience: this.configuration.identifiantExperience,
      versionProtocole: this.configuration.versionProtocole,
      statut: this.statut,
      numeroCycleCourant: this.numeroCycleCourant,
      dateCreation: this.dateCreation,
      mode: this.configuration.mode,
      libelleMode: "SIMULATION DÉTERMINISTE",
      graineSimulation: this.configuration.graineSimulation,
      taillePopulationInitiale: this.configuration.taillePopulationInitiale,
      parametresEconomiques: {
        version: p.version,
        loyerInfrastructureMicroUsdc: serialiserMicroUsdc(
          p.loyerInfrastructureMicroUsdc,
        ),
        periodeLoyerEnCycles: p.periodeLoyerEnCycles,
        tauxRedevanceProprietairePointsDeBase: serialiserMicroUsdc(
          p.tauxRedevanceProprietairePointsDeBase,
        ),
        coutOperationnelMinimalParCycleMicroUsdc: serialiserMicroUsdc(
          p.coutOperationnelMinimalParCycleMicroUsdc,
        ),
        seuilRunwaySainEnCycles: p.seuilRunwaySainEnCycles,
        seuilRunwayContraintEnCycles: p.seuilRunwayContraintEnCycles,
        cyclesDormanceAvantMort: p.cyclesDormanceAvantMort,
      },
    };
  }

  projeterPopulation(): ProjectionPopulation {
    return projeterPopulation(
      this.agents,
      this.numeroCycleCourant,
      this.tresorerie,
    );
  }

  projeterAgents(): ProjectionAgent[] {
    const enfants = construireMapEnfants(this.agents);
    return this.agents.map((agent) =>
      projeterAgent(agent, this.configuration.parametresEconomiques, enfants),
    );
  }

  projeterAgent(identifiant: string): ProjectionAgent | undefined {
    const agent = this.agents.find((a) => a.identite.identifiant === identifiant);
    if (agent === undefined) {
      return undefined;
    }
    return projeterAgent(
      agent,
      this.configuration.parametresEconomiques,
      construireMapEnfants(this.agents),
    );
  }

  projeterEvenementsAgent(identifiant: string): ProjectionEvenement[] {
    return this.registre
      .listerParAgent(identifiant)
      .filter(
        (e) =>
          e.identifiantExperience === this.configuration.identifiantExperience,
      )
      .map(projeterEvenement);
  }

  projeterActiviteRecente(limite = 40): ProjectionEvenement[] {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    const exclus = new Set([
      "CYCLE_DEMARRE",
      "CYCLE_TERMINE",
      "AGENT_CREE",
      "CAPITAL_INITIAL_ATTRIBUE",
      "EXPERIENCE_CREEE",
      "EXPERIENCE_DEMARREE",
      "EXPERIENCE_MISE_EN_PAUSE",
      "EXPERIENCE_REPRISE",
      "EXPERIENCE_TERMINEE",
      "CYCLE_EXPERIENCE_AVANCE",
    ]);
    const pertinents = evenements.filter((e) => !exclus.has(e.type));
    return pertinents.slice(-limite).reverse().map(projeterEvenement);
  }

  projeterArbre(): ProjectionArbreGenealogique {
    return projeterArbreGenealogique(this.agents);
  }

  projeterTresorerie(): ProjectionTresorerie {
    return projeterTresorerie(this.tresorerie);
  }

  projeterHistorique(): readonly PointHistoriqueVen[] {
    return this.historique;
  }

  capturerEmpreinteEconomique(): {
    numeroCycle: number;
    agents: Array<{
      identifiant: string;
      etat: EtatEconomiqueAgent;
    }>;
    tresorerie: TresorerieProprietaire;
    typesEvenements: string[];
  } {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    return {
      numeroCycle: this.numeroCycleCourant,
      agents: this.agents.map((a) => ({
        identifiant: a.identite.identifiant,
        etat: a.etatEconomique,
      })),
      tresorerie: this.tresorerie,
      typesEvenements: evenements.map(
        (e) =>
          `${e.type}:${e.identifiantAgent ?? "-"}:${e.numeroCycle}:${JSON.stringify(e.chargeUtile)}`,
      ),
    };
  }

  private creerPopulationGenesis(): void {
    const n = this.configuration.taillePopulationInitiale;
    const agents: AgentExperience[] = [];
    const dateNaissance =
      this.datesEvenementsFixes ??
      this.dateCreation ??
      "1970-01-01T00:00:00.000Z";

    for (let index = 0; index < n; index += 1) {
      const identifiant = fabriquerIdentifiantAgent(
        this.configuration.identifiantExperience,
        index,
      );
      const agent = creerAgent({
        identifiant,
        generation: 0,
        dateNaissance,
        etatSurvie: "sain",
      });

      const { etat, evenements } = attribuerCapitalInitial({
        identifiantExperience: this.configuration.identifiantExperience,
        identifiantAgent: identifiant,
        montant: this.configuration.capitalInitialParAgentMicroUsdc,
        numeroCycle: 0,
        prefixeIdentifiant: `${identifiant}-`,
        naissance: {
          generation: 0,
          indexPopulation: index,
          dateNaissance,
        },
        ...(this.datesEvenementsFixes !== undefined
          ? { dateEnregistrement: this.datesEvenementsFixes }
          : { dateEnregistrement: dateNaissance }),
      });

      this.enregistrerEvenements(evenements);
      agents.push({
        identite: {
          identifiant: agent.identifiant,
          generation: 0,
          indexPopulation: index,
          cycleNaissance: 0,
          dateNaissance,
        },
        etatEconomique: etat,
      });
    }

    this.agents = agents;
  }

  private enregistrerEvenements(
    evenements: readonly EntreeEvenementEsp[],
  ): void {
    for (const entree of evenements) {
      this.registre.ajouter(entree);
    }
  }
}

function ouvrirRegistre(options: OptionsControleurExperience): {
  registre: RegistreEvenements;
  registreSqlite?: RegistreEvenementsSqlite;
} {
  if (options.registre !== undefined) {
    return { registre: options.registre };
  }
  if (options.cheminSqlite !== undefined) {
    mkdirSync(dirname(options.cheminSqlite), { recursive: true });
    const registreSqlite = creerRegistreEvenementsSqlite(options.cheminSqlite);
    return { registre: registreSqlite, registreSqlite };
  }
  return { registre: creerRegistreEvenementsMemoire() };
}

function fabriquerIdentifiantAgent(
  identifiantExperience: string,
  index: number,
): string {
  const suffixe = String(index).padStart(3, "0");
  return `${identifiantExperience}-agent-${suffixe}`;
}

/**
 * Cycle courant = max(numeroCycle) sur tout le registre.
 * Une seule règle — pas de comptabilité parallèle contradictoire.
 */
function determinerCycleCourant(evenements: readonly EvenementEsp[]): number {
  let max = 0;
  for (const evenement of evenements) {
    if (evenement.numeroCycle > max) {
      max = evenement.numeroCycle;
    }
  }
  return max;
}

/** Alias historique pour compatibilité des imports existants. */
export function creerControleurExperience(
  options: OptionsControleurExperience,
): ControleurExperience {
  return ControleurExperience.ouvrir(options);
}
