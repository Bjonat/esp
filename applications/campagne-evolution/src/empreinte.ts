/**
 * Empreintes scientifiques SHA-256 — sérialisation JSON canonique (clés triées).
 *
 * Format : `sha256:<hex>`
 *
 * Concepts distincts :
 * - empreinteProtocole — intégrité du protocole figé
 * - empreinteExecutionRun — exécution (peut différer B vs C sham)
 * - empreinteResultatScientifique — sorties observables (B ≡ C si taux=0)
 *
 * FNV-1a reste réservé aux tirages non sécuritaires du protocole ESP
 * (mutation, priorités reproductives) — pas aux identifiants d'intégrité
 * de campagne.
 */

import { createHash } from "node:crypto";

export const FORMAT_EMPREINTE_PROTOCOLE =
  "empreinte-protocole-sha256-v01" as const;
export const FORMAT_EMPREINTE_EXECUTION =
  "empreinte-execution-run-sha256-v01" as const;
export const FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE =
  "empreinte-resultat-scientifique-sha256-v01" as const;

export type FormatsEmpreintesCampagne = {
  readonly protocole: typeof FORMAT_EMPREINTE_PROTOCOLE;
  readonly execution: typeof FORMAT_EMPREINTE_EXECUTION;
  readonly resultatScientifique: typeof FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE;
};

export const FORMATS_EMPREINTES_CAMPAGNE: FormatsEmpreintesCampagne = {
  protocole: FORMAT_EMPREINTE_PROTOCOLE,
  execution: FORMAT_EMPREINTE_EXECUTION,
  resultatScientifique: FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE,
};

export function serialiserJsonCanonique(valeur: unknown): string {
  return JSON.stringify(trierRecursif(valeur));
}

function trierRecursif(valeur: unknown): unknown {
  if (valeur === null || typeof valeur !== "object") {
    if (typeof valeur === "bigint") {
      return valeur.toString(10);
    }
    return valeur;
  }
  if (Array.isArray(valeur)) {
    return valeur.map(trierRecursif);
  }
  const enregistrement = valeur as Record<string, unknown>;
  const cles = Object.keys(enregistrement).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const sortie: Record<string, unknown> = {};
  for (const cle of cles) {
    sortie[cle] = trierRecursif(enregistrement[cle]);
  }
  return sortie;
}

/**
 * SHA-256 d'une charge déjà sérialisée (UTF-8).
 * Préfixe `sha256:` obligatoire pour les empreintes scientifiques.
 */
export function empreinteSha256DepuisTexte(texte: string): string {
  const hex = createHash("sha256").update(texte, "utf8").digest("hex");
  return `sha256:${hex}`;
}

/** SHA-256 d'une valeur après canonicalisation JSON (clés triées). */
export function empreinteSha256Canonique(valeur: unknown): string {
  return empreinteSha256DepuisTexte(serialiserJsonCanonique(valeur));
}

/**
 * Conservé uniquement pour tests/diagnostics non scientifiques.
 * Ne pas utiliser pour protocole / batch / résultat expérimental.
 */
export function empreinteFnv1aHex(texte: string): string {
  let h = 0xcbf29ce484222325n;
  const premier = 0x100000001b3n;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= BigInt(texte.charCodeAt(i));
    h = BigInt.asUintN(64, h * premier);
  }
  return h.toString(16).padStart(16, "0");
}

const TYPES_EXCLUS_EMPREINTE_EXECUTION = new Set([
  "IDENTITE_AGENT_ENREGISTREE",
]);

const CLES_SENSIBLES = new Set([
  "clePublique",
  "clePrivee",
  "empreinteClePublique",
  "materiauPrive",
  "secret",
]);

export type EvenementPourEmpreinte = {
  readonly type: string;
  readonly identifiant?: string;
  readonly identifiantAgent?: string | null;
  readonly numeroCycle?: number;
  readonly sequence?: number;
  readonly chargeUtile?: Readonly<Record<string, unknown>>;
  readonly dateEnregistrement?: string | null;
};

function nettoyerCharge(
  charge: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (charge === undefined) {
    return undefined;
  }
  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(charge)) {
    if (CLES_SENSIBLES.has(cle)) {
      continue;
    }
    if (valeur !== null && typeof valeur === "object" && !Array.isArray(valeur)) {
      sortie[cle] = nettoyerCharge(valeur as Record<string, unknown>);
    } else {
      sortie[cle] = valeur;
    }
  }
  return sortie;
}

/**
 * Empreinte d'exécution : protocole + condition + seed + événements canoniques
 * (hors identité Ed25519). PEUT différer entre B et C (mutation.active).
 */
export function calculerEmpreinteExecutionRun(options: {
  readonly empreinteProtocole: string;
  readonly condition: string;
  readonly seed: number;
  readonly evenements: readonly EvenementPourEmpreinte[];
}): string {
  const evenementsCanoniques = options.evenements
    .filter((e) => !TYPES_EXCLUS_EMPREINTE_EXECUTION.has(e.type))
    .map((e) => ({
      type: e.type,
      identifiant: e.identifiant ?? null,
      identifiantAgent: e.identifiantAgent ?? null,
      numeroCycle: e.numeroCycle ?? null,
      sequence: e.sequence ?? null,
      chargeUtile: nettoyerCharge(e.chargeUtile),
      // datesEvenementsFixes → déterministe ; wall-clock exclus si non figées
      dateEnregistrement: e.dateEnregistrement ?? null,
    }));

  return empreinteSha256Canonique({
    format: FORMAT_EMPREINTE_EXECUTION,
    empreinteProtocole: options.empreinteProtocole,
    condition: options.condition,
    seed: options.seed,
    evenements: evenementsCanoniques,
  });
}

/** @deprecated alias → calculerEmpreinteExecutionRun sans meta condition/seed */
export function empreinteRunDepuisEvenements(
  evenements: readonly EvenementPourEmpreinte[],
): string {
  return calculerEmpreinteExecutionRun({
    empreinteProtocole: "legacy-sans-protocole",
    condition: "?",
    seed: 0,
    evenements,
  });
}

/**
 * Charge observable pour empreinteResultatScientifique.
 * Exclut métadonnées d'exécution, chemins, timestamps muraux, identité crypto.
 */
export type ChargeResultatScientifique = {
  readonly format: typeof FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE;
  readonly empreinteProtocole: string;
  readonly seed: number;
  readonly trajectoire: readonly Record<string, unknown>[];
  readonly resumeScientifique: Readonly<Record<string, unknown>>;
};

const CHAMPS_TRAJECTOIRE_SCIENTIFIQUES = [
  "cycle",
  "populationTotale",
  "populationVivante",
  "venPopulationMicroUsdc",
  "capitalLiquidePopulationMicroUsdc",
  "revenusActiviteMicroUsdc",
  "pertesActiviteMicroUsdc",
  "computeMicroUsdc",
  "donneesMicroUsdc",
  "fraisExecutionMicroUsdc",
  "loyersMicroUsdc",
  "redevancesMicroUsdc",
  "coutsReproductionMicroUsdc",
  "resultatApresContratMicroUsdc",
  "resultatApresReproductionMicroUsdc",
  "naissances",
  "deces",
  "generationsPresentes",
  "ligneesVivantes",
  "configurationsHeritablesDistinctes",
  "mutationsCumulees",
  "mutationsCycle",
  "demandesInference",
  "coutCognitifMicroUsdc",
  "regretExAnteCumuleNumerateur",
  "regretExAnteCumuleDenominateur",
  "tauxDecisionsOptimalesExAnteBps",
  "contributionProprietaireMicroUsdc",
  "eteinte",
  "frequencesGenotypes",
  "lignees",
] as const;

const CHAMPS_RESUME_SCIENTIFIQUES = [
  "seed",
  "venPopulationFinaleMicroUsdc",
  "resultatActiviteBrutCumuleMicroUsdc",
  "resultatApresContratCumuleMicroUsdc",
  "resultatApresReproductionCumuleMicroUsdc",
  "computeCumuleMicroUsdc",
  "contributionProprietaireCumuleeMicroUsdc",
  "populationVivanteFinale",
  "eteinte",
  "cycleExtinction",
  "naissancesCumulees",
  "generationMaximale",
  "ligneesVivantes",
  "descendantsCumules",
  "mutationsCumulees",
  "configurationsDistinctesFinales",
  "frequencesGenotypiquesFinales",
  "regretExAnteCumuleNumerateur",
  "regretExAnteCumuleDenominateur",
  "tauxDecisionsOptimalesExAnteBps",
  "demandesInference",
  "coutCognitionMicroUsdc",
  "cyclesPopulationMaximaleAtteinte",
  "cyclesPlafondNaissancesAtteint",
  "runContraintParGardeFou",
] as const;

function extraireChamps(
  source: Readonly<Record<string, unknown>>,
  cles: readonly string[],
): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  for (const cle of cles) {
    if (Object.prototype.hasOwnProperty.call(source, cle)) {
      sortie[cle] = source[cle];
    }
  }
  return sortie;
}

export function construireChargeResultatScientifique(options: {
  readonly empreinteProtocole: string;
  readonly seed: number;
  readonly points: readonly Readonly<Record<string, unknown>>[];
  readonly resume: Readonly<Record<string, unknown>>;
}): ChargeResultatScientifique {
  return {
    format: FORMAT_EMPREINTE_RESULTAT_SCIENTIFIQUE,
    empreinteProtocole: options.empreinteProtocole,
    seed: options.seed,
    trajectoire: options.points.map((p) =>
      extraireChamps(p, CHAMPS_TRAJECTOIRE_SCIENTIFIQUES),
    ),
    resumeScientifique: extraireChamps(
      options.resume,
      CHAMPS_RESUME_SCIENTIFIQUES,
    ),
  };
}

/**
 * Empreinte résultat scientifique — B et C (taux=0) DOIVENT coïncider.
 * Indépendante de mutation.active, Ed25519, chemins, wall-clock.
 */
export function calculerEmpreinteResultatScientifique(
  charge: ChargeResultatScientifique,
): string {
  return empreinteSha256Canonique(charge);
}

export function calculerEmpreinteResultatScientifiqueDepuisRun(options: {
  readonly empreinteProtocole: string;
  readonly seed: number;
  readonly points: readonly Readonly<Record<string, unknown>>[];
  readonly resume: Readonly<Record<string, unknown>>;
}): string {
  return calculerEmpreinteResultatScientifique(
    construireChargeResultatScientifique(options),
  );
}
