/**
 * Unité monétaire ESP v0.1 — micro-USDC (entier).
 * 1 USDC = 1_000_000 micro-USDC.
 * Jamais de nombre flottant pour les montants (ESP-ECO-005).
 */
export type MicroUsdc = bigint;

export const MICRO_USDC_PAR_USDC = 1_000_000n;

/**
 * Points de base pour les taux (évite les flottants).
 * 10_000 = 100 %, 1_000 = 10 %, 100 = 1 %.
 */
export type PointsDeBase = bigint;

export const POINTS_DE_BASE_PAR_UNITE = 10_000n;

export class MontantInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MontantInvalideErreur";
  }
}

/** Convertit un nombre entier d'USDC entiers en micro-USDC. */
export function usdcVersMicroUsdc(usdcEntiers: number | bigint): MicroUsdc {
  if (typeof usdcEntiers === "number") {
    if (!Number.isInteger(usdcEntiers)) {
      throw new MontantInvalideErreur(
        `USDC non entier interdit : ${String(usdcEntiers)}`,
      );
    }
    return BigInt(usdcEntiers) * MICRO_USDC_PAR_USDC;
  }
  return usdcEntiers * MICRO_USDC_PAR_USDC;
}

/** Sérialisation stable d'un montant (écriture persistante exacte). */
export function serialiserMicroUsdc(montant: MicroUsdc): string {
  return montant.toString(10);
}

/** Désérialisation stricte — refuse toute conversion silencieuse vers number. */
export function parserMicroUsdc(valeur: string): MicroUsdc {
  if (!/^-?\d+$/.test(valeur)) {
    throw new MontantInvalideErreur(
      `Montant micro-USDC invalide : ${valeur}`,
    );
  }
  return BigInt(valeur);
}

export function assertMicroUsdcNonNegatif(montant: MicroUsdc, contexte: string): void {
  if (montant < 0n) {
    throw new MontantInvalideErreur(
      `Montant négatif interdit (${contexte}) : ${serialiserMicroUsdc(montant)}`,
    );
  }
}

/**
 * Applique un taux en points de base à un montant.
 * Division entière truncature vers zéro (déterministe).
 */
export function appliquerTauxPointsDeBase(
  montant: MicroUsdc,
  tauxPointsDeBase: PointsDeBase,
): MicroUsdc {
  assertMicroUsdcNonNegatif(montant, "appliquerTauxPointsDeBase.montant");
  if (tauxPointsDeBase < 0n) {
    throw new MontantInvalideErreur(
      `Taux négatif interdit : ${tauxPointsDeBase.toString(10)}`,
    );
  }
  return (montant * tauxPointsDeBase) / POINTS_DE_BASE_PAR_UNITE;
}
