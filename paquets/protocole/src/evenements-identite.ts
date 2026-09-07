import { VERSION_SCHEMA_EVENEMENT } from "./evenements-economiques.js";

/**
 * Taxonomie d'événements d'identité cryptographique ESP.
 * Aucune clé privée — jamais.
 */
export const TYPES_EVENEMENT_IDENTITE = [
  "IDENTITE_AGENT_ENREGISTREE",
] as const;

export type TypeEvenementIdentite = (typeof TYPES_EVENEMENT_IDENTITE)[number];

export type EntreeEvenementIdentite = {
  identifiant: string;
  type: TypeEvenementIdentite;
  identifiantExperience: string;
  identifiantAgent?: string;
  numeroCycle: number;
  chargeUtile?: Readonly<Record<string, unknown>>;
  dateEnregistrement?: string;
  versionSchema?: number;
};

export type ChargeIdentiteAgentEnregistree = {
  readonly identifiantAgent: string;
  readonly algorithme: "ed25519";
  readonly clePubliqueBase64Url: string;
  readonly empreinteClePublique: string;
  readonly versionIdentite: string;
};

export function estTypeEvenementIdentite(
  valeur: string,
): valeur is TypeEvenementIdentite {
  return (TYPES_EVENEMENT_IDENTITE as readonly string[]).includes(valeur);
}

export function creerEntreeIdentiteAgentEnregistree(options: {
  identifiantExperience: string;
  identifiantAgent: string;
  clePubliqueBase64Url: string;
  empreinteClePublique: string;
  versionIdentite: string;
  indiceUnicite: number;
  numeroCycle?: number;
  dateEnregistrement?: string;
}): EntreeEvenementIdentite {
  const chargeUtile: ChargeIdentiteAgentEnregistree = {
    identifiantAgent: options.identifiantAgent,
    algorithme: "ed25519",
    clePubliqueBase64Url: options.clePubliqueBase64Url,
    empreinteClePublique: options.empreinteClePublique,
    versionIdentite: options.versionIdentite,
  };
  return {
    identifiant: `IDENTITE_AGENT_ENREGISTREE-${options.identifiantAgent}-u${String(options.indiceUnicite)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "IDENTITE_AGENT_ENREGISTREE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantAgent,
    numeroCycle: options.numeroCycle ?? 0,
    chargeUtile,
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };
}
