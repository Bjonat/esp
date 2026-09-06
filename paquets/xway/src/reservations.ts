import type { MicroUsdc } from "@esp/protocole";

/**
 * Compte de capacité cognitive opérationnelle.
 *
 * Une réservation n'est PAS une dépense : elle ne touche ni VEN ni DEPENSE_COMPUTE.
 * Elle réduit seulement la capacité disponible pour d'autres demandes non réglées.
 *
 * Au règlement : DEPENSE_COMPUTE = coutFinal ; libération de (reservation - coutFinal).
 * En échec certain avant consommation : libération totale de la réservation.
 */
export type CleCapaciteCognitive = {
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
};

function cleTexte(cle: CleCapaciteCognitive): string {
  return `${cle.identifiantAgent}#${String(cle.numeroCycle)}`;
}

export class CompteReservationsCognitives {
  /** Réservations actives : demande → montant réservé. */
  private readonly reservationsParPortee = new Map<
    string,
    Map<string, MicroUsdc>
  >();
  /** Coûts réellement réglés (après exécution) par portée agent/cycle. */
  private readonly coutsReglesParPortee = new Map<string, MicroUsdc>();

  totalReservationsActives(cle: CleCapaciteCognitive): MicroUsdc {
    const carte = this.reservationsParPortee.get(cleTexte(cle));
    if (carte === undefined) {
      return 0n;
    }
    let total = 0n;
    for (const montant of carte.values()) {
      total += montant;
    }
    return total;
  }

  totalCoutsRegles(cle: CleCapaciteCognitive): MicroUsdc {
    return this.coutsReglesParPortee.get(cleTexte(cle)) ?? 0n;
  }

  capaciteDisponible(
    cle: CleCapaciteCognitive,
    limiteDepenseAutoriseeMicroUsdc: MicroUsdc,
  ): MicroUsdc {
    const engage =
      this.totalReservationsActives(cle) + this.totalCoutsRegles(cle);
    return limiteDepenseAutoriseeMicroUsdc > engage
      ? limiteDepenseAutoriseeMicroUsdc - engage
      : 0n;
  }

  reservationActive(
    cle: CleCapaciteCognitive,
    identifiantDemande: string,
  ): MicroUsdc | undefined {
    return this.reservationsParPortee
      .get(cleTexte(cle))
      ?.get(identifiantDemande);
  }

  /**
   * Réserve le coût maximum estimé. Échoue si déjà réservée ou capacité insuffisante.
   */
  reserver(options: {
    readonly cle: CleCapaciteCognitive;
    readonly identifiantDemande: string;
    readonly montantMicroUsdc: MicroUsdc;
    readonly limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  }): { ok: true } | { ok: false; motif: "deja_reservee" | "capacite_insuffisante" } {
    const portee = cleTexte(options.cle);
    let carte = this.reservationsParPortee.get(portee);
    if (carte === undefined) {
      carte = new Map();
      this.reservationsParPortee.set(portee, carte);
    }
    if (carte.has(options.identifiantDemande)) {
      return { ok: false, motif: "deja_reservee" };
    }
    const disponible = this.capaciteDisponible(
      options.cle,
      options.limiteDepenseAutoriseeMicroUsdc,
    );
    if (options.montantMicroUsdc > disponible) {
      return { ok: false, motif: "capacite_insuffisante" };
    }
    carte.set(options.identifiantDemande, options.montantMicroUsdc);
    return { ok: true };
  }

  /**
   * Règlement après consommation réelle.
   * Libère (reservation - coutFinal) ; comptabilise coutFinal comme réglé.
   */
  regler(options: {
    readonly cle: CleCapaciteCognitive;
    readonly identifiantDemande: string;
    readonly coutFinalMicroUsdc: MicroUsdc;
  }): void {
    const portee = cleTexte(options.cle);
    const carte = this.reservationsParPortee.get(portee);
    const reserve = carte?.get(options.identifiantDemande);
    if (reserve === undefined) {
      throw new Error(
        `Règlement sans réservation active : ${options.identifiantDemande}`,
      );
    }
    if (options.coutFinalMicroUsdc > reserve) {
      throw new Error(
        `Coût final ${options.coutFinalMicroUsdc.toString(10)} > réservation ${reserve.toString(10)}`,
      );
    }
    carte!.delete(options.identifiantDemande);
    if (carte!.size === 0) {
      this.reservationsParPortee.delete(portee);
    }
    const precedent = this.coutsReglesParPortee.get(portee) ?? 0n;
    this.coutsReglesParPortee.set(
      portee,
      precedent + options.coutFinalMicroUsdc,
    );
  }

  /** Libération totale (échec certain avant consommation). */
  liberer(options: {
    readonly cle: CleCapaciteCognitive;
    readonly identifiantDemande: string;
  }): void {
    const portee = cleTexte(options.cle);
    const carte = this.reservationsParPortee.get(portee);
    if (carte === undefined || !carte.has(options.identifiantDemande)) {
      return;
    }
    carte.delete(options.identifiantDemande);
    if (carte.size === 0) {
      this.reservationsParPortee.delete(portee);
    }
  }

  /** Restaure une réservation ouverte depuis le registre (reprise). */
  restaurerReservation(options: {
    readonly cle: CleCapaciteCognitive;
    readonly identifiantDemande: string;
    readonly montantMicroUsdc: MicroUsdc;
  }): void {
    const portee = cleTexte(options.cle);
    let carte = this.reservationsParPortee.get(portee);
    if (carte === undefined) {
      carte = new Map();
      this.reservationsParPortee.set(portee, carte);
    }
    carte.set(options.identifiantDemande, options.montantMicroUsdc);
  }

  /** Restaure un coût déjà réglé depuis INFERENCE_EXECUTEE (reprise). */
  restaurerCoutRegle(options: {
    readonly cle: CleCapaciteCognitive;
    readonly coutFinalMicroUsdc: MicroUsdc;
  }): void {
    const portee = cleTexte(options.cle);
    const precedent = this.coutsReglesParPortee.get(portee) ?? 0n;
    this.coutsReglesParPortee.set(
      portee,
      precedent + options.coutFinalMicroUsdc,
    );
  }
}
