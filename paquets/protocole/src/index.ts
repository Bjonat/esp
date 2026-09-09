export type {
  Agent,
  EntreeCreationAgent,
} from "./agent.js";
export { creerAgent } from "./agent.js";

export type { EtatSurvie, EtatVivant } from "./etat-survie.js";
export {
  ETATS_SURVIE,
  ETATS_VIVANTS,
  TransitionEtatSurvieInvalideErreur,
  estEtatMort,
  estEtatVivant,
  peutTransitionnerEtatSurvie,
  transitionnerEtatSurvie,
} from "./etat-survie.js";

export type { MicroUsdc, MicroUsd, PointsDeBase } from "./monnaie.js";
export {
  MICRO_USDC_PAR_USDC,
  MICRO_USD_PAR_USD,
  POINTS_DE_BASE_PAR_UNITE,
  MontantInvalideErreur,
  appliquerTauxPointsDeBase,
  assertMicroUsdcNonNegatif,
  assertMicroUsdNonNegatif,
  parserMicroUsdc,
  parserMicroUsd,
  serialiserMicroUsdc,
  serialiserMicroUsd,
  usdcVersMicroUsdc,
} from "./monnaie.js";

export type {
  ChargeAgentCree,
  ChargeCapitalInitial,
  ChargeDette,
  ChargeEtatSurvie,
  ChargeMontantSimple,
  ChargeRedevance,
  ChargeTransfertInterne,
  EntreeEvenementEconomique,
  EvenementEconomique,
  TypeEvenementEconomique,
} from "./evenements-economiques.js";
export {
  TYPES_EVENEMENT_ECONOMIQUE,
  VERSION_SCHEMA_EVENEMENT,
  ecrireMontantChargeUtile,
  estTypeEvenementEconomique,
  lireMontantChargeUtile,
} from "./evenements-economiques.js";

export type {
  ChargeCycleExperienceAvance,
  ChargeExperienceCreee,
  EntreeEvenementExperience,
  ModeExperienceProtocole,
  SnapshotCreationExperience,
  SnapshotSimulateurExperience,
  StatutExperienceProtocole,
  TypeEvenementExperience,
} from "./evenements-experience.js";
export {
  TYPES_EVENEMENT_EXPERIENCE,
  creerEntreeControleExperience,
  creerEntreeCycleExperienceAvance,
  creerEntreeExperienceCreee,
  estTypeEvenementExperience,
  parserSnapshotCreationExperience,
  reconstruireStatutExperience,
  serialiserSnapshotCreationExperience,
} from "./evenements-experience.js";

export type {
  EntreeEvenementEsp,
  EvenementEsp,
  TypeEvenementEsp,
} from "./evenements-esp.js";
export {
  estEvenementDecision,
  estEvenementEconomique,
  estEvenementIdentite,
  estEvenementXway,
  estTypeEvenementEsp,
  filtrerEvenementsDecision,
  filtrerEvenementsEconomiques,
  filtrerEvenementsIdentite,
  filtrerEvenementsXway,
} from "./evenements-esp.js";

export type {
  EntreeEvenementDecision,
  TypeEvenementDecision,
} from "./evenements-decision.js";
export {
  TYPES_EVENEMENT_DECISION,
  creerEntreeActionEnvironnementExecutee,
  creerEntreeChoixCognitifEffectue,
  creerEntreeDecisionAgentRefusee,
  creerEntreeDecisionAgentValidee,
  creerEntreeObservationAgentRecue,
  creerEntreePropositionDecisionProduite,
  creerEntreeResultatActionObserve,
  estTypeEvenementDecision,
} from "./evenements-decision.js";

export type {
  ActionEnvironnementDecision,
  ObservationAgent,
  ObservationOpportunite,
} from "./observation-agent.js";
export { observationOpportuniteVersObservationAgent } from "./observation-agent.js";

export type {
  ChoixCognitifAgent,
  DecisionAgent,
  PropositionDecision,
  SourceDecisionAgent,
} from "./decision-agent.js";

export type {
  ChargeDemandeInference,
  EntreeEvenementXway,
  NatureEchecInferenceProtocole,
  TypeEvenementXway,
} from "./evenements-xway.js";
export {
  TYPES_EVENEMENT_XWAY,
  creerEntreeDemandeInferenceAutorisee,
  creerEntreeDemandeInferenceRecue,
  creerEntreeDemandeInferenceRefusee,
  creerEntreeInferenceEchouee,
  creerEntreeInferenceExecutee,
  estTypeEvenementXway,
} from "./evenements-xway.js";

export type {
  ChargeIdentiteAgentEnregistree,
  EntreeEvenementIdentite,
  TypeEvenementIdentite,
} from "./evenements-identite.js";
export {
  TYPES_EVENEMENT_IDENTITE,
  creerEntreeIdentiteAgentEnregistree,
  estTypeEvenementIdentite,
} from "./evenements-identite.js";


export type {
  ContratEconomique,
  ParametresEconomiquesExperience,
} from "./parametres-economiques.js";
export {
  ParametresEconomiquesInvalidesErreur,
  validerParametresEconomiques,
} from "./parametres-economiques.js";

export type {
  BrouillonEtatEconomique,
  EntreeEtatEconomiqueInitial,
  EtatEconomiqueAgent,
} from "./etat-economique.js";
export {
  calculerValeurEconomiqueNette,
  clonerEtatEconomique,
  creerEtatEconomiqueInitial,
  figerEtatEconomique,
} from "./etat-economique.js";

export type { ResultatSurvieCycle } from "./runway.js";
export {
  calculerRunwayEnCycles,
  calculerSurvieApresCycle,
  determinerEtatSurvieDepuisRunway,
} from "./runway.js";

export type { CalculRedevanceProprietaire } from "./redevance.js";
export { calculerRedevanceProprietaire } from "./redevance.js";

export { ajusterHighWaterMarkTransfert } from "./high-water-mark.js";

export type { TresorerieProprietaire } from "./tresorerie-proprietaire.js";
export {
  calculerSoldeNetTresorerie,
  creerTresorerieProprietaire,
  enregistrerCoutReproductionEncaisse,
  enregistrerDepenseInfrastructureProprietaire,
  enregistrerLoyerEncaisse,
  enregistrerRedevanceEncaissee,
} from "./tresorerie-proprietaire.js";

export type {
  OptionsAttributionCapital,
  OptionsCycleEconomique,
  OptionsReglementDette,
  MotifDette,
  ResultatActiviteCycle,
  ResultatCycleEconomique,
  ResultatReglementDette,
} from "./cycle-economique.js";
export {
  AgentMortInactifErreur,
  CycleEconomiqueInvalideErreur,
  appliquerTransfertSurEtat,
  attribuerCapitalInitial,
  executerCycleEconomique,
  preparerTransfertInterne,
  reglerDette,
} from "./cycle-economique.js";

export type {
  AnalyseExecutionEconomique,
  StatutExecutionEconomique,
} from "./execution-economique.js";
export {
  analyserExecutionEconomique,
  fabriquerIdentifiantExecutionEconomique,
  lireIdentifiantExecutionEconomique,
} from "./execution-economique.js";

export { reconstruireEtatEconomique } from "./reconstruction.js";

export type {
  ChargeReproductionAutorisee,
  ChargeReproductionDemandee,
  ChargeReproductionRefusee,
  ChargeReproductionTerminee,
  EntreeEvenementReproduction,
  MotifRefusReproduction,
  TypeEvenementReproduction,
} from "./evenements-reproduction.js";
export {
  TYPES_EVENEMENT_REPRODUCTION,
  VERSION_SCHEMA_EVENEMENT_REPRODUCTION,
  estTypeEvenementReproduction,
} from "./evenements-reproduction.js";

export type { ConfigurationHeritableAgent } from "./configuration-heritable.js";
export {
  VERSION_CONFIGURATION_HERITABLE,
  copierConfigurationHeritable,
  creerConfigurationHeritableVide,
  parserConfigurationHeritable,
  serialiserConfigurationHeritable,
} from "./configuration-heritable.js";

export type {
  ParametresReproductionExperience,
  ParametresReproductionExperienceJson,
} from "./parametres-reproduction.js";
export {
  VERSION_PARAMETRES_REPRODUCTION,
  ParametresReproductionInvalidesErreur,
  creerParametresReproductionInactifs,
  parserParametresReproduction,
  serialiserParametresReproduction,
} from "./parametres-reproduction.js";

export type {
  PolitiqueReproductionAutonome,
  PolitiqueReproductionAutonomeJson,
} from "./parametres-reproduction-autonome.js";
export {
  VERSION_POLITIQUE_REPRODUCTION_AUTONOME,
  PolitiqueReproductionAutonomeInvalideErreur,
  creerPolitiqueReproductionAutonomeInactive,
  parserPolitiqueReproductionAutonome,
  serialiserPolitiqueReproductionAutonome,
} from "./parametres-reproduction-autonome.js";

export type {
  ChargeReproductionAutonomeCyclePlanifiee,
  ChargeReproductionAutonomeCycleTerminee,
  EntreeEvenementReproductionAutonome,
  TypeEvenementReproductionAutonome,
} from "./evenements-reproduction-autonome.js";
export {
  TYPES_EVENEMENT_REPRODUCTION_AUTONOME,
  VERSION_SCHEMA_EVENEMENT_REPRODUCTION_AUTONOME,
  creerEntreeReproductionAutonomeCyclePlanifiee,
  creerEntreeReproductionAutonomeCycleTerminee,
  estTypeEvenementReproductionAutonome,
} from "./evenements-reproduction-autonome.js";

export type {
  AnalyseReproduction,
  ContexteAutorisationReproduction,
  OptionsPreparationReproduction,
  ResultatPreparationReproduction,
} from "./reproduction.js";
export {
  analyserReproduction,
  evaluerAutorisationReproduction,
  fabriquerIdentifiantEnfant,
  fabriquerIdentifiantReproduction,
  preparerReproduction,
} from "./reproduction.js";

export type {
  CandidatReproductionAutonome,
  ContextePrioriteReproductionNeutre,
  PlanReproductionAutonome,
  ResultatEligibiliteReproductionAutonome,
} from "./politique-reproduction-autonome.js";
export {
  calculerPrioriteReproductionNeutre,
  evaluerEligibiliteReproductionAutonome,
  ordonnerCandidatsParPrioriteNeutre,
  planifierReproductionsAutonomes,
} from "./politique-reproduction-autonome.js";

export type {
  AutorisationNaissanceEconomiqueV03,
  CapaciteReproductiveEconomiqueV03,
  MotifRefusFenetreReproductiveV03,
  MotifRefusNaissanceEconomiqueV03,
  ResultatOuvertureFenetreReproductiveV03,
} from "./reproduction-economique-v03.js";
export {
  VERSION_REPRODUCTION_ECONOMIQUE_V03,
  ReproductionEconomiqueV03InvalideErreur,
  calculerCapaciteReproductiveTheoriqueV03,
  calculerCoutEconomiqueNaissanceV03,
  calculerSurplusReproductifV03,
  evaluerAutorisationNaissanceEconomiqueV03,
  evaluerOuvertureFenetreReproductiveV03,
  projeterCapaciteReproductiveEconomiqueV03,
} from "./reproduction-economique-v03.js";

export type {
  CleGeneMutable,
  ComportementSansInferenceGene,
  DefinitionGeneMutable,
  GeneCategoriel,
  GeneEntierBps,
  GeneEntierMicroUsdc,
} from "./genes-mutables.js";
export {
  CATALOGUE_GENES_MUTABLES_V01,
  VALEURS_COMPORTEMENT_SANS_INFERENCE,
  VERSION_CATALOGUE_GENES,
  clesGenesMutablesTriees,
  estCleGeneMutable,
  trouverDefinitionGene,
} from "./genes-mutables.js";

export {
  fabriquerHashGene,
  hacherDomaines,
  tirerBit,
  tirerBps,
  tirerEntierModulo,
} from "./tirage-deterministe.js";

export type {
  ParametresMutationExperience,
  ParametresMutationExperienceJson,
} from "./parametres-mutation.js";
export {
  VERSION_PARAMETRES_MUTATION,
  ParametresMutationInvalidesErreur,
  creerParametresMutationInactifs,
  parserParametresMutation,
  serialiserParametresMutation,
} from "./parametres-mutation.js";

export type {
  MutationEffective,
  ResultatMutationConfiguration,
} from "./mutation-configuration.js";
export {
  appliquerMutationConfigurationHeritable,
  configurationHeritableDepuisPolitiqueBase,
  differencesConfigurationsHeritables,
  empreinteConfigurationHeritable,
} from "./mutation-configuration.js";

export type { PolitiqueBudgetCognitifBase } from "./phenotype-heritable.js";
export { resoudrePolitiqueDepuisConfigurationHeritable } from "./phenotype-heritable.js";

export type {
  EntreeEvenementMutation,
  TypeEvenementMutation,
} from "./evenements-mutation.js";
export {
  TYPES_EVENEMENT_MUTATION,
  VERSION_SCHEMA_EVENEMENT_MUTATION,
  creerEntreeConfigurationHeritee,
  creerEntreeMutationAppliquee,
  estTypeEvenementMutation,
} from "./evenements-mutation.js";

export type {
  ActionDecisionExAnte,
  ParametresValeurAttendueAgir,
  ValeurAttendueExacte,
} from "./valeur-attendue-decision.js";
export {
  CONVENTION_EGALITE_EX_ANTE,
  DENOMINATEUR_VALEUR_ATTENDUE_BPS,
  additionnerValeursAttenduesExactes,
  arrondirValeurAttendueVersMicroUsdc,
  calculerRegretExAnte,
  calculerValeurAttendueAgir,
  calculerValeurAttendueAttendre,
  creerValeurAttendueExacte,
  determinerMeilleureActionExAnte,
} from "./valeur-attendue-decision.js";

export type {
  AgregatDimensionFitness,
  AgregatsFitnessPopulation,
  EvenementPourFitness,
  FenetreEvaluation,
  MesuresCognitionFitness,
  MesuresContributionFitness,
  MesuresDecisionFitness,
  MesuresEconomieFitness,
  MesuresFitnessAgent,
  MesuresResilienceFitness,
  MesuresRisqueFitness,
  MesuresSurvieFitness,
  PointHistoriqueFitness,
  RatioEntierDescriptif,
} from "./mesures-fitness.js";
export {
  VERSION_MESURES_FITNESS,
  agregaterFitnessPopulation,
  assertPasDeScoreScalaire,
  calculerMesuresFitnessAgent,
  medianeEntiere,
  medianeNombre,
} from "./mesures-fitness.js";

export type {
  AttributionDepenseComputeXway,
  AttributionHistoriqueXway,
  ChargeDepenseCompute,
  OrigineDepenseCompute,
} from "./provenance-depense-compute.js";
export {
  ORIGINES_DEPENSE_COMPUTE,
  ProvenanceDepenseComputeErreur,
  assertDemandesXwayNonDejaAttribuees,
  collecterAttributionsXwayHistoriques,
  construireChargeDepenseCompute,
  estOrigineDepenseCompute,
  lireAttributionsXwayDepuisCharge,
  trouverAttributionsPourDemande,
} from "./provenance-depense-compute.js";
