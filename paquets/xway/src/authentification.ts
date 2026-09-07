import { createPublicKey, verify } from "node:crypto";
import {
  construireMessageCanoniqueDemandeInference,
} from "./signature-demande.js";
import type { DemandeInferenceSignee } from "./signature-demande.js";

export type MotifEchecAuthentificationXway =
  | "signature_invalide"
  | "cle_publique_non_enregistree"
  | "cle_publique_usurpation"
  | "enveloppe_absente"
  | "signature_malformee";

export type ResultatAuthentificationXway =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly motif: MotifEchecAuthentificationXway;
      readonly detail: string;
    };

/**
 * Authentifie une demande signée contre la clé publique ENREGISTRÉE (registre).
 * Ne fait pas confiance à la seule clé présentée dans l'enveloppe.
 */
export function authentifierDemandeInference(options: {
  readonly enveloppe: DemandeInferenceSignee;
  /** Clé publique issue du registre pour identifiantAgent — source de vérité. */
  readonly clePubliqueEnregistreeBase64Url: string | undefined;
}): ResultatAuthentificationXway {
  const { enveloppe, clePubliqueEnregistreeBase64Url } = options;

  if (
    clePubliqueEnregistreeBase64Url === undefined ||
    clePubliqueEnregistreeBase64Url.length === 0
  ) {
    return {
      ok: false,
      motif: "cle_publique_non_enregistree",
      detail: `Aucune identité publique enregistrée pour ${enveloppe.demande.identifiantAgent}`,
    };
  }

  if (enveloppe.clePubliqueBase64Url !== clePubliqueEnregistreeBase64Url) {
    return {
      ok: false,
      motif: "cle_publique_usurpation",
      detail: "Clé publique présentée ≠ identité enregistrée pour l'agent",
    };
  }

  try {
    const message = construireMessageCanoniqueDemandeInference(
      enveloppe.demande,
    );
    const signature = decoderBase64Url(enveloppe.signatureBase64Url);
    const cle = createPublicKey({
      key: {
        kty: "OKP",
        crv: "Ed25519",
        x: clePubliqueEnregistreeBase64Url,
      },
      format: "jwk",
    });
    const valide = verify(null, message, cle, signature);
    if (!valide) {
      return {
        ok: false,
        motif: "signature_invalide",
        detail: "Vérification Ed25519 échouée",
      };
    }
    return { ok: true };
  } catch (erreur) {
    return {
      ok: false,
      motif: "signature_malformee",
      detail: erreur instanceof Error ? erreur.message : String(erreur),
    };
  }
}

function decoderBase64Url(texte: string): Buffer {
  const pad = (4 - (texte.length % 4)) % 4;
  const base64 =
    texte.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64");
}
