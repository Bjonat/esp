import type { MicroUsdc } from "@esp/protocole";
import { MICRO_USDC_PAR_USDC, serialiserMicroUsdc } from "@esp/protocole";

/**
 * Frontière de sérialisation API — JSON ne gère pas bigint.
 * La conversion d'affichage USDC n'est JAMAIS une valeur de calcul métier.
 */
export interface MontantApi {
  readonly microUsdc: string;
  readonly usdc: string;
}

/**
 * Convertit un montant micro-USDC en représentation d'affichage décimale.
 * Division entière + padding — aucun flottant métier.
 */
export function microUsdcVersAffichageUsdc(montant: MicroUsdc): string {
  const negatif = montant < 0n;
  const absolu = negatif ? -montant : montant;
  const entiers = absolu / MICRO_USDC_PAR_USDC;
  const fraction = absolu % MICRO_USDC_PAR_USDC;
  const fractionTexte = fraction.toString(10).padStart(6, "0");
  const corps = `${entiers.toString(10)}.${fractionTexte}`;
  return negatif ? `-${corps}` : corps;
}

export function serialiserMontantApi(montant: MicroUsdc): MontantApi {
  return {
    microUsdc: serialiserMicroUsdc(montant),
    usdc: microUsdcVersAffichageUsdc(montant),
  };
}

/**
 * Remplace récursivement les bigint par des chaînes décimales pour JSON.stringify.
 */
export function preparerChargeUtileJson(
  valeur: unknown,
): unknown {
  if (typeof valeur === "bigint") {
    return valeur.toString(10);
  }
  if (valeur === null || typeof valeur !== "object") {
    return valeur;
  }
  if (Array.isArray(valeur)) {
    return valeur.map(preparerChargeUtileJson);
  }
  const resultat: Record<string, unknown> = {};
  for (const [cle, element] of Object.entries(valeur)) {
    resultat[cle] = preparerChargeUtileJson(element);
  }
  return resultat;
}

export function serialiserJsonApi(corps: unknown): string {
  return JSON.stringify(corps, (_cle, valeur: unknown) => {
    if (typeof valeur === "bigint") {
      return valeur.toString(10);
    }
    return valeur;
  });
}
