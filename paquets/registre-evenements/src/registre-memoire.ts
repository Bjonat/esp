import type {
  EntreeEvenement,
  Evenement,
  RegistreEvenements,
} from "./types.js";
import { normaliserEntreeEvenement } from "./types.js";

/**
 * Registre d'événements en mémoire, append-only et ordonné.
 * Attribue une séquence monotone par expérience.
 */
export class RegistreEvenementsMemoire implements RegistreEvenements {
  private readonly evenements: Evenement[] = [];
  private readonly identifiantsConnus = new Set<string>();
  /** Prochaine séquence à attribuer, indexée par expérience. */
  private readonly prochainesSequences = new Map<string, number>();

  consulterProchaineSequence(identifiantExperience: string): number {
    return this.prochainesSequences.get(identifiantExperience) ?? 1;
  }

  ajouter(entree: EntreeEvenement): Evenement {
    if (this.identifiantsConnus.has(entree.identifiant)) {
      throw new Error(
        `Événement déjà présent dans le registre : ${entree.identifiant}`,
      );
    }

    const sequence = this.consulterProchaineSequence(
      entree.identifiantExperience,
    );
    const evenement = normaliserEntreeEvenement(entree, sequence);

    this.evenements.push(evenement);
    this.identifiantsConnus.add(evenement.identifiant);
    this.prochainesSequences.set(entree.identifiantExperience, sequence + 1);
    return evenement;
  }

  /**
   * Lot atomique en mémoire : aucune insertion si une seule échoue.
   */
  ajouterPlusieurs(entrees: readonly EntreeEvenement[]): readonly Evenement[] {
    if (entrees.length === 0) {
      return [];
    }

    for (const entree of entrees) {
      if (this.identifiantsConnus.has(entree.identifiant)) {
        throw new Error(
          `Événement déjà présent dans le registre : ${entree.identifiant}`,
        );
      }
    }

    const sequencesParExperience = new Map<string, number>();
    const preparés: Evenement[] = [];

    for (const entree of entrees) {
      const base =
        sequencesParExperience.get(entree.identifiantExperience) ??
        this.consulterProchaineSequence(entree.identifiantExperience);
      const evenement = normaliserEntreeEvenement(entree, base);
      preparés.push(evenement);
      sequencesParExperience.set(entree.identifiantExperience, base + 1);
    }

    for (const evenement of preparés) {
      this.evenements.push(evenement);
      this.identifiantsConnus.add(evenement.identifiant);
    }
    for (const [experience, prochaine] of sequencesParExperience) {
      this.prochainesSequences.set(experience, prochaine);
    }

    return preparés;
  }

  lister(): readonly Evenement[] {
    return [...this.evenements];
  }

  listerParAgent(identifiantAgent: string): readonly Evenement[] {
    return this.evenements.filter(
      (evenement) => evenement.identifiantAgent === identifiantAgent,
    );
  }

  listerParExperience(identifiantExperience: string): readonly Evenement[] {
    return this.evenements.filter(
      (evenement) => evenement.identifiantExperience === identifiantExperience,
    );
  }

  listerParCycle(
    identifiantExperience: string,
    numeroCycle: number,
  ): readonly Evenement[] {
    return this.evenements.filter(
      (evenement) =>
        evenement.identifiantExperience === identifiantExperience &&
        evenement.numeroCycle === numeroCycle,
    );
  }

  taille(): number {
    return this.evenements.length;
  }
}

export function creerRegistreEvenementsMemoire(): RegistreEvenementsMemoire {
  return new RegistreEvenementsMemoire();
}
