import type { MicroUsd } from "@esp/protocole";

/**
 * Circuit breaker propriétaire — plafond de dépense fournisseur réelle.
 * Indépendant des budgets agents / VEN / crédit Xway.
 */
export class ComptePlafondFournisseurReel {
  private cumuleMicroUsd: MicroUsd = 0n;
  private nombreAppels = 0;

  constructor(
    private readonly plafondMicroUsd: MicroUsd | undefined,
  ) {}

  obtenirCumuleMicroUsd(): MicroUsd {
    return this.cumuleMicroUsd;
  }

  obtenirNombreAppels(): number {
    return this.nombreAppels;
  }

  obtenirPlafondMicroUsd(): MicroUsd | undefined {
    return this.plafondMicroUsd;
  }

  restantMicroUsd(): MicroUsd | undefined {
    if (this.plafondMicroUsd === undefined) {
      return undefined;
    }
    if (this.cumuleMicroUsd >= this.plafondMicroUsd) {
      return 0n;
    }
    return this.plafondMicroUsd - this.cumuleMicroUsd;
  }

  /**
   * Vérifie si une estimation conservatrice peut encore passer.
   * Fail closed si plafond défini et restant insuffisant.
   */
  peutAutoriser(estimationMicroUsd: MicroUsd): boolean {
    if (this.plafondMicroUsd === undefined) {
      return true;
    }
    return this.cumuleMicroUsd + estimationMicroUsd <= this.plafondMicroUsd;
  }

  enregistrerEstimationConsommee(montantMicroUsd: MicroUsd): void {
    if (montantMicroUsd < 0n) {
      throw new Error("Montant plafond fournisseur négatif interdit");
    }
    this.cumuleMicroUsd += montantMicroUsd;
    this.nombreAppels += 1;
  }

  restaurer(options: {
    readonly cumuleMicroUsd: MicroUsd;
    readonly nombreAppels: number;
  }): void {
    this.cumuleMicroUsd = options.cumuleMicroUsd;
    this.nombreAppels = options.nombreAppels;
  }
}
