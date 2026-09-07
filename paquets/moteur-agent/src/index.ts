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
