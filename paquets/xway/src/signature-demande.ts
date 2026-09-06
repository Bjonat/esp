import { createHash } from "node:crypto";
import type { DemandeInference } from "./types.js";

/**
 * Domaine de signature Xway — ne doit PAS être réutilisable pour un paiement.
 */
export const DOMAINE_SIGNATURE_XWAY_INFERENCE = "ESP-XWAY-INFERENCE-V1" as const;
export const VERSION_MESSAGE_SIGNATURE_XWAY = "1" as const;

/**
 * Enveloppe signée présentée à Xway.
 * Xway ne reçoit JAMAIS la clé privée.
 */
export type DemandeInferenceSignee = {
  readonly demande: DemandeInference;
  /** Clé publique présentée — doit correspondre à celle du registre. */
  readonly clePubliqueBase64Url: string;
  readonly signatureBase64Url: string;
};

/**
 * Construit le message canonique signable (ordre de champs fixe, pas de JSON arbitraire).
 */
export function construireMessageCanoniqueDemandeInference(
  demande: DemandeInference,
): Buffer {
  const empreinteContenu = empreinteContenuDemande(demande);
  const lignes = [
    DOMAINE_SIGNATURE_XWAY_INFERENCE,
    `version=${VERSION_MESSAGE_SIGNATURE_XWAY}`,
    `identifiantExperience=${demande.identifiantExperience}`,
    `identifiantAgent=${demande.identifiantAgent}`,
    `identifiantDemande=${demande.identifiantDemande}`,
    `numeroCycle=${String(demande.numeroCycle)}`,
    `modeleDemande=${demande.modeleDemande}`,
    `limiteDepenseAutoriseeMicroUsdc=${demande.limiteDepenseAutoriseeMicroUsdc.toString(10)}`,
    `nombreMaxJetonsSortie=${String(demande.nombreMaxJetonsSortie)}`,
    `empreinteContenu=${empreinteContenu}`,
  ];
  return Buffer.from(lignes.join("\n"), "utf8");
}

/**
 * Empreinte déterministe du contenu (messages) — ordre et rôles inclus.
 */
export function empreinteContenuDemande(demande: DemandeInference): string {
  const parties: string[] = [];
  for (const message of demande.messages) {
    parties.push(`${message.role}:${message.contenu}`);
  }
  return createHash("sha256")
    .update(parties.join("\n"), "utf8")
    .digest("hex");
}
