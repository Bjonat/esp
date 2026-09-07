import type { StatutSignataireAgent } from "@esp/moteur-agent";
import type { EvenementEsp } from "@esp/protocole";
import { filtrerEvenementsIdentite } from "@esp/protocole";

export type ProjectionIdentiteAgent = {
  readonly algorithme: "ed25519" | null;
  readonly empreinteClePublique: string | null;
  readonly clePubliqueAbregee: string | null;
  readonly clePubliqueBase64Url: string | null;
  readonly statut: StatutSignataireAgent;
  readonly versionIdentite: string | null;
};

export type IdentitePubliqueAgent = {
  readonly identifiantAgent: string;
  readonly algorithme: "ed25519";
  readonly clePubliqueBase64Url: string;
  readonly empreinteClePublique: string;
  readonly versionIdentite: string;
};

/**
 * Reconstruit les identités publiques depuis le registre (source de vérité).
 * Aucune clé privée.
 */
export function reconstruireIdentitesPubliques(
  evenements: readonly EvenementEsp[],
): Map<string, IdentitePubliqueAgent> {
  const carte = new Map<string, IdentitePubliqueAgent>();
  for (const evenement of filtrerEvenementsIdentite(evenements)) {
    if (evenement.type !== "IDENTITE_AGENT_ENREGISTREE") {
      continue;
    }
    const agent = evenement.identifiantAgent;
    const cle = evenement.chargeUtile.clePubliqueBase64Url;
    const empreinte = evenement.chargeUtile.empreinteClePublique;
    const version = evenement.chargeUtile.versionIdentite;
    if (
      typeof agent !== "string" ||
      typeof cle !== "string" ||
      typeof empreinte !== "string" ||
      typeof version !== "string"
    ) {
      continue;
    }
    carte.set(agent, {
      identifiantAgent: agent,
      algorithme: "ed25519",
      clePubliqueBase64Url: cle,
      empreinteClePublique: empreinte,
      versionIdentite: version,
    });
  }
  return carte;
}

export function projeterIdentiteAgent(options: {
  readonly identifiantAgent: string;
  readonly identitesPubliques: ReadonlyMap<string, IdentitePubliqueAgent>;
  readonly statutSignataire: StatutSignataireAgent;
}): ProjectionIdentiteAgent {
  const enregistree = options.identitesPubliques.get(options.identifiantAgent);
  if (enregistree === undefined) {
    return {
      algorithme: null,
      empreinteClePublique: null,
      clePubliqueAbregee: null,
      clePubliqueBase64Url: null,
      statut: options.statutSignataire === "non_configuree"
        ? "non_configuree"
        : "non_configuree",
      versionIdentite: null,
    };
  }
  return {
    algorithme: "ed25519",
    empreinteClePublique: enregistree.empreinteClePublique,
    clePubliqueAbregee: abregerClePublique(enregistree.clePubliqueBase64Url),
    clePubliqueBase64Url: enregistree.clePubliqueBase64Url,
    statut: options.statutSignataire,
    versionIdentite: enregistree.versionIdentite,
  };
}

export function abregerClePublique(clePubliqueBase64Url: string): string {
  if (clePubliqueBase64Url.length <= 16) {
    return clePubliqueBase64Url;
  }
  return `${clePubliqueBase64Url.slice(0, 8)}…${clePubliqueBase64Url.slice(-6)}`;
}

/** Garantit qu'aucune charge utile d'identité ne contient de secret. */
export function chargeUtileIdentiteContientSecret(
  chargeUtile: Readonly<Record<string, unknown>>,
): boolean {
  const clesInterdites = [
    "cleprivee",
    "privatekey",
    "private_key",
    "seed",
    "pkcs8",
    "pemprive",
    "secret",
  ];
  for (const cle of Object.keys(chargeUtile)) {
    const normalisee = cle.toLowerCase().replaceAll("_", "");
    if (clesInterdites.some((i) => normalisee.includes(i.replaceAll("_", "")))) {
      // Autoriser clePublique* uniquement
      if (normalisee.includes("publique") || normalisee.includes("public")) {
        continue;
      }
      return true;
    }
  }
  return false;
}
