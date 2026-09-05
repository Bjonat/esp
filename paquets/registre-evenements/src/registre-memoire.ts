/**
 * Événement append-only du registre ESP.
 * Une fois enregistré, un événement est immuable.
 */
export interface Evenement {
  readonly identifiant: string;
  readonly identifiantAgent: string;
  readonly type: string;
  /** Horodatage ISO 8601. */
  readonly horodatage: string;
  readonly chargeUtile: Readonly<Record<string, unknown>>;
}

export type EntreeEvenement = {
  identifiant: string;
  identifiantAgent: string;
  type: string;
  horodatage: string;
  chargeUtile?: Readonly<Record<string, unknown>>;
};

export interface RegistreEvenements {
  ajouter(entree: EntreeEvenement): Evenement;
  lister(): readonly Evenement[];
  listerParAgent(identifiantAgent: string): readonly Evenement[];
  taille(): number;
}

function figerChargeUtile(
  chargeUtile: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...chargeUtile });
}

function figerEvenement(evenement: Evenement): Evenement {
  return Object.freeze({
    identifiant: evenement.identifiant,
    identifiantAgent: evenement.identifiantAgent,
    type: evenement.type,
    horodatage: evenement.horodatage,
    chargeUtile: figerChargeUtile(evenement.chargeUtile),
  });
}

/**
 * Registre d'événements en mémoire, append-only et ordonné.
 * Les événements historiques ne peuvent pas être modifiés ni retirés.
 */
export class RegistreEvenementsMemoire implements RegistreEvenements {
  private readonly evenements: Evenement[] = [];
  private readonly identifiantsConnus = new Set<string>();

  ajouter(entree: EntreeEvenement): Evenement {
    if (this.identifiantsConnus.has(entree.identifiant)) {
      throw new Error(
        `Événement déjà présent dans le registre : ${entree.identifiant}`,
      );
    }

    const evenement = figerEvenement({
      identifiant: entree.identifiant,
      identifiantAgent: entree.identifiantAgent,
      type: entree.type,
      horodatage: entree.horodatage,
      chargeUtile: entree.chargeUtile ?? {},
    });

    this.evenements.push(evenement);
    this.identifiantsConnus.add(evenement.identifiant);
    return evenement;
  }

  lister(): readonly Evenement[] {
    return [...this.evenements];
  }

  listerParAgent(identifiantAgent: string): readonly Evenement[] {
    return this.evenements.filter(
      (evenement) => evenement.identifiantAgent === identifiantAgent,
    );
  }

  taille(): number {
    return this.evenements.length;
  }
}

export function creerRegistreEvenementsMemoire(): RegistreEvenementsMemoire {
  return new RegistreEvenementsMemoire();
}
