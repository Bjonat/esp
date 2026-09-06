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
  creerEntreeIdentiteAgentEnregistree,
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
import {
  CHEMIN_KEYSTORE_IDENTITES_DEFAUT,
  KeystoreIdentitesLocal,
  SignataireAgentLocal,
  genererPaireIdentiteEd25519,
} from "@esp/moteur-agent";
import type {
  ConfigurationExperience,
  StatutExperience,
} from "./configuration-experience.js";
import { chargerConfigurationExperience } from "./configuration-experience.js";
import type { ConfigurationIdentiteJson } from "./configuration-identite.js";
import {
  parserConfigurationIdentite,
  serialiserConfigurationIdentite,
} from "./configuration-identite.js";
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
import type {
  IdentitePubliqueAgent,
  ProjectionIdentiteAgent,
} from "./projections-identite.js";
import {
  projeterIdentiteAgent,
  reconstruireIdentitesPubliques,
} from "./projections-identite.js";
import {
  IDENTIFIANT_SIMULATEUR_DEVELOPPEMENT,
  VERSION_SIMULATEUR_DEVELOPPEMENT,
  simulerActiviteCycle,
} from "./simulateur-developpement.js";
import type { ConfigurationXway, EtatPersistantDemandeXway, PasserelleXway } from "@esp/xway";
import {
  creerPasserelleXway,
  parserConfigurationXway,
  serialiserConfigurationXway,
  type ConfigurationXwayJson,
} from "@esp/xway";
import { executerCycleCognitifAgent } from "./cycle-xway.js";
import type {
  ProjectionXwayAgent,
  ProjectionXwayGlobale,
} from "./projections-xway.js";
import {
  projeterXwayAgent,
  projeterXwayGlobal,
  reconstruireEtatsDemandesDepuisRegistre,
} from "./projections-xway.js";

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
  /**
   * Répertoire local des clés privées d'identité (hors registre).
   * Défaut : data/developpement/identites
   */
  readonly cheminKeystoreIdentites?: string;
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
  configuration: ConfigurationExperience;
  readonly registre: RegistreEvenements;
  private readonly datesEvenementsFixes: string | undefined;
  private readonly cheminKeystoreIdentites: string;
  private readonly keystore: KeystoreIdentitesLocal;
  private statut: StatutExperience;
  private dateCreation: string | null;
  private numeroCycleCourant: number;
  private agents: AgentExperience[];
  private tresorerie: TresorerieProprietaire;
  private historique: PointHistoriqueVen[];
  private registreSqlite: RegistreEvenementsSqlite | undefined;
  private snapshotSimulateur: SnapshotCreationExperience["simulateur"];
  private passerelleXway: PasserelleXway | undefined;

  private constructor(options: {
    configuration: ConfigurationExperience;
    registre: RegistreEvenements;
    datesEvenementsFixes?: string;
    cheminKeystoreIdentites: string;
    keystore: KeystoreIdentitesLocal;
    statut: StatutExperience;
    dateCreation: string | null;
    numeroCycleCourant: number;
    agents: AgentExperience[];
    tresorerie: TresorerieProprietaire;
    historique: PointHistoriqueVen[];
    snapshotSimulateur: SnapshotCreationExperience["simulateur"];
    registreSqlite?: RegistreEvenementsSqlite;
    passerelleXway?: PasserelleXway;
  }) {
    this.configuration = options.configuration;
    this.registre = options.registre;
    this.datesEvenementsFixes = options.datesEvenementsFixes;
    this.cheminKeystoreIdentites = options.cheminKeystoreIdentites;
    this.keystore = options.keystore;
    this.statut = options.statut;
    this.dateCreation = options.dateCreation;
    this.numeroCycleCourant = options.numeroCycleCourant;
    this.agents = options.agents;
    this.tresorerie = options.tresorerie;
    this.historique = options.historique;
    this.snapshotSimulateur = options.snapshotSimulateur;
    this.registreSqlite = options.registreSqlite;
    this.passerelleXway = options.passerelleXway;
  }

  static ouvrir(options: OptionsControleurExperience): ControleurExperience {
    const { registre, registreSqlite } = ouvrirRegistre(options);
    const cheminKeystoreIdentites =
      options.cheminKeystoreIdentites ?? CHEMIN_KEYSTORE_IDENTITES_DEFAUT;

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
        cheminKeystoreIdentites,
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
      cheminKeystoreIdentites,
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
    cheminKeystoreIdentites?: string;
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
      ...(options.cheminKeystoreIdentites !== undefined
        ? { cheminKeystoreIdentites: options.cheminKeystoreIdentites }
        : {}),
    });
  }

  static depuisFichiers(options: {
    cheminConfiguration: string;
    cheminSqlite: string;
    cheminKeystoreIdentites?: string;
  }): ControleurExperience {
    const configuration = chargerConfigurationExperience(
      options.cheminConfiguration,
    );
    return ControleurExperience.ouvrir({
      configuration,
      cheminSqlite: options.cheminSqlite,
      ...(options.cheminKeystoreIdentites !== undefined
        ? { cheminKeystoreIdentites: options.cheminKeystoreIdentites }
        : {}),
    });
  }

  private static creerNouvelle(
    configuration: ConfigurationExperience,
    options: {
      registre: RegistreEvenements;
      registreSqlite?: RegistreEvenementsSqlite;
      cheminKeystoreIdentites: string;
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
    const xwaySerialise =
      configuration.xway !== undefined
        ? serialiserConfigurationXway(configuration.xway)
        : undefined;
    const identiteSerialisee =
      configuration.identite !== undefined
        ? serialiserConfigurationIdentite(configuration.identite)
        : undefined;
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
      ...(xwaySerialise !== undefined
        ? { xway: xwaySerialise as unknown as Readonly<Record<string, unknown>> }
        : {}),
      ...(identiteSerialisee !== undefined
        ? {
            identite:
              identiteSerialisee as unknown as Readonly<Record<string, unknown>>,
          }
        : {}),
    };

    const keystore = new KeystoreIdentitesLocal(options.cheminKeystoreIdentites);
    const passerelleXway = fabriquerPasserelle(configuration.xway, new Map(), {
      authentificationRequise: configuration.identite?.active === true,
      clesPubliquesParAgent: new Map(),
    });

    const controleur = new ControleurExperience({
      configuration,
      registre: options.registre,
      cheminKeystoreIdentites: options.cheminKeystoreIdentites,
      keystore,
      statut: "configuree",
      dateCreation,
      numeroCycleCourant: 0,
      agents: [],
      tresorerie: creerTresorerieProprietaire(),
      historique: [],
      snapshotSimulateur,
      ...(passerelleXway !== undefined ? { passerelleXway } : {}),
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
    controleur.rafraichirPasserelleXway(new Map());
    controleur.statut = "prete";
    return controleur;
  }

  private static reconstruireDepuisEvenements(
    evenements: readonly EvenementEsp[],
    options: {
      registre: RegistreEvenements;
      registreSqlite?: RegistreEvenementsSqlite;
      cheminKeystoreIdentites: string;
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
    const xway =
      snapshot.xway !== undefined
        ? parserConfigurationXway(snapshot.xway as unknown as ConfigurationXwayJson)
        : undefined;
    const identite =
      snapshot.identite !== undefined
        ? parserConfigurationIdentite(
            snapshot.identite as unknown as ConfigurationIdentiteJson,
          )
        : undefined;
    const configuration: ConfigurationExperience = {
      identifiantExperience: snapshot.identifiantExperience,
      versionProtocole: snapshot.versionProtocole,
      mode: snapshot.mode,
      graineSimulation: snapshot.graineSimulation,
      taillePopulationInitiale: snapshot.taillePopulationInitiale,
      capitalInitialParAgentMicroUsdc: snapshot.capitalInitialParAgentMicroUsdc,
      parametresEconomiques: snapshot.parametresEconomiques,
      ...(xway !== undefined ? { xway } : {}),
      ...(identite !== undefined ? { identite } : {}),
    };

    const economiques = filtrerEvenementsEconomiques(evenements);
    const agents = reconstruirePopulationDepuisEvenements(economiques);
    const tresorerie = reconstruireTresorerieProprietaire(economiques);
    const numeroCycleCourant = determinerCycleCourant(evenements);
    const historique = reconstruireHistoriqueParCycle(economiques, agents);
    const statut = reconstruireStatutExperience(evenements);
    const etatsDemandes = reconstruireEtatsDemandesDepuisRegistre(evenements);
    const identitesPubliques = reconstruireIdentitesPubliques(evenements);
    const keystore = new KeystoreIdentitesLocal(options.cheminKeystoreIdentites);
    const passerelleXway = fabriquerPasserelle(xway, etatsDemandes, {
      authentificationRequise: identite?.active === true,
      clesPubliquesParAgent: carteClesPubliques(identitesPubliques),
    });

    return new ControleurExperience({
      configuration,
      registre: options.registre,
      cheminKeystoreIdentites: options.cheminKeystoreIdentites,
      keystore,
      statut,
      dateCreation: snapshot.dateCreation,
      numeroCycleCourant,
      agents,
      tresorerie,
      historique,
      snapshotSimulateur: snapshot.simulateur,
      ...(passerelleXway !== undefined ? { passerelleXway } : {}),
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

  obtenirCheminKeystoreIdentites(): string {
    return this.cheminKeystoreIdentites;
  }

  obtenirSignataire(identifiantAgent: string): SignataireAgentLocal {
    const publique = this.obtenirIdentitesPubliques().get(identifiantAgent);
    return SignataireAgentLocal.depuisKeystore({
      keystore: this.keystore,
      identifiantExperience: this.configuration.identifiantExperience,
      identifiantAgent,
      clePubliqueEnregistreeBase64Url: publique?.clePubliqueBase64Url ?? null,
      identiteActive: this.configuration.identite?.active === true,
    });
  }

  obtenirIdentitesPubliques(): Map<string, IdentitePubliqueAgent> {
    return reconstruireIdentitesPubliques(
      this.registre.listerParExperience(
        this.configuration.identifiantExperience,
      ),
    );
  }

  projeterIdentiteAgent(identifiantAgent: string): ProjectionIdentiteAgent {
    return projeterIdentiteAgent({
      identifiantAgent,
      identitesPubliques: this.obtenirIdentitesPubliques(),
      statutSignataire: this.obtenirSignataire(identifiantAgent).statut,
    });
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

      const activiteEco = simulerActiviteCycle({
        graineSimulation: this.configuration.graineSimulation,
        identifiantAgent: agent.identite.identifiant,
        numeroCycle,
      });

      let coutComputeXway = 0n;
      if (
        this.configuration.xway?.active === true &&
        this.passerelleXway !== undefined
      ) {
        const resultatXway = executerCycleCognitifAgent({
          configurationXway: this.configuration.xway,
          passerelle: this.passerelleXway,
          agent,
          identifiantExperience: this.configuration.identifiantExperience,
          numeroCycle,
          graineSimulation: this.configuration.graineSimulation,
          prochaineSequence: () =>
            this.registre.consulterProchaineSequence(
              this.configuration.identifiantExperience,
            ),
          enregistrerImmediatement: (evenementsXway) => {
            this.enregistrerEvenements(evenementsXway);
          },
          ...(this.datesEvenementsFixes !== undefined
            ? { dateEnregistrement: this.datesEvenementsFixes }
            : {}),
          ...(this.configuration.identite?.active === true
            ? {
                signataire: this.obtenirSignataire(agent.identite.identifiant),
              }
            : {}),
        });
        // Les événements Xway sont déjà persistés (autorisation avant fournisseur).
        coutComputeXway = resultatXway.coutComputeXwayMicroUsdc;
      }

      const activite = {
        ...activiteEco,
        depenseCompute:
          this.configuration.xway?.active === true
            ? coutComputeXway
            : activiteEco.depenseCompute,
      };

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
    const xway =
      snapshot.xway !== undefined
        ? parserConfigurationXway(snapshot.xway as unknown as ConfigurationXwayJson)
        : undefined;
    const identite =
      snapshot.identite !== undefined
        ? parserConfigurationIdentite(
            snapshot.identite as unknown as ConfigurationIdentiteJson,
          )
        : undefined;
    this.configuration = {
      identifiantExperience: snapshot.identifiantExperience,
      versionProtocole: snapshot.versionProtocole,
      mode: snapshot.mode,
      graineSimulation: snapshot.graineSimulation,
      taillePopulationInitiale: snapshot.taillePopulationInitiale,
      capitalInitialParAgentMicroUsdc: snapshot.capitalInitialParAgentMicroUsdc,
      parametresEconomiques: snapshot.parametresEconomiques,
      ...(xway !== undefined ? { xway } : {}),
      ...(identite !== undefined ? { identite } : {}),
    };
    this.passerelleXway = fabriquerPasserelle(
      xway,
      reconstruireEtatsDemandesDepuisRegistre(evenements),
      {
        authentificationRequise: identite?.active === true,
        clesPubliquesParAgent: carteClesPubliques(
          reconstruireIdentitesPubliques(evenements),
        ),
      },
    );
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
      this.projeterAgentComplet(agent, enfants),
    );
  }

  projeterAgent(identifiant: string): ProjectionAgent | undefined {
    const agent = this.agents.find((a) => a.identite.identifiant === identifiant);
    if (agent === undefined) {
      return undefined;
    }
    return this.projeterAgentComplet(agent, construireMapEnfants(this.agents));
  }

  private projeterAgentComplet(
    agent: AgentExperience,
    enfants: ReadonlyMap<string, readonly string[]>,
  ): ProjectionAgent {
    const projectionIdentite =
      this.configuration.identite?.active === true
        ? this.projeterIdentiteAgent(agent.identite.identifiant)
        : undefined;
    return projeterAgent(
      agent,
      this.configuration.parametresEconomiques,
      enfants,
      projectionIdentite,
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
      "DEMANDE_INFERENCE_RECUE",
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

  projeterXway(): ProjectionXwayGlobale {
    return projeterXwayGlobal({
      evenements: this.registre.listerParExperience(
        this.configuration.identifiantExperience,
      ),
      numeroCycleCourant: this.numeroCycleCourant,
      active: this.configuration.xway?.active === true,
    });
  }

  projeterXwayAgent(identifiant: string): ProjectionXwayAgent | undefined {
    if (
      this.agents.find((a) => a.identite.identifiant === identifiant) ===
      undefined
    ) {
      return undefined;
    }
    return projeterXwayAgent({
      evenements: this.registre.listerParExperience(
        this.configuration.identifiantExperience,
      ),
      identifiantAgent: identifiant,
    });
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
      typesEvenements: evenements
        .filter((e) => e.type !== "IDENTITE_AGENT_ENREGISTREE")
        .map(
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

      if (this.configuration.identite?.active === true) {
        const paire = genererPaireIdentiteEd25519();
        const stockee = this.keystore.enregistrerClePrivee({
          identifiantExperience: this.configuration.identifiantExperience,
          identifiantAgent: identifiant,
          clePriveePkcs8Der: paire.clePriveePkcs8Der,
        });
        this.enregistrerEvenements([
          creerEntreeIdentiteAgentEnregistree({
            identifiantExperience: this.configuration.identifiantExperience,
            identifiantAgent: identifiant,
            clePubliqueBase64Url: stockee.clePubliqueBase64Url,
            empreinteClePublique: stockee.empreinteClePublique,
            versionIdentite: this.configuration.identite.version,
            indiceUnicite: this.registre.consulterProchaineSequence(
              this.configuration.identifiantExperience,
            ),
            numeroCycle: 0,
            ...(this.datesEvenementsFixes !== undefined
              ? { dateEnregistrement: this.datesEvenementsFixes }
              : { dateEnregistrement: dateNaissance }),
          }),
        ]);
      }

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

  private rafraichirPasserelleXway(
    etatsDemandes?: ReadonlyMap<string, EtatPersistantDemandeXway>,
  ): void {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    this.passerelleXway = fabriquerPasserelle(
      this.configuration.xway,
      etatsDemandes ?? reconstruireEtatsDemandesDepuisRegistre(evenements),
      {
        authentificationRequise: this.configuration.identite?.active === true,
        clesPubliquesParAgent: carteClesPubliques(
          reconstruireIdentitesPubliques(evenements),
        ),
      },
    );
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

function carteClesPubliques(
  identites: ReadonlyMap<string, IdentitePubliqueAgent>,
): Map<string, string> {
  const carte = new Map<string, string>();
  for (const [identifiant, identite] of identites) {
    carte.set(identifiant, identite.clePubliqueBase64Url);
  }
  return carte;
}

function fabriquerPasserelle(
  configuration: ConfigurationXway | undefined,
  etatsDemandes: ReadonlyMap<string, EtatPersistantDemandeXway>,
  options?: {
    authentificationRequise?: boolean;
    clesPubliquesParAgent?: ReadonlyMap<string, string>;
  },
): PasserelleXway | undefined {
  if (configuration === undefined || !configuration.active) {
    return undefined;
  }
  return creerPasserelleXway({
    configuration,
    etatsDemandes,
    ...(options?.authentificationRequise === true
      ? { authentificationRequise: true }
      : {}),
    ...(options?.clesPubliquesParAgent !== undefined
      ? { clesPubliquesParAgent: options.clesPubliquesParAgent }
      : {}),
  });
}

/** Alias historique pour compatibilité des imports existants. */
export function creerControleurExperience(
  options: OptionsControleurExperience,
): ControleurExperience {
  return ControleurExperience.ouvrir(options);
}
