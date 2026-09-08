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
