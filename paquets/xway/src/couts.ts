import type { MicroUsdc, MicroUsd } from "@esp/protocole";
import type { BaremeCoutInference } from "./types.js";
import type {
  DemandeInference,
  EstimationCoutInference,
  MessageInference,
  TarifModeleInference,
  UsageInference,
} from "./types.js";

/**
 * Approximation déterministe de jetons — PAS un tokenizer OpenAI.
 *
 * Règle documentée v0.1 (fournisseur simulé) :
 * - chaque message contribue floor(longueurUTF16 / 4) jetons (minimum 1 si non vide) ;
 * - +2 jetons de cadrage par message ;
 * - total entrée = max(1, somme).
 */
export function compterJetonsMessages(
  messages: readonly MessageInference[],
): number {
  let total = 0;
  for (const message of messages) {
    const longueur = message.contenu.length;
    const corps = longueur === 0 ? 0 : Math.max(1, Math.floor(longueur / 4));
    total += corps + 2;
  }
  return Math.max(1, total);
}

/**
 * Borne conservatrice d'entrée AVANT appel réseau.
 * Documentée : ceil(longueurUTF16 / 2) + 8 par message — volontairement haute
 * pour garantir coutFinalImpute <= reservation (jamais sous-estimer).
 */
export function compterJetonsEntreeConservateur(
  messages: readonly MessageInference[],
): number {
  let total = 0;
  for (const message of messages) {
    const longueur = message.contenu.length;
    const corps =
      longueur === 0 ? 0 : Math.max(1, Math.ceil(longueur / 2));
    total += corps + 8;
  }
  return Math.max(1, total);
}

/**
 * Jetons de sortie déterministes dérivés de la demande.
 * Bornés par nombreMaxJetonsSortie (demande et tarif).
 */
export function determinerJetonsSortie(options: {
  readonly demande: DemandeInference;
  readonly plafondModele: number;
}): number {
  const plafond = Math.min(
    options.demande.nombreMaxJetonsSortie,
    options.plafondModele,
  );
  if (plafond < 1) {
    return 0;
  }
  const graine = hacherTexte(
    `${options.demande.identifiantDemande}|${options.demande.modeleDemande}|${options.demande.identifiantAgent}|${String(options.demande.numeroCycle)}`,
  );
  const amplitude = Math.max(1, Math.floor(plafond * 0.75));
  const minimum = Math.max(1, Math.floor(plafond * 0.15));
  return Math.min(plafond, minimum + (graine % (amplitude + 1)));
}

/**
 * Coût entier micro-USDC (imputation agent) :
 * floor(jetons * tarifParMillion / 1_000_000) pour entrée et sortie, puis somme.
 *
 * Barème ESP agent (v0.1) — imputation des jetons d'entrée cachés :
 * - `jetonsEntree` = total entrée fournisseur (OpenAI `input_tokens`),
 *   qui INCLUT déjà les jetons cachés comme sous-ensemble ;
 * - `jetonsEntreeCache` est informatif / pour l'estimation fournisseur ;
 * - côté agent : TOUT le total entrée est imputé au tarif entrée unique
 *   (pas de tarif cache distinct dans TarifModeleInference) ;
 * - JAMAIS `jetonsEntree + jetonsEntreeCache` (double comptage interdit).
 */
export function calculerCoutUsageMicroUsdc(
  jetonsEntree: number,
  jetonsSortie: number,
  tarif: TarifModeleInference,
  jetonsEntreeCache = 0,
): MicroUsdc {
  assertJetonsNonNegatifs(jetonsEntree, jetonsSortie);
  if (!Number.isInteger(jetonsEntreeCache) || jetonsEntreeCache < 0) {
    throw new Error("jetonsEntreeCache invalides");
  }
  if (jetonsEntreeCache > jetonsEntree) {
    throw new Error("jetonsEntreeCache > jetonsEntree");
  }
  // Total entrée une seule fois (cache ⊆ entrée).
  const coutEntree =
    (BigInt(jetonsEntree) * tarif.coutParMillionJetonsEntreeMicroUsdc) /
    1_000_000n;
  const coutSortie =
    (BigInt(jetonsSortie) * tarif.coutParMillionJetonsSortieMicroUsdc) /
    1_000_000n;
  return coutEntree + coutSortie;
}

/**
 * ESTIMATION coût fournisseur externe (micro-USD) depuis barème figé + usage mesuré.
 * Pas une facture exacte — réconciliation future éventuelle.
 *
 * Distinction explicite du barème historique :
 * - jetons non cachés → coutParMillionJetonsEntreeMicroUsd ;
 * - jetons cachés (sous-ensemble de l'entrée) → coutParMillionJetonsEntreeCacheMicroUsd ;
 * - sortie → coutParMillionJetonsSortieMicroUsd.
 *
 * `jetonsEntree` = total ; `jetonsEntreeCache` ⊆ total ; nonCache = total − cache.
 */
export function calculerCoutFournisseurEstimeMicroUsd(
  options: {
    readonly jetonsEntree: number;
    readonly jetonsSortie: number;
    readonly jetonsEntreeCache?: number;
    readonly bareme: BaremeCoutInference;
  },
): MicroUsd {
  const cache = options.jetonsEntreeCache ?? 0;
  assertJetonsNonNegatifs(options.jetonsEntree, options.jetonsSortie);
  if (!Number.isInteger(cache) || cache < 0) {
    throw new Error("jetonsEntreeCache invalides");
  }
  if (cache > options.jetonsEntree) {
    throw new Error("jetonsEntreeCache > jetonsEntree");
  }
  const nonCache = options.jetonsEntree - cache;
  const coutEntree =
    (BigInt(nonCache) * options.bareme.coutParMillionJetonsEntreeMicroUsd) /
    1_000_000n;
  const coutCache =
    (BigInt(cache) * options.bareme.coutParMillionJetonsEntreeCacheMicroUsd) /
    1_000_000n;
  const coutSortie =
    (BigInt(options.jetonsSortie) *
      options.bareme.coutParMillionJetonsSortieMicroUsd) /
    1_000_000n;
  return coutEntree + coutCache + coutSortie;
}

export function estimerCoutInference(
  demande: DemandeInference,
  tarif: TarifModeleInference,
  options?: {
    readonly conservateur?: boolean;
    readonly bareme?: BaremeCoutInference;
  },
): EstimationCoutInference {
  const jetonsEntreeEstimes = options?.conservateur
    ? compterJetonsEntreeConservateur(demande.messages)
    : compterJetonsMessages(demande.messages);
  const jetonsSortieMax = Math.min(
    demande.nombreMaxJetonsSortie,
    tarif.nombreMaxJetonsSortie,
  );
  const coutMaximumEstimeMicroUsdc = calculerCoutUsageMicroUsdc(
    jetonsEntreeEstimes,
    jetonsSortieMax,
    tarif,
  );
  const estimation: EstimationCoutInference = {
    jetonsEntreeEstimes,
    jetonsSortieMax,
    coutMaximumEstimeMicroUsdc,
  };
  if (options?.bareme !== undefined) {
    return {
      ...estimation,
      coutMaximumEstimeFournisseurMicroUsd:
        calculerCoutFournisseurEstimeMicroUsd({
          jetonsEntree: jetonsEntreeEstimes,
          jetonsSortie: jetonsSortieMax,
          jetonsEntreeCache: 0,
          bareme: options.bareme,
        }),
    };
  }
  return estimation;
}

export function calculerUsageInference(options: {
  readonly demande: DemandeInference;
  readonly tarif: TarifModeleInference;
}): UsageInference {
  const jetonsEntree = compterJetonsMessages(options.demande.messages);
  const jetonsSortie = determinerJetonsSortie({
    demande: options.demande,
    plafondModele: options.tarif.nombreMaxJetonsSortie,
  });
  const coutMicroUsdc = calculerCoutUsageMicroUsdc(
    jetonsEntree,
    jetonsSortie,
    options.tarif,
  );
  return { jetonsEntree, jetonsSortie, coutMicroUsdc };
}

function assertJetonsNonNegatifs(entree: number, sortie: number): void {
  if (!Number.isInteger(entree) || entree < 0) {
    throw new Error("jetonsEntree invalides");
  }
  if (!Number.isInteger(sortie) || sortie < 0) {
    throw new Error("jetonsSortie invalides");
  }
}

function hacherTexte(texte: string): number {
  let hachage = 2166136261;
  for (let index = 0; index < texte.length; index += 1) {
    hachage ^= texte.charCodeAt(index);
    hachage = Math.imul(hachage, 16777619);
  }
  return hachage >>> 0;
}
