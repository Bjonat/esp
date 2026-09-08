export type { MoteurAgent } from "./moteur.js";
export { creerMoteurAgent } from "./moteur.js";

export {
  ALGORITHME_IDENTITE_ESP,
  VERSION_IDENTITE_ESP,
  IdentiteEspErreur,
  calculerEmpreinteClePublique,
  decoderBase64Url,
  encoderBase64Url,
  extraireClePubliqueDepuisPkcs8,
  genererPaireIdentiteEd25519,
  recreerClePubliqueDepuisBase64Url,
  signerOctetsAvecPkcs8,
  verifierSignatureEd25519,
} from "./identite-ed25519.js";
export type { PaireIdentiteEd25519 } from "./identite-ed25519.js";

export {
  CHEMIN_KEYSTORE_IDENTITES_DEFAUT,
  KeystoreIdentitesLocal,
} from "./keystore-local.js";
export type { ClePriveeStockee } from "./keystore-local.js";

export { SignataireAgentLocal } from "./signataire-agent.js";
export type {
  ResultatSignatureAgent,
  SignataireAgent,
  StatutSignataireAgent,
} from "./signataire-agent.js";

export type {
  ComportementSansInference,
  ConfigurationPolitiqueBudgetCognitif,
  ConfigurationPolitiqueBudgetCognitifJson,
  EntreePolitiqueBudgetCognitif,
} from "./politique-budget-cognitif.js";
export {
  calculerEnjeuOpportunite,
  deciderBudgetCognitif,
  deciderSansInference,
  parserConfigurationPolitiqueBudgetCognitif,
  serialiserConfigurationPolitiqueBudgetCognitif,
} from "./politique-budget-cognitif.js";

export type {
  EntreeValidationDecision,
  ResultatValidationDecision,
} from "./validateur-decision.js";
export {
  parserPropositionDepuisTexte,
  validerPropositionDecision,
} from "./validateur-decision.js";

export type {
  ExecuteurInferenceDecision,
  OptionsMoteurDecision,
  ResultatInferenceDecision,
  ResultatMoteurDecision,
} from "./moteur-decision.js";
export { executerMoteurDecision } from "./moteur-decision.js";
