import {
  ALGORITHME_IDENTITE_ESP,
  IdentiteEspErreur,
  encoderBase64Url,
  extraireClePubliqueDepuisPkcs8,
  signerOctetsAvecPkcs8,
} from "./identite-ed25519.js";
import type { KeystoreIdentitesLocal } from "./keystore-local.js";

/**
 * Signataire local d'agent — détient (via keystore) la clé privée.
 *
 * Prépare le principe futur :
 *   LLM → intention → code de confiance → signataire local
 * et non : LLM → clé privée.
 *
 * Ne retourne JAMAIS la clé privée.
 */
export type ResultatSignatureAgent = {
  readonly signatureBase64Url: string;
  readonly clePubliqueBase64Url: string;
  readonly empreinteClePublique: string;
  readonly algorithme: typeof ALGORITHME_IDENTITE_ESP;
};

export type StatutSignataireAgent =
  | "disponible"
  | "cle_privee_indisponible"
  | "non_configuree";

export interface SignataireAgent {
  readonly identifiantAgent: string;
  readonly statut: StatutSignataireAgent;
  readonly clePubliqueBase64Url: string | null;
  readonly empreinteClePublique: string | null;
  signer(message: Buffer | Uint8Array): ResultatSignatureAgent;
}

export class SignataireAgentLocal implements SignataireAgent {
  readonly identifiantAgent: string;
  readonly statut: StatutSignataireAgent;
  readonly clePubliqueBase64Url: string | null;
  readonly empreinteClePublique: string | null;
  private readonly clePriveePkcs8Der: Buffer | null;

  private constructor(options: {
    identifiantAgent: string;
    statut: StatutSignataireAgent;
    clePriveePkcs8Der: Buffer | null;
    clePubliqueBase64Url: string | null;
    empreinteClePublique: string | null;
  }) {
    this.identifiantAgent = options.identifiantAgent;
    this.statut = options.statut;
    this.clePriveePkcs8Der = options.clePriveePkcs8Der;
    this.clePubliqueBase64Url = options.clePubliqueBase64Url;
    this.empreinteClePublique = options.empreinteClePublique;
  }

  static depuisKeystore(options: {
    readonly keystore: KeystoreIdentitesLocal;
    readonly identifiantExperience: string;
    readonly identifiantAgent: string;
    /** Clé publique attendue depuis le registre (source de vérité). */
    readonly clePubliqueEnregistreeBase64Url?: string | null;
    readonly identiteActive: boolean;
  }): SignataireAgentLocal {
    if (!options.identiteActive) {
      return new SignataireAgentLocal({
        identifiantAgent: options.identifiantAgent,
        statut: "non_configuree",
        clePriveePkcs8Der: null,
        clePubliqueBase64Url: options.clePubliqueEnregistreeBase64Url ?? null,
        empreinteClePublique: null,
      });
    }

    const stockee = options.keystore.chargerClePrivee({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantAgent,
    });

    if (stockee === null) {
      return new SignataireAgentLocal({
        identifiantAgent: options.identifiantAgent,
        statut: "cle_privee_indisponible",
        clePriveePkcs8Der: null,
        clePubliqueBase64Url: options.clePubliqueEnregistreeBase64Url ?? null,
        empreinteClePublique: null,
      });
    }

    if (
      options.clePubliqueEnregistreeBase64Url !== undefined &&
      options.clePubliqueEnregistreeBase64Url !== null &&
      stockee.clePubliqueBase64Url !== options.clePubliqueEnregistreeBase64Url
    ) {
      // Échec fermé : la clé locale ne correspond pas au registre.
      return new SignataireAgentLocal({
        identifiantAgent: options.identifiantAgent,
        statut: "cle_privee_indisponible",
        clePriveePkcs8Der: null,
        clePubliqueBase64Url: options.clePubliqueEnregistreeBase64Url,
        empreinteClePublique: null,
      });
    }

    return new SignataireAgentLocal({
      identifiantAgent: options.identifiantAgent,
      statut: "disponible",
      clePriveePkcs8Der: stockee.clePriveePkcs8Der,
      clePubliqueBase64Url: stockee.clePubliqueBase64Url,
      empreinteClePublique: stockee.empreinteClePublique,
    });
  }

  /** Construit un signataire en mémoire (tests / fixtures uniquement). */
  static depuisClePriveeMemoire(options: {
    readonly identifiantAgent: string;
    readonly clePriveePkcs8Der: Buffer;
  }): SignataireAgentLocal {
    const publique = extraireClePubliqueDepuisPkcs8(options.clePriveePkcs8Der);
    return new SignataireAgentLocal({
      identifiantAgent: options.identifiantAgent,
      statut: "disponible",
      clePriveePkcs8Der: options.clePriveePkcs8Der,
      clePubliqueBase64Url: publique.clePubliqueBase64Url,
      empreinteClePublique: publique.empreinteClePublique,
    });
  }

  signer(message: Buffer | Uint8Array): ResultatSignatureAgent {
    if (this.statut !== "disponible" || this.clePriveePkcs8Der === null) {
      throw new IdentiteEspErreur(
        `Signataire indisponible pour ${this.identifiantAgent} (statut=${this.statut})`,
      );
    }
    if (
      this.clePubliqueBase64Url === null ||
      this.empreinteClePublique === null
    ) {
      throw new IdentiteEspErreur(
        `Métadonnées publiques manquantes pour ${this.identifiantAgent}`,
      );
    }
    const signature = signerOctetsAvecPkcs8(this.clePriveePkcs8Der, message);
    return {
      signatureBase64Url: encoderBase64Url(signature),
      clePubliqueBase64Url: this.clePubliqueBase64Url,
      empreinteClePublique: this.empreinteClePublique,
      algorithme: ALGORITHME_IDENTITE_ESP,
    };
  }
}
