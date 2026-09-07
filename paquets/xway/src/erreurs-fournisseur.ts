import type { NatureEchecInference } from "./types.js";

/**
 * Erreur fournisseur typée — permet à la passerelle de classer
 * echec_certain vs resultat_indetermine sans connaître OpenAI.
 */
export class ErreurFournisseurInference extends Error {
  readonly natureEchec: NatureEchecInference;
  readonly code?: string;

  constructor(
    message: string,
    options: {
      readonly natureEchec: NatureEchecInference;
      readonly code?: string;
      readonly cause?: unknown;
    },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : {});
    this.name = "ErreurFournisseurInference";
    this.natureEchec = options.natureEchec;
    if (options.code !== undefined) {
      this.code = options.code;
    }
  }
}

/**
 * Surconsommation : usage mesuré produit un coût agent > réservation.
 * Erreur SYSTÈME — ne jamais débiter au-delà. Réconciliation manuelle.
 */
export class ErreurSurconsommationInference extends Error {
  readonly coutFinalMicroUsdc: bigint;
  readonly reservationMicroUsdc: bigint;

  constructor(options: {
    readonly coutFinalMicroUsdc: bigint;
    readonly reservationMicroUsdc: bigint;
  }) {
    super(
      `Surconsommation inference : coutFinal ${options.coutFinalMicroUsdc.toString(10)} > reservation ${options.reservationMicroUsdc.toString(10)}`,
    );
    this.name = "ErreurSurconsommationInference";
    this.coutFinalMicroUsdc = options.coutFinalMicroUsdc;
    this.reservationMicroUsdc = options.reservationMicroUsdc;
  }
}
