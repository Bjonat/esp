import type { MicroUsdc } from "@esp/protocole";
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
 * Règle documentée v0.1 :
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
 * Coût entier micro-USDC :
 * floor(jetons * tarifParMillion / 1_000_000) pour entrée et sortie, puis somme.
 * Aucun flottant monétaire.
 */
export function calculerCoutUsageMicroUsdc(
  jetonsEntree: number,
  jetonsSortie: number,
  tarif: TarifModeleInference,
): MicroUsdc {
  assertJetonsNonNegatifs(jetonsEntree, jetonsSortie);
  const coutEntree =
    (BigInt(jetonsEntree) * tarif.coutParMillionJetonsEntreeMicroUsdc) /
    1_000_000n;
  const coutSortie =
    (BigInt(jetonsSortie) * tarif.coutParMillionJetonsSortieMicroUsdc) /
    1_000_000n;
  return coutEntree + coutSortie;
}

export function estimerCoutInference(
  demande: DemandeInference,
  tarif: TarifModeleInference,
): EstimationCoutInference {
  const jetonsEntreeEstimes = compterJetonsMessages(demande.messages);
  const jetonsSortieMax = Math.min(
    demande.nombreMaxJetonsSortie,
    tarif.nombreMaxJetonsSortie,
  );
  const coutMaximumEstimeMicroUsdc = calculerCoutUsageMicroUsdc(
    jetonsEntreeEstimes,
    jetonsSortieMax,
    tarif,
  );
  return {
    jetonsEntreeEstimes,
    jetonsSortieMax,
    coutMaximumEstimeMicroUsdc,
  };
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
