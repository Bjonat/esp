import type { MicroUsdc } from "./monnaie.js";

/**
 * Ajuste le high-water mark lors d'un mouvement de capital non taxable
 * (transfert interne, endowment hors profit).
 *
 * - entrée : HWM += montant
 * - sortie : HWM -= montant (plancher à 0)
 */
export function ajusterHighWaterMarkTransfert(
  highWaterMark: MicroUsdc,
  montant: MicroUsdc,
  sens: "entree" | "sortie",
): MicroUsdc {
  if (montant < 0n) {
    throw new Error("montant de transfert négatif interdit pour le HWM");
  }
  if (sens === "entree") {
    return highWaterMark + montant;
  }
  return highWaterMark >= montant ? highWaterMark - montant : 0n;
}
