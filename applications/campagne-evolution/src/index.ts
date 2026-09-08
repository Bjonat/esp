/**
 * @esp/campagne-evolution — protocole expérimental multi-génération v0.1.
 */

export {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
  CONDITIONS_EVOLUTION_V01,
  ProtocoleEvolutionInvalideErreur,
  parserProtocoleEvolution,
  chargerProtocoleEvolutionDepuisObjet,
  empreinteProtocole,
  seedsDuMode,
} from "./protocole-evolution.js";
export type {
  ConditionEvolution,
  ModeCampagneEvolution,
  ProtocoleExperienceEvolutionV01,
  ProtocoleExperienceEvolutionV01Json,
  FournisseurProtocoleEvolutionJson,
} from "./protocole-evolution.js";

export {
  DATE_EVENEMENTS_FIXES_EVOLUTION,
  fabriquerConfigurationRun,
  identifiantRun,
  identifiantExperienceRun,
  listerRunsPlanifies,
} from "./conditions.js";

export {
  FournisseurMetaCodeIndisponible,
  FournisseurMetaCodeInjecte,
  FournisseurMetaCodeGit,
} from "./meta-code.js";
export type { MetaCode, FournisseurMetaCode } from "./meta-code.js";

export {
  serialiserJsonCanonique,
  empreinteFnv1aHex,
  empreinteSha256DepuisTexte,
  empreinteSha256Canonique,
  calculerEmpreinteExecutionRun,
  calculerEmpreinteResultatScientifique,
  calculerEmpreinteResultatScientifiqueDepuisRun,
  construireChargeResultatScientifique,
  empreinteRunDepuisEvenements,
  FORMATS_EMPREINTES_CAMPAGNE,
  FORMAT_EMPREINTE_PROTOCOLE,
  FORMAT_EMPREINTE_EXECUTION,
  FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE,
} from "./empreinte.js";
export type {
  EvenementPourEmpreinte,
  FormatsEmpreintesCampagne,
  ChargeResultatScientifique,
} from "./empreinte.js";

export {
  medianeNombres,
  medianeBigints,
  quartile1Nombres,
  quartile3Nombres,
  quartile1Bigints,
  quartile3Bigints,
  resumeStatistiqueNombres,
  resumeStatistiqueBigints,
} from "./statistiques.js";

export type {
  PointTrajectoireEvolution,
  InstantaneFrequenceGenotype,
  InstantaneLignee,
} from "./trajectoire.js";

export type { ResumeRunEvolution } from "./resume-run.js";
export { fabriquerResumeDepuisTrajectoire } from "./resume-run.js";

export { executerRun, nettoyerRunPartiel } from "./executer-run.js";

export {
  fabriquerIdentifiantBatch,
  construireManifesteBatch,
  ecrireManifeste,
  lireManifeste,
} from "./manifeste-batch.js";
export type {
  ManifesteBatchEvolution,
  EntreeRunManifeste,
  MarqueurBatch,
} from "./manifeste-batch.js";

export { executerCampagneEvolution } from "./runner-campagne.js";
export type {
  OptionsRunnerCampagne,
  ResultatCampagneEvolution,
} from "./runner-campagne.js";

export {
  calculerComparaisonsAppariees,
  differenceBigintExacte,
} from "./comparaisons.js";
export type {
  PaireComparaison,
  ResumeComparaisonBigint,
  ResumeComparaisonNombre,
} from "./comparaisons.js";

export {
  comparerControleNegatifBC,
  evaluerControleNegatifBatch,
} from "./controle-negatif.js";

export {
  ecrireRapportsBatch,
  agregerTrajectoiresParConditionCycle,
  chargerTrajectoireFichier,
} from "./rapports.js";

export { parserArgumentsCli, main } from "./cli.js";

export {
  VERSION_CRITERES_CALIBRATION,
  SEUILS_CALIBRATION_V01,
  IDENTIFIANTS_CRITERES_CALIBRATION,
  borneHautePremierCyclePopulationMax,
  estSaturePopulationTot,
} from "./criteres-calibration.js";
export type { IdentifiantCritereCalibration } from "./criteres-calibration.js";

export {
  CRITERES_PAR_ETAPE,
  extraireVueCalibration,
  extraireVueCalibrationDepuisCampagne,
  assertVueCalibrationSansDC,
} from "./vue-calibration.js";
export type {
  EntreeVueCalibration,
  ResumeCalibrationBatch,
} from "./vue-calibration.js";

export {
  clesAutoriseesPourEtape,
  appliquerSurchargeCalibration,
  refuserSeedsEvaluationEnCalibration,
  construireProtocoleCandidatCalibration,
  chargerProtocoleCalibrationDepuisObjet,
  CalibrationParametreRefuseErreur,
} from "./parametres-calibration-autorises.js";
export type {
  EtapeCalibration,
  CleCalibrationAutorisee,
  SurchargeCalibration,
} from "./parametres-calibration-autorises.js";

export {
  fabriquerEntreeJournalCalibration,
  serialiserEntreeJournalCalibration,
  appendreJournalCalibration,
  validateDecisionCalibration,
  DecisionCalibrationInvalideErreur,
} from "./journal-calibration.js";
export type {
  DecisionCalibration,
  EntreeJournalCalibration,
} from "./journal-calibration.js";

export {
  evaluerCandidatCalibration,
  evaluerCandidatDepuisCampagne,
} from "./evaluer-candidat-calibration.js";
export type {
  EntreeEvaluationCandidatCalibration,
  ResultatEvaluationCandidatCalibration,
} from "./evaluer-candidat-calibration.js";

export {
  parserArgumentsCliCalibration,
  mainCalibration,
} from "./cli-calibration.js";
export type { ArgumentsCliCalibration } from "./cli-calibration.js";

export {
  extraireParametresExperimentauxPartages,
  protocolesPartagentParametresExperimentaux,
  collecterSeedsExecuteesDansResultats,
  compterSeedsEvaluationExecutees,
} from "./audit-calibration.js";
export type { ParametresExperimentauxPartages } from "./audit-calibration.js";

export {
  VERSION_FREEZE_EVOLUTION_EVALUATION,
  ETAT_FREEZE_GELE_NON_EXECUTE,
  COMPARAISON_PRIMAIRE_EVALUATION,
  COMPARAISONS_SECONDAIRES_EVALUATION,
  SEEDS_EVALUATION_FIGEES_V01,
  HYPOTHESES_EVALUATION_V01,
  MOTIFS_ECHEC_TECHNIQUE_V01,
  MOTIFS_RESULTAT_EXPERIMENTAL_V01,
  MOTIFS_RANKING_INTERDITS,
  FreezeEvaluationInvalideErreur,
  estEchecTechnique,
  estResultatExperimental,
  autoriserRetryMemeSeedMemeProtocole,
  assertProtocoleEvaluationInchangeDepuisFreeze,
  parserFreezeEvolutionEvaluation,
  chargerFreezeEvolutionEvaluationDepuisFichier,
  validerFreezeContreProtocoles,
  auditerAucuneSeedEvaluationExecutee,
  assertSansRankingFitnessGlobale,
} from "./freeze-evaluation.js";
export type {
  EtatFreezeEvaluation,
  IdentifiantHypotheseEvaluation,
  MotifEchecTechnique,
  FreezeEvolutionEvaluationV01Json,
} from "./freeze-evaluation.js";
