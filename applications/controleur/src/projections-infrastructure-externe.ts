import type { EvenementEsp, MicroUsd } from "@esp/protocole";
import { filtrerEvenementsXway } from "@esp/protocole";

/**
 * Projection séparée des coûts d'infrastructure externe (ex. OpenAI).
 * Distincte de TresorerieProprietaire — pas encore fusionnée comptablement.
 * ESTIMATION FOURNISSEUR uniquement.
 */
export type ProjectionCoutsInfrastructureExterne = {
  readonly fournisseur: string;
  readonly estimationCumuleeMicroUsd: string;
  readonly nombreAppels: number;
  readonly deviseReference: "USD";
  readonly note: "ESTIMATION FOURNISSEUR — pas une facture exacte";
};

export function projeterCoutsInfrastructureExterne(options: {
  readonly evenements: readonly EvenementEsp[];
  readonly fournisseurActif: string;
}): ProjectionCoutsInfrastructureExterne {
  let cumule: MicroUsd = 0n;
  let nombreAppels = 0;
  for (const evenement of filtrerEvenementsXway(options.evenements)) {
    if (evenement.type !== "INFERENCE_EXECUTEE") {
      continue;
    }
    const brut = evenement.chargeUtile.coutFournisseurEstimeMicroUsd;
    if (typeof brut === "string" && /^-?\d+$/.test(brut)) {
      cumule += BigInt(brut);
      nombreAppels += 1;
    }
  }
  return {
    fournisseur: options.fournisseurActif,
    estimationCumuleeMicroUsd: cumule.toString(10),
    nombreAppels,
    deviseReference: "USD",
    note: "ESTIMATION FOURNISSEUR — pas une facture exacte",
  };
}

export function reconstruireEtatPlafondFournisseur(
  evenements: readonly EvenementEsp[],
): { readonly cumuleMicroUsd: MicroUsd; readonly nombreAppels: number } {
  const projection = projeterCoutsInfrastructureExterne({
    evenements,
    fournisseurActif: "reconstruit",
  });
  return {
    cumuleMicroUsd: BigInt(projection.estimationCumuleeMicroUsd),
    nombreAppels: projection.nombreAppels,
  };
}
