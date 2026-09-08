import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  DecisionAgent,
  EntreeEvenementEsp,
  EtatEconomiqueAgent,
  EvenementEsp,
  ObservationOpportunite,
  SnapshotCreationExperience,
  TresorerieProprietaire,
} from "@esp/protocole";
import {
  AgentMortInactifErreur,
  analyserExecutionEconomique,
  attribuerCapitalInitial,
  assertDemandesXwayNonDejaAttribuees,
  calculerRunwayEnCycles,
  calculerValeurEconomiqueNette,
  construireChargeDepenseCompute,
  creerAgent,
  creerEntreeControleExperience,
  creerEntreeCycleExperienceAvance,
  creerEntreeExperienceCreee,
  creerEntreeIdentiteAgentEnregistree,
  creerTresorerieProprietaire,
  executerCycleEconomique,
  fabriquerIdentifiantExecutionEconomique,
  filtrerEvenementsEconomiques,
  parserSnapshotCreationExperience,
  reconstruireStatutExperience,
  serialiserMicroUsdc,
  trouverAttributionsPourDemande,
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
  calculerEnjeuOpportunite,
  deciderBudgetCognitif,
  genererPaireIdentiteEd25519,
  parserConfigurationPolitiqueBudgetCognitif,
  serialiserConfigurationPolitiqueBudgetCognitif,
  type ConfigurationPolitiqueBudgetCognitif,
  type ConfigurationPolitiqueBudgetCognitifJson,
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
import type {
  ConfigurationXway,
  EtatPersistantDemandeXway,
  FournisseurInference,
  PasserelleXway,
} from "@esp/xway";
import {
  creerPasserelleXway,
  parserConfigurationXway,
  serialiserConfigurationXway,
  type ConfigurationXwayJson,
} from "@esp/xway";
import { executerCycleCognitifAgent } from "./cycle-xway.js";
import { fabriquerFournisseurInference } from "./fabriquer-fournisseur.js";
import {
  executerInferenceTestVolontaire,
  calculerApercuInferenceTest,
  montantDepenseComputeDepuisTest,
  type ApercuInferenceTest,
  type AuditRegistreInferenceTest,
  type ResultatInferenceTest,
} from "./inference-test.js";
import { executerCycleDecisionAgent } from "./cycle-decision.js";
import { reconstruireEtatRepriseCycleDecision } from "./reprise-cycle-decision.js";
import type {
  ProjectionActiviteDecisionnelle,
  ProjectionDecisionAgent,
  ProjectionDecisionAgentResume,
} from "./projections-decision.js";
import {
  projeterActiviteDecisionnelle as calculerActiviteDecisionnelle,
  projeterDecisionsDepuisRegistre,
  projeterResumeDecisionAgent as calculerResumeDecisionAgent,
} from "./projections-decision.js";
import type {
  ProjectionFitnessAgent,
  ProjectionFitnessPopulation,
} from "./projections-fitness.js";
import {
  calculerEtProjeterFitnessAgent,
  projeterFitnessPopulation,
} from "./projections-fitness.js";
import type { FenetreEvaluation } from "@esp/protocole";
import type {
  ProjectionXwayAgent,
  ProjectionXwayGlobale,
} from "./projections-xway.js";
import {
  projeterXwayAgent,
  projeterXwayGlobal,
  reconstruireEtatsDemandesDepuisRegistre,
} from "./projections-xway.js";
import {
  projeterCoutsInfrastructureExterne,
  reconstruireEtatPlafondFournisseur,
  type ProjectionCoutsInfrastructureExterne,
} from "./projections-infrastructure-externe.js";
import type { EnvironnementOpportunitesSimulees } from "@esp/environnement";
import {
  IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES,
  VERSION_ENVIRONNEMENT_OPPORTUNITES_SIMULEES,
  creerEnvironnementOpportunitesSimulees,
  parserConfigurationEnvironnementOpportunites,
  serialiserConfigurationEnvironnementOpportunites,
  type ConfigurationEnvironnementOpportunitesJson,
} from "@esp/environnement";

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
  /** Injection tests — faux fournisseur (aucun réseau). */
  readonly fournisseurInjecte?: FournisseurInference;
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
  private readonly fournisseurInjecte: FournisseurInference | undefined;
  private environnementDecision: EnvironnementOpportunitesSimulees | undefined;
  private politiqueBudgetCognitif:
    | ConfigurationPolitiqueBudgetCognitif
    | undefined;

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
    fournisseurInjecte?: FournisseurInference;
    environnementDecision?: EnvironnementOpportunitesSimulees;
    politiqueBudgetCognitif?: ConfigurationPolitiqueBudgetCognitif;
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
    this.fournisseurInjecte = options.fournisseurInjecte;
    this.environnementDecision = options.environnementDecision;
    this.politiqueBudgetCognitif = options.politiqueBudgetCognitif;
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
        ...(options.fournisseurInjecte !== undefined
          ? { fournisseurInjecte: options.fournisseurInjecte }
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
      ...(options.fournisseurInjecte !== undefined
        ? { fournisseurInjecte: options.fournisseurInjecte }
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
    fournisseurInjecte?: FournisseurInference;
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
      ...(options.fournisseurInjecte !== undefined
        ? { fournisseurInjecte: options.fournisseurInjecte }
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
      fournisseurInjecte?: FournisseurInference;
    },
  ): ControleurExperience {
    const dateCreation =
      options.dateCreationFixe ?? new Date().toISOString();
    const snapshotSimulateur =
      configuration.mode === "decision_simulee"
        ? {
            identifiant: IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES,
            version: VERSION_ENVIRONNEMENT_OPPORTUNITES_SIMULEES,
          }
        : {
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
    const environnementSerialise =
      configuration.environnementDecision !== undefined
        ? serialiserConfigurationEnvironnementOpportunites(
            configuration.environnementDecision,
          )
        : undefined;
    const politiqueSerialisee =
      configuration.politiqueBudgetCognitif !== undefined
        ? serialiserConfigurationPolitiqueBudgetCognitif(
            configuration.politiqueBudgetCognitif,
          )
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
      ...(environnementSerialise !== undefined
        ? {
            environnementDecision:
              environnementSerialise as unknown as Readonly<
                Record<string, unknown>
              >,
          }
        : {}),
      ...(politiqueSerialisee !== undefined
        ? {
            politiqueBudgetCognitif:
              politiqueSerialisee as unknown as Readonly<
                Record<string, unknown>
              >,
          }
        : {}),
    };

    const keystore = new KeystoreIdentitesLocal(options.cheminKeystoreIdentites);
    const passerelleXway = fabriquerPasserelle(configuration.xway, new Map(), {
      authentificationRequise: configuration.identite?.active === true,
      clesPubliquesParAgent: new Map(),
      ...(options.fournisseurInjecte !== undefined
        ? { fournisseurInjecte: options.fournisseurInjecte }
        : {}),
    });
    const environnementDecision =
      configuration.environnementDecision !== undefined
        ? creerEnvironnementOpportunitesSimulees(
            configuration.environnementDecision,
            configuration.graineSimulation,
          )
        : undefined;

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
      ...(environnementDecision !== undefined ? { environnementDecision } : {}),
      ...(configuration.politiqueBudgetCognitif !== undefined
        ? { politiqueBudgetCognitif: configuration.politiqueBudgetCognitif }
        : {}),
      ...(options.datesEvenementsFixes !== undefined
        ? { datesEvenementsFixes: options.datesEvenementsFixes }
        : {}),
      ...(options.registreSqlite !== undefined
        ? { registreSqlite: options.registreSqlite }
        : {}),
      ...(options.fournisseurInjecte !== undefined
        ? { fournisseurInjecte: options.fournisseurInjecte }
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
      fournisseurInjecte?: FournisseurInference;
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
    const environnementDecisionConfig =
      snapshot.environnementDecision !== undefined
        ? parserConfigurationEnvironnementOpportunites(
            snapshot.environnementDecision as unknown as ConfigurationEnvironnementOpportunitesJson,
          )
        : undefined;
    const politiqueBudgetCognitif =
      snapshot.politiqueBudgetCognitif !== undefined
        ? parserConfigurationPolitiqueBudgetCognitif(
            snapshot.politiqueBudgetCognitif as unknown as ConfigurationPolitiqueBudgetCognitifJson,
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
      ...(environnementDecisionConfig !== undefined
        ? { environnementDecision: environnementDecisionConfig }
        : {}),
      ...(politiqueBudgetCognitif !== undefined
        ? { politiqueBudgetCognitif }
        : {}),
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
      etatPlafondFournisseur: reconstruireEtatPlafondFournisseur(evenements),
      ...(options.fournisseurInjecte !== undefined
        ? { fournisseurInjecte: options.fournisseurInjecte }
        : {}),
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
      ...(environnementDecisionConfig !== undefined
        ? {
            environnementDecision: creerEnvironnementOpportunitesSimulees(
              environnementDecisionConfig,
              snapshot.graineSimulation,
            ),
          }
        : {}),
      ...(politiqueBudgetCognitif !== undefined
        ? { politiqueBudgetCognitif }
        : {}),
      ...(options.datesEvenementsFixes !== undefined
        ? { datesEvenementsFixes: options.datesEvenementsFixes }
        : {}),
      ...(options.registreSqlite !== undefined
        ? { registreSqlite: options.registreSqlite }
        : {}),
      ...(options.fournisseurInjecte !== undefined
        ? { fournisseurInjecte: options.fournisseurInjecte }
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
   *
   * Si un cycle N a déjà CYCLE_EXPERIENCE_AVANCE mais qu'au moins un agent
   * vivant n'a pas CYCLE_TERMINE, reprend N (pas N+1).
   *
   * Si fournisseur=openai : aucune inférence réelle automatique
   * (commande volontaire /inference-test uniquement).
   */
  async avancerUnCycle(): Promise<{
    numeroCycle: number;
    population: ProjectionPopulation;
    experience: ProjectionExperience;
  }> {
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

    const evenementsRegistre = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    const cycleAReprendre = detecterCycleEconomiqueIncomplet({
      evenements: evenementsRegistre,
      identifiantExperience: this.configuration.identifiantExperience,
      agents: this.agents,
    });
    const repriseCycleIncomplet = cycleAReprendre !== undefined;
    const numeroCycle = repriseCycleIncomplet
      ? cycleAReprendre
      : this.numeroCycleCourant + 1;

    if (!repriseCycleIncomplet) {
      this.enregistrerEvenements([
        creerEntreeCycleExperienceAvance({
          identifiantExperience: this.configuration.identifiantExperience,
          numeroCycle,
          ...(this.datesEvenementsFixes !== undefined
            ? { dateEnregistrement: this.datesEvenementsFixes }
            : {}),
        }),
      ]);
    }

    const agentsApres: AgentExperience[] = [];
    let tresorerie = this.tresorerie;
    const xwayAutoActif =
      this.configuration.xway?.active === true &&
      this.passerelleXway !== undefined &&
      this.configuration.xway.fournisseur.selecteur !== "openai";

    for (const agent of this.agents) {
      if (agent.etatEconomique.etatSurvie === "mort") {
        agentsApres.push(agent);
        continue;
      }

      const analyseEco = analyserExecutionEconomique({
        evenements: this.registre.listerParExperience(
          this.configuration.identifiantExperience,
        ),
        identifiantExperience: this.configuration.identifiantExperience,
        identifiantAgent: agent.identite.identifiant,
        numeroCycle,
      });

      if (analyseEco.statut === "terminee") {
        agentsApres.push(agent);
        continue;
      }

      let activite;
      let attributionsXway: {
        readonly identifiantDemande: string;
        readonly montantMicroUsdc: bigint;
      }[] = [];
      let provenanceDepenseCompute:
        | {
            readonly origine: "xway_inference" | "simulation_developpement";
            readonly attributionsXway?: readonly {
              readonly identifiantDemande: string;
              readonly montantMicroUsdc: bigint;
            }[];
          }
        | undefined;

      if (this.configuration.mode === "decision_simulee") {
        const branche = await this.executerBrancheDecision(agent, numeroCycle);
        if (branche === null) {
          agentsApres.push(agent);
          continue;
        }
        activite = branche.activite;
        attributionsXway = [...branche.attributionsXway];
        provenanceDepenseCompute =
          activite.depenseCompute > 0n && attributionsXway.length > 0
            ? {
                origine: "xway_inference" as const,
                attributionsXway,
              }
            : undefined;
      } else {
        const activiteEco = simulerActiviteCycle({
          graineSimulation: this.configuration.graineSimulation,
          identifiantAgent: agent.identite.identifiant,
          numeroCycle,
        });

        let coutComputeXway = 0n;
        const dejaCompute = analyseEco.typesPresents.has("DEPENSE_COMPUTE");
        if (
          !dejaCompute &&
          xwayAutoActif &&
          this.passerelleXway !== undefined &&
          this.configuration.xway
        ) {
          const resultatXway = await executerCycleCognitifAgent({
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
          coutComputeXway = resultatXway.coutComputeXwayMicroUsdc;
          attributionsXway = [...resultatXway.attributionsComputeXway];
          this.assertAttributionsXwayInedites(attributionsXway);
        }

        activite = {
          ...activiteEco,
          depenseCompute:
            this.configuration.xway?.active === true && xwayAutoActif
              ? dejaCompute
                ? 0n
                : coutComputeXway
              : activiteEco.depenseCompute,
        };

        provenanceDepenseCompute =
          activite.depenseCompute > 0n
            ? xwayAutoActif && attributionsXway.length > 0
              ? {
                  origine: "xway_inference" as const,
                  attributionsXway,
                }
              : xwayAutoActif
                ? undefined
                : { origine: "simulation_developpement" as const }
            : undefined;
      }

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
          identifiantExecutionEconomique:
            analyseEco.identifiantExecutionEconomique,
          evenementsExecutionExistants: analyseEco.evenements,
          ...(provenanceDepenseCompute !== undefined
            ? { provenanceDepenseCompute }
            : {}),
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

      this.enregistrerLotEconomiqueAtomique(resultat.evenements);
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
    if (repriseCycleIncomplet) {
      this.historique = this.historique.filter(
        (entree) => entree.numeroCycle < numeroCycle,
      );
    }
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
    const environnementDecisionConfig =
      snapshot.environnementDecision !== undefined
        ? parserConfigurationEnvironnementOpportunites(
            snapshot.environnementDecision as unknown as ConfigurationEnvironnementOpportunitesJson,
          )
        : undefined;
    const politiqueBudgetCognitif =
      snapshot.politiqueBudgetCognitif !== undefined
        ? parserConfigurationPolitiqueBudgetCognitif(
            snapshot.politiqueBudgetCognitif as unknown as ConfigurationPolitiqueBudgetCognitifJson,
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
      ...(environnementDecisionConfig !== undefined
        ? { environnementDecision: environnementDecisionConfig }
        : {}),
      ...(politiqueBudgetCognitif !== undefined
        ? { politiqueBudgetCognitif }
        : {}),
    };
    this.environnementDecision =
      environnementDecisionConfig !== undefined
        ? creerEnvironnementOpportunitesSimulees(
            environnementDecisionConfig,
            snapshot.graineSimulation,
          )
        : undefined;
    this.politiqueBudgetCognitif = politiqueBudgetCognitif;
    this.passerelleXway = fabriquerPasserelle(
      xway,
      reconstruireEtatsDemandesDepuisRegistre(evenements),
      {
        authentificationRequise: identite?.active === true,
        clesPubliquesParAgent: carteClesPubliques(
          reconstruireIdentitesPubliques(evenements),
        ),
        etatPlafondFournisseur: reconstruireEtatPlafondFournisseur(evenements),
        ...(this.fournisseurInjecte !== undefined
          ? { fournisseurInjecte: this.fournisseurInjecte }
          : {}),
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
      libelleMode:
        this.configuration.mode === "decision_simulee"
          ? "DÉCISION SIMULÉE"
          : "SIMULATION DÉTERMINISTE",
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

  projeterDecisionsAgent(identifiant: string): ProjectionDecisionAgent[] {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    return projeterDecisionsDepuisRegistre(evenements, identifiant);
  }

  projeterResumeDecisionAgent(
    identifiant: string,
  ): ProjectionDecisionAgentResume {
    return calculerResumeDecisionAgent(this.projeterDecisionsAgent(identifiant));
  }

  projeterActiviteDecisionnelle(): ProjectionActiviteDecisionnelle {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    const decisions = projeterDecisionsDepuisRegistre(evenements);
    return calculerActiviteDecisionnelle(decisions, this.numeroCycleCourant);
  }

  projeterFitnessAgent(
    identifiant: string,
    fenetre?: FenetreEvaluation,
  ): ProjectionFitnessAgent | undefined {
    if (!this.agents.some((a) => a.identite.identifiant === identifiant)) {
      return undefined;
    }
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    return calculerEtProjeterFitnessAgent({
      identifiantAgent: identifiant,
      evenements,
      cycleCourant: this.numeroCycleCourant,
      ...(fenetre !== undefined ? { fenetre } : {}),
    });
  }

  projeterFitnessPopulation(
    fenetre?: FenetreEvaluation,
  ): ProjectionFitnessPopulation {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    return projeterFitnessPopulation({
      identifiantsAgents: this.agents.map((a) => a.identite.identifiant),
      evenements,
      cycleCourant: this.numeroCycleCourant,
      ...(fenetre !== undefined ? { fenetre } : {}),
    });
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
      selecteurFournisseur:
        this.configuration.xway?.fournisseur.selecteur ?? "simule",
      identifiantFournisseur:
        this.configuration.xway?.fournisseur.identifiant ??
        "fournisseur-inference-simule",
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
      selecteurFournisseur:
        this.configuration.xway?.fournisseur.selecteur ?? "simule",
      identifiantFournisseur:
        this.configuration.xway?.fournisseur.identifiant ??
        "fournisseur-inference-simule",
    });
  }

  projeterCoutsInfrastructureExterne(): ProjectionCoutsInfrastructureExterne {
    return projeterCoutsInfrastructureExterne({
      evenements: this.registre.listerParExperience(
        this.configuration.identifiantExperience,
      ),
      fournisseurActif:
        this.configuration.xway?.fournisseur.identifiant ??
        "fournisseur-inference-simule",
    });
  }

  /**
   * Aperçu dry-run d'une inférence-test — aucun réseau, aucune réservation.
   */
  apercevoirInferenceTest(identifiantAgent: string): ApercuInferenceTest {
    if (this.configuration.xway?.active !== true || this.passerelleXway === undefined) {
      throw new ControleurExperienceErreur("Xway inactif");
    }
    if (this.configuration.xway.fournisseur.selecteur !== "openai") {
      throw new ControleurExperienceErreur(
        "inference-test réservé au fournisseur openai (opt-in)",
      );
    }
    const agent = this.agents.find(
      (a) => a.identite.identifiant === identifiantAgent,
    );
    if (agent === undefined) {
      throw new ControleurExperienceErreur(`Agent introuvable : ${identifiantAgent}`);
    }
    if (agent.etatEconomique.etatSurvie === "mort") {
      throw new ControleurExperienceErreur("Agent mort — aucune inférence");
    }
    return calculerApercuInferenceTest({
      configurationXway: this.configuration.xway,
      passerelle: this.passerelleXway,
      agent,
      identifiantExperience: this.configuration.identifiantExperience,
      numeroCycle: Math.max(1, this.numeroCycleCourant),
      ...(this.configuration.identite?.active === true
        ? { signataire: this.obtenirSignataire(identifiantAgent) }
        : {}),
    });
  }

  /**
   * Inférence réelle volontaire — 1 agent, 1 requête.
   * Refuse si l'aperçu métier n'est pas autorisable (aucun réseau).
   * Applique DEPENSE_COMPUTE immédiatement (un seul débit).
   */
  async executerInferenceTest(
    identifiantAgent: string,
    options: { readonly inclureTexteBrutDiagnostic?: boolean } = {},
  ): Promise<ResultatInferenceTest> {
    const apercu = this.apercevoirInferenceTest(identifiantAgent);
    if (!apercu.autorisable) {
      return {
        apercu,
        statut: "refusee",
        coutImputeAgentMicroUsdc: null,
        coutFournisseurEstimeMicroUsd: null,
        proposition: null,
        detail: apercu.detailRefus ?? "autorisation refusee",
      };
    }

    if (this.configuration.xway?.active !== true || this.passerelleXway === undefined) {
      throw new ControleurExperienceErreur("Xway inactif");
    }
    const agent = this.agents.find(
      (a) => a.identite.identifiant === identifiantAgent,
    );
    if (agent === undefined) {
      throw new ControleurExperienceErreur(`Agent introuvable : ${identifiantAgent}`);
    }

    const resultat = await executerInferenceTestVolontaire({
      configurationXway: this.configuration.xway,
      passerelle: this.passerelleXway,
      agent,
      identifiantExperience: this.configuration.identifiantExperience,
      numeroCycle: Math.max(1, this.numeroCycleCourant),
      prochaineSequence: () =>
        this.registre.consulterProchaineSequence(
          this.configuration.identifiantExperience,
        ),
      enregistrerImmediatement: (evenements) => {
        this.enregistrerEvenements(evenements);
      },
      ...(this.configuration.identite?.active === true
        ? { signataire: this.obtenirSignataire(identifiantAgent) }
        : {}),
      ...(this.datesEvenementsFixes !== undefined
        ? { dateEnregistrement: this.datesEvenementsFixes }
        : {}),
      ...(options.inclureTexteBrutDiagnostic === true
        ? { inclureTexteBrutDiagnostic: true }
        : {}),
    });

    const cout = montantDepenseComputeDepuisTest(resultat.coutImputeAgentMicroUsdc);
    if (cout > 0n) {
      const identifiantDemande = resultat.identifiantDemande;
      if (identifiantDemande === undefined) {
        throw new ControleurExperienceErreur(
          "INFERENCE_EXECUTEE sans identifiantDemande — attribution impossible",
        );
      }
      this.assertAttributionsXwayInedites([
        { identifiantDemande, montantMicroUsdc: cout },
      ]);

      const etat = {
        ...agent.etatEconomique,
        capitalLiquide: agent.etatEconomique.capitalLiquide - cout,
        totalDepensesCompute: agent.etatEconomique.totalDepensesCompute + cout,
      };
      const charge = construireChargeDepenseCompute({
        montantMicroUsdc: cout,
        origine: "xway_inference",
        attributionsXway: [
          { identifiantDemande, montantMicroUsdc: cout },
        ],
      });
      this.enregistrerEvenements([
        {
          identifiant: `DEPENSE_COMPUTE-${identifiantAgent}-inf-test-${String(this.registre.consulterProchaineSequence(this.configuration.identifiantExperience))}`,
          versionSchema: 1,
          type: "DEPENSE_COMPUTE",
          identifiantExperience: this.configuration.identifiantExperience,
          identifiantAgent,
          numeroCycle: Math.max(1, this.numeroCycleCourant),
          chargeUtile: charge,
          ...(this.datesEvenementsFixes !== undefined
            ? { dateEnregistrement: this.datesEvenementsFixes }
            : {}),
        },
      ]);
      this.agents = this.agents.map((a) =>
        a.identite.identifiant === identifiantAgent
          ? { identite: a.identite, etatEconomique: etat }
          : a,
      );
    }

    const identifiantDemande = resultat.identifiantDemande;
    if (identifiantDemande === undefined) {
      return resultat;
    }
    return {
      ...resultat,
      auditRegistre: this.auditerRegistreInferenceTest(identifiantDemande),
    };
  }

  /**
   * Refuse une double attribution économique du même identifiantDemande.
   */
  private assertAttributionsXwayInedites(
    attributions: readonly {
      readonly identifiantDemande: string;
      readonly montantMicroUsdc: bigint;
    }[],
  ): void {
    try {
      assertDemandesXwayNonDejaAttribuees(
        this.registre.listerParExperience(
          this.configuration.identifiantExperience,
        ),
        attributions,
      );
    } catch (erreur) {
      if (erreur instanceof Error) {
        throw new ControleurExperienceErreur(erreur.message);
      }
      throw erreur;
    }
  }

  /**
   * Audit causal pour une demande : attributions via identifiantDemande uniquement.
   */
  auditerRegistreInferenceTest(
    identifiantDemande: string,
  ): AuditRegistreInferenceTest {
    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    const inferences = evenements.filter(
      (e) =>
        e.type === "INFERENCE_EXECUTEE" &&
        (e.chargeUtile as { identifiantDemande?: string } | undefined)
          ?.identifiantDemande === identifiantDemande,
    );
    const coutImpute =
      inferences.length === 1
        ? String(
            (inferences[0]?.chargeUtile as { coutFinalMicroUsdc?: string })
              ?.coutFinalMicroUsdc ?? "",
          )
        : null;
    const attributions = trouverAttributionsPourDemande(
      evenements,
      identifiantDemande,
    );
    const montantAttribue = attributions.reduce(
      (acc, a) => acc + a.montantMicroUsdc,
      0n,
    );
    const montantAttribueMicroUsdc = montantAttribue.toString(10);
    const correspondanceMontant =
      coutImpute !== null &&
      coutImpute.length > 0 &&
      montantAttribueMicroUsdc === coutImpute;
    return {
      identifiantDemande,
      nombreInferenceExecutee: inferences.length,
      nombreAttributionsDepenseCompute: attributions.length,
      montantAttribueMicroUsdc,
      coutImputeAgentMicroUsdc: coutImpute !== null && coutImpute.length > 0 ? coutImpute : null,
      correspondanceMontant,
      attributionUnique: attributions.length === 1,
    };
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
        etatPlafondFournisseur: reconstruireEtatPlafondFournisseur(evenements),
        ...(this.fournisseurInjecte !== undefined
          ? { fournisseurInjecte: this.fournisseurInjecte }
          : {}),
      },
    );
  }

  /**
   * Aperçu d'une décision réelle manuelle (1 agent × 1 observation).
   * Aucun réseau. Utilise l'adaptateur OpenAI uniquement si --executer ensuite.
   */
  apercevoirDecisionReelleManuelle(identifiantAgent?: string): {
    readonly identifiantAgent: string;
    readonly numeroCycle: number;
    readonly observation: ObservationOpportunite;
    readonly venMicroUsdc: string;
    readonly enjeuMicroUsdc: string;
    readonly utiliserInference: boolean;
    readonly modeleLogique: string | null;
    readonly limiteDepenseAutoriseeMicroUsdc: string;
    readonly plafondComputeParCycleMicroUsdc: string | null;
    readonly plafondFournisseurRestantMicroUsd: string | null;
    readonly actionsAutorisees: readonly string[];
    readonly selecteurFournisseur: string | null;
    readonly nombreAppelsReseauMaximum: 1;
  } {
    if (this.configuration.mode !== "decision_simulee") {
      throw new ControleurExperienceErreur(
        "apercevoirDecisionReelleManuelle exige mode decision_simulee",
      );
    }
    if (
      this.environnementDecision === undefined ||
      this.politiqueBudgetCognitif === undefined
    ) {
      throw new ControleurExperienceErreur(
        "Environnement/politique de décision absents",
      );
    }
    const agent =
      identifiantAgent !== undefined
        ? this.agents.find((a) => a.identite.identifiant === identifiantAgent)
        : this.agents.find((a) => a.etatEconomique.etatSurvie !== "mort");
    if (agent === undefined) {
      throw new ControleurExperienceErreur("Aucun agent vivant disponible");
    }
    const numeroCycle = this.numeroCycleCourant + 1;
    const observation = this.environnementDecision.produireObservation({
      identifiantAgent: agent.identite.identifiant,
      numeroCycle,
    });
    const ven = calculerValeurEconomiqueNette(agent.etatEconomique);
    const enjeu = calculerEnjeuOpportunite(observation);
    const choix = deciderBudgetCognitif({
      etatEconomique: agent.etatEconomique,
      runway: calculerRunwayEnCycles(
        agent.etatEconomique,
        this.configuration.parametresEconomiques
          .coutOperationnelMinimalParCycleMicroUsdc,
      ),
      observation,
      configuration: this.politiqueBudgetCognitif,
      ...(this.configuration.xway !== undefined
        ? {
            plafondXwayMicroUsdc:
              this.configuration.xway.plafondComputeParCycleMicroUsdc,
          }
        : {}),
    });
    return {
      identifiantAgent: agent.identite.identifiant,
      numeroCycle,
      observation,
      venMicroUsdc: ven.toString(10),
      enjeuMicroUsdc: enjeu.toString(10),
      utiliserInference: choix.utiliserInference,
      modeleLogique: choix.modeleLogique,
      limiteDepenseAutoriseeMicroUsdc:
        choix.limiteDepenseAutoriseeMicroUsdc.toString(10),
      plafondComputeParCycleMicroUsdc:
        this.configuration.xway?.plafondComputeParCycleMicroUsdc.toString(10) ??
        null,
      plafondFournisseurRestantMicroUsd:
        this.configuration.xway?.plafondDepenseFournisseurReelleMicroUsd?.toString(
          10,
        ) ?? null,
      actionsAutorisees: observation.actionsAutorisees,
      selecteurFournisseur:
        this.configuration.xway?.fournisseur.selecteur ?? null,
      nombreAppelsReseauMaximum: 1,
    };
  }

  /**
   * Exécute UNE décision réelle manuelle :
   * 1 agent × 1 observation × 1 inférence (OpenAI via FournisseurInference) × 1 action simulée.
   * Opt-in strict — jamais appelé par avancerUnCycle.
   */
  async executerDecisionReelleManuelle(options?: {
    readonly identifiantAgent?: string;
  }): Promise<{
    readonly observation: ObservationOpportunite;
    readonly decision: DecisionAgent;
    readonly action: string;
    readonly issue: string;
    readonly coutCognitifMicroUsdc: string;
    readonly attributionsXway: readonly {
      readonly identifiantDemande: string;
      readonly montantMicroUsdc: string;
    }[];
  }> {
    if (this.configuration.mode !== "decision_simulee") {
      throw new ControleurExperienceErreur(
        "executerDecisionReelleManuelle exige mode decision_simulee",
      );
    }
    if (
      this.environnementDecision === undefined ||
      this.politiqueBudgetCognitif === undefined
    ) {
      throw new ControleurExperienceErreur(
        "Environnement/politique de décision absents",
      );
    }
    if (this.configuration.xway?.fournisseur.selecteur !== "openai") {
      throw new ControleurExperienceErreur(
        "executerDecisionReelleManuelle exige fournisseur selecteur=openai",
      );
    }

    const apercu = this.apercevoirDecisionReelleManuelle(
      options?.identifiantAgent,
    );
    const agent = this.agents.find(
      (a) => a.identite.identifiant === apercu.identifiantAgent,
    );
    if (agent === undefined) {
      throw new ControleurExperienceErreur("Agent introuvable");
    }

    // Matérialise le cycle d'expérience comme avancer, mais borné à 1 agent.
    if (this.statut === "en_pause") {
      this.enregistrerControle("EXPERIENCE_REPRISE");
    } else if (this.statut === "prete") {
      this.enregistrerControle("EXPERIENCE_DEMARREE");
    }
    const numeroCycle = apercu.numeroCycle;
    this.enregistrerEvenements([
      creerEntreeCycleExperienceAvance({
        identifiantExperience: this.configuration.identifiantExperience,
        numeroCycle,
        ...(this.datesEvenementsFixes !== undefined
          ? { dateEnregistrement: this.datesEvenementsFixes }
          : {}),
      }),
    ]);

    const resultat = await executerCycleDecisionAgent({
      environnement: this.environnementDecision,
      politique: this.politiqueBudgetCognitif,
      agent: {
        identifiant: agent.identite.identifiant,
        etatEconomique: agent.etatEconomique,
      },
      identifiantExperience: this.configuration.identifiantExperience,
      numeroCycle,
      coutOperationnelMinimalParCycleMicroUsdc:
        this.configuration.parametresEconomiques
          .coutOperationnelMinimalParCycleMicroUsdc,
      autoriserFournisseurReel: true,
      prochaineSequence: () =>
        this.registre.consulterProchaineSequence(
          this.configuration.identifiantExperience,
        ),
      enregistrerImmediatement: (evts) => {
        this.enregistrerEvenements(evts);
      },
      ...(this.configuration.xway !== undefined
        ? { configurationXway: this.configuration.xway }
        : {}),
      ...(this.passerelleXway !== undefined
        ? { passerelle: this.passerelleXway }
        : {}),
      ...(this.configuration.identite?.active === true
        ? { signataire: this.obtenirSignataire(agent.identite.identifiant) }
        : {}),
      ...(this.datesEvenementsFixes !== undefined
        ? { dateEnregistrement: this.datesEvenementsFixes }
        : {}),
    });

    this.assertAttributionsXwayInedites(resultat.attributionsComputeXway);

    const provenanceDepenseCompute =
      resultat.activite.depenseCompute > 0n &&
      resultat.attributionsComputeXway.length > 0
        ? {
            origine: "xway_inference" as const,
            attributionsXway: resultat.attributionsComputeXway,
          }
        : undefined;

    const agentsApres: AgentExperience[] = [];
    let tresorerie = this.tresorerie;
    for (const a of this.agents) {
      if (a.identite.identifiant !== agent.identite.identifiant) {
        agentsApres.push(a);
        continue;
      }
      if (a.etatEconomique.etatSurvie === "mort") {
        agentsApres.push(a);
        continue;
      }
      const eco = executerCycleEconomique({
        identifiantExperience: this.configuration.identifiantExperience,
        identifiantAgent: a.identite.identifiant,
        numeroCycle,
        parametres: this.configuration.parametresEconomiques,
        etat: a.etatEconomique,
        tresorerie,
        activite: resultat.activite,
        prefixeIdentifiant: `${a.identite.identifiant}-`,
        identifiantExecutionEconomique: fabriquerIdentifiantExecutionEconomique({
          identifiantExperience: this.configuration.identifiantExperience,
          identifiantAgent: a.identite.identifiant,
          numeroCycle,
        }),
        evenementsExecutionExistants: analyserExecutionEconomique({
          evenements: this.registre.listerParExperience(
            this.configuration.identifiantExperience,
          ),
          identifiantExperience: this.configuration.identifiantExperience,
          identifiantAgent: a.identite.identifiant,
          numeroCycle,
        }).evenements,
        ...(provenanceDepenseCompute !== undefined
          ? { provenanceDepenseCompute }
          : {}),
        ...(this.datesEvenementsFixes !== undefined
          ? { dateEnregistrement: this.datesEvenementsFixes }
          : {}),
      });
      this.enregistrerLotEconomiqueAtomique(eco.evenements);
      tresorerie = eco.tresorerie;
      agentsApres.push({
        identite: a.identite,
        etatEconomique: eco.etat,
      });
    }
    this.agents = agentsApres;
    this.tresorerie = tresorerie;
    this.numeroCycleCourant = numeroCycle;
    this.statut = "en_cours";
    this.historique = reconstruireHistoriqueParCycle(
      filtrerEvenementsEconomiques(
        this.registre.listerParExperience(
          this.configuration.identifiantExperience,
        ),
      ),
      this.agents,
    );

    return {
      observation: resultat.observation,
      decision: resultat.resultatMoteur.decision,
      action: resultat.resultatAction.action,
      issue: resultat.resultatAction.issue,
      coutCognitifMicroUsdc:
        resultat.resultatMoteur.coutCognitifMicroUsdc.toString(10),
      attributionsXway: resultat.attributionsComputeXway.map((a) => ({
        identifiantDemande: a.identifiantDemande,
        montantMicroUsdc: a.montantMicroUsdc.toString(10),
      })),
    };
  }

  /**
   * Branche decision_simulee : observation → décision → action → activité.
   * Retourne null si le cycle économique est déjà exécuté (reprise).
   * N'injecte PAS autoriserFournisseurReel — OpenAI uniquement hors avancer.
   */
  private async executerBrancheDecision(
    agent: AgentExperience,
    numeroCycle: number,
  ): Promise<{
    readonly activite: {
      readonly revenuActivite: bigint;
      readonly perteActivite: bigint;
      readonly depenseCompute: bigint;
      readonly depenseDonnees: bigint;
      readonly fraisExecution: bigint;
    };
    readonly attributionsXway: readonly {
      readonly identifiantDemande: string;
      readonly montantMicroUsdc: bigint;
    }[];
  } | null> {
    if (
      this.environnementDecision === undefined ||
      this.politiqueBudgetCognitif === undefined
    ) {
      throw new ControleurExperienceErreur(
        "Mode decision_simulee sans environnement/politique figés",
      );
    }

    const evenements = this.registre.listerParExperience(
      this.configuration.identifiantExperience,
    );
    const reprise = reconstruireEtatRepriseCycleDecision({
      evenements,
      identifiantAgent: agent.identite.identifiant,
      numeroCycle,
    });

    if (reprise?.cycleEconomiqueDejaExecute === true) {
      return null;
    }

    if (
      reprise?.resultatAction !== undefined &&
      reprise.resultatMoteur !== undefined
    ) {
      const attributionsXway =
        reprise.resultatMoteur.identifiantDemandeXway !== null &&
        reprise.resultatMoteur.coutCognitifMicroUsdc > 0n
          ? [
              {
                identifiantDemande: reprise.resultatMoteur.identifiantDemandeXway,
                montantMicroUsdc: reprise.resultatMoteur.coutCognitifMicroUsdc,
              },
            ]
          : [];
      const analyseEco = analyserExecutionEconomique({
        evenements,
        identifiantExperience: this.configuration.identifiantExperience,
        identifiantAgent: agent.identite.identifiant,
        numeroCycle,
      });
      // Attribution déjà matérialisée en DEPENSE_COMPUTE → ne pas re-vérifier
      // comme « inédite » (sinon faux positif à la reprise partielle).
      if (!analyseEco.typesPresents.has("DEPENSE_COMPUTE")) {
        this.assertAttributionsXwayInedites(attributionsXway);
      }
      return {
        activite: {
          revenuActivite: reprise.resultatAction.activite.revenuActivite,
          perteActivite: reprise.resultatAction.activite.perteActivite,
          depenseCompute: analyseEco.typesPresents.has("DEPENSE_COMPUTE")
            ? 0n
            : reprise.resultatMoteur.coutCognitifMicroUsdc,
          depenseDonnees: 0n,
          fraisExecution: reprise.resultatAction.activite.fraisExecution,
        },
        attributionsXway: analyseEco.typesPresents.has("DEPENSE_COMPUTE")
          ? []
          : attributionsXway,
      };
    }

    const resultat = await executerCycleDecisionAgent({
      environnement: this.environnementDecision,
      politique: this.politiqueBudgetCognitif,
      agent: {
        identifiant: agent.identite.identifiant,
        etatEconomique: agent.etatEconomique,
      },
      identifiantExperience: this.configuration.identifiantExperience,
      numeroCycle,
      coutOperationnelMinimalParCycleMicroUsdc:
        this.configuration.parametresEconomiques
          .coutOperationnelMinimalParCycleMicroUsdc,
      prochaineSequence: () =>
        this.registre.consulterProchaineSequence(
          this.configuration.identifiantExperience,
        ),
      enregistrerImmediatement: (evts) => {
        this.enregistrerEvenements(evts);
      },
      ...(this.configuration.xway !== undefined
        ? { configurationXway: this.configuration.xway }
        : {}),
      ...(this.passerelleXway !== undefined
        ? { passerelle: this.passerelleXway }
        : {}),
      ...(this.configuration.identite?.active === true
        ? { signataire: this.obtenirSignataire(agent.identite.identifiant) }
        : {}),
      ...(this.datesEvenementsFixes !== undefined
        ? { dateEnregistrement: this.datesEvenementsFixes }
        : {}),
      ...(reprise !== undefined ? { etatReprise: reprise } : {}),
    });

    this.assertAttributionsXwayInedites(resultat.attributionsComputeXway);
    return {
      activite: resultat.activite,
      attributionsXway: resultat.attributionsComputeXway,
    };
  }

  private enregistrerEvenements(
    evenements: readonly EntreeEvenementEsp[],
  ): void {
    for (const entree of evenements) {
      this.registre.ajouter(entree);
    }
  }

  /**
   * Écriture atomique du lot économique d'un agent×cycle.
   * SQLite : BEGIN/COMMIT — crash avant COMMIT → aucun événement partiel.
   */
  private enregistrerLotEconomiqueAtomique(
    evenements: readonly EntreeEvenementEsp[],
  ): void {
    if (evenements.length === 0) {
      return;
    }
    this.registre.ajouterPlusieurs(evenements);
  }
}

/**
 * Si CYCLE_EXPERIENCE_AVANCE(N) existe et qu'un agent non mort n'a pas
 * CYCLE_TERMINE pour N → reprendre N.
 */
function detecterCycleEconomiqueIncomplet(options: {
  readonly evenements: readonly EvenementEsp[];
  readonly identifiantExperience: string;
  readonly agents: readonly AgentExperience[];
}): number | undefined {
  let maxAvance = 0;
  for (const evenement of options.evenements) {
    if (
      evenement.type === "CYCLE_EXPERIENCE_AVANCE" &&
      evenement.numeroCycle > maxAvance
    ) {
      maxAvance = evenement.numeroCycle;
    }
  }
  if (maxAvance < 1) {
    return undefined;
  }

  for (const agent of options.agents) {
    if (agent.etatEconomique.etatSurvie === "mort") {
      continue;
    }
    const analyse = analyserExecutionEconomique({
      evenements: options.evenements,
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: agent.identite.identifiant,
      numeroCycle: maxAvance,
    });
    if (analyse.statut !== "terminee") {
      return maxAvance;
    }
  }
  return undefined;
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
    fournisseurInjecte?: FournisseurInference;
    etatPlafondFournisseur?: {
      readonly cumuleMicroUsd: bigint;
      readonly nombreAppels: number;
    };
  },
): PasserelleXway | undefined {
  if (configuration === undefined || !configuration.active) {
    return undefined;
  }
  const fournisseur = fabriquerFournisseurInference(configuration, {
    ...(options?.fournisseurInjecte !== undefined
      ? { fournisseurInjecte: options.fournisseurInjecte }
      : {}),
  });
  return creerPasserelleXway({
    configuration,
    fournisseur,
    etatsDemandes,
    ...(options?.authentificationRequise === true
      ? { authentificationRequise: true }
      : {}),
    ...(options?.clesPubliquesParAgent !== undefined
      ? { clesPubliquesParAgent: options.clesPubliquesParAgent }
      : {}),
    ...(options?.etatPlafondFournisseur !== undefined
      ? { etatPlafondFournisseur: options.etatPlafondFournisseur }
      : {}),
  });
}

/** Alias historique pour compatibilité des imports existants. */
export function creerControleurExperience(
  options: OptionsControleurExperience,
): ControleurExperience {
  return ControleurExperience.ouvrir(options);
}
