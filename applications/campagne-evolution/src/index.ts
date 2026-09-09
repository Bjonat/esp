/**
 * @esp/campagne-evolution — protocole expérimental multi-génération v0.1 / v0.2.
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
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  CONDITIONS_EVOLUTION_V02,
  parserProtocoleEvolutionV02,
  chargerProtocoleEvolutionV02DepuisObjet,
  empreinteProtocoleV02,
} from "./protocole-evolution-v02.js";
export type {
  ProtocoleExperienceEvolutionV02,
  ProtocoleExperienceEvolutionV02Json,
} from "./protocole-evolution-v02.js";

export {
  chargerProtocoleCampagneEvolutionDepuisObjet,
  empreinteProtocoleCampagne,
  fabriquerConfigurationRunCampagne,
  preparerCampagneEvolution,
  estProtocoleEvolutionV01,
  estProtocoleEvolutionV02,
} from "./protocole-versionne.js";
export type { ProtocoleCampagneEvolution } from "./protocole-versionne.js";

export {
  DATE_EVENEMENTS_FIXES_EVOLUTION,
  fabriquerConfigurationRun,
  identifiantRun,
  identifiantExperienceRun,
  listerRunsPlanifies,
} from "./conditions.js";

export {
  fabriquerConfigurationRunV02,
  identifiantExperienceRunV02,
  listerRunsPlanifiesV02,
} from "./conditions-v02.js";

export {
  PreflightEvolutionV02Erreur,
  validerPreflightCampagneEvolutionV02,
  assertPreflightEvolutionV02OuEchouer,
} from "./preflight-evolution-v02.js";

export {
  classifierBornesCognitives,
} from "./diagnostic-bornes-cognitives.js";
export type {
  ClassificationBornesCognitives,
  IdentifiantBorneCognitive,
} from "./diagnostic-bornes-cognitives.js";

export {
  evaluerChoixSec,
  evaluerOccasionExpression,
  executerContrefactuelUnGene,
  voisinsUnPasGene,
} from "./diagnostic-contrefactuel-un-gene.js";
export type {
  NiveauExpressionPhenotypique,
  ResultatChoixSec,
  ResultatContrefactuelUnGene,
  VoisinGene,
} from "./diagnostic-contrefactuel-un-gene.js";

export {
  CLES_GENES_DIAGNOSTIC,
  CRITERES_COUVERTURE_DIAGNOSTIC_V02,
  analyserRunPourDiagnostic,
  genererDiagnosticExpositionPhenotypique,
  peutGenererDiagnosticExposition,
} from "./diagnostic-exposition-phenotypique-v02.js";
export type {
  LigneTraceDiagnostic,
  MetriquesGeneDiagnostic,
  ResumeDiagnosticExposition,
} from "./diagnostic-exposition-phenotypique-v02.js";

export {
  VERSION_CRITERES_CALIBRATION_V02,
  SEUILS_CALIBRATION_V02,
  IDENTIFIANTS_CRITERES_CALIBRATION_V02,
  descendanceDifferentiellePresente,
} from "./criteres-calibration-v02.js";
export type {
  IdentifiantCritereCalibrationV02,
  VerdictCritereCalibration,
} from "./criteres-calibration-v02.js";

export {
  evaluerCandidatCalibrationV02,
  ecrireArtefactsCalibrationV02,
  rendreRapportCalibrationV02,
  estProtocoleCalibrationV02,
  extraireIdentifiantCandidatCalibration,
} from "./evaluer-candidat-calibration-v02.js";
export type { ResumeCalibrationV02 } from "./evaluer-candidat-calibration-v02.js";

export {
  ControleSensibilitePhenotypiqueErreur,
  executerControleAComportementSansInference,
  executerControleBSeuilInference,
  executerControleCPlafondCognitif,
  executerControleDPartMaxVen,
  executerControleSensibilitePhenotypiqueV02,
} from "./controle-sensibilite-phenotypique-v02.js";
export type { ResultatControleSensibilite } from "./controle-sensibilite-phenotypique-v02.js";

export { executerControleCampagneExpressionPhenotypiqueV02 } from "./controle-campagne-expression-v02.js";

export {
  extraireTracePhenotypiqueCycle,
  tracesPhenotypiquesDivergent,
} from "./trace-phenotypique.js";
export type { TracePhenotypiqueCycle } from "./trace-phenotypique.js";

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

export {
  SEEDS_DIAGNOSTIC_EXPRESSION_V02,
  SEEDS_CALIBRATION_EVOLUTION_V02,
  SEEDS_EVALUATION_FIGEES_V02,
  NOMBRE_SEEDS_EVALUATION_V02,
  ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2,
  IDENTIFIANT_ENVIRONNEMENT_EXPOSITION_V02_E2,
  intersectionSeeds,
  assertSeedsEvaluationV02SansCollision,
} from "./seeds-evolution-v02.js";

export {
  extraireParametresScientifiquesV02,
  protocolesPartagentParametresScientifiquesV02,
} from "./audit-parametres-scientifiques-v02.js";
export type { ParametresScientifiquesV02 } from "./audit-parametres-scientifiques-v02.js";

export {
  IDENTIFIANT_PROTOCOLE_EVALUATION_V02,
  CHEMIN_PROTOCOLE_CALIBRATION_E1_01,
  CHEMIN_PROTOCOLE_EVALUATION_V02,
  deriverProtocoleEvaluationV02DepuisCalibration,
  deriverProtocoleEvaluationV02DepuisObjetCalibration,
} from "./deriver-protocole-evaluation-v02.js";

export {
  VERSION_FREEZE_EVOLUTION_EVALUATION_V02,
  GIT_REF_FREEZE_CANONIQUE_V02,
  HYPOTHESES_EVALUATION_V02,
  MOTIFS_ECHEC_TECHNIQUE_V02,
  MOTIFS_RESULTAT_SCIENTIFIQUE_DEFAVORABLE_V02,
  EMPREINTE_RESULTAT_INCLUT_DIAGNOSTIC_EXPRESSION_V02,
  estEchecTechniqueV02,
  estResultatScientifiqueDefavorableV02,
  autoriserRetryMemeSeedMemeProtocoleV02,
  assertProtocoleEvaluationV02InchangeDepuisFreeze,
  parserFreezeEvolutionEvaluationV02,
  chargerFreezeEvolutionEvaluationV02DepuisFichier,
  validerFreezeContreProtocolesV02,
  auditerAucuneSeedEvaluationV02Executee,
  auditerAucunBatchEvaluationV02,
} from "./freeze-evaluation-v02.js";
export type {
  IdentifiantHypotheseEvaluationV02,
  MotifEchecTechniqueV02,
  ResultatSuiteTestsFreezeV02,
  FreezeEvolutionEvaluationV02Json,
} from "./freeze-evaluation-v02.js";
