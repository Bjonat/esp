import type {
  EntreeEvenementEconomique,
  EvenementEconomique,
  TypeEvenementEconomique,
} from "./evenements-economiques.js";
import {
  estTypeEvenementEconomique,
} from "./evenements-economiques.js";
import type {
  EntreeEvenementExperience,
  TypeEvenementExperience,
} from "./evenements-experience.js";
import { estTypeEvenementExperience } from "./evenements-experience.js";

/**
 * Union des taxonomies d'événements ESP persistables dans le registre.
 * Économique et contrôle d'expérience restent distincts mais partageables.
 */
export type TypeEvenementEsp =
  | TypeEvenementEconomique
  | TypeEvenementExperience;

export type EntreeEvenementEsp =
  | EntreeEvenementEconomique
  | EntreeEvenementExperience;

/**
 * Événement persisté — même enveloppe pour les deux taxonomies.
 */
export type EvenementEsp = Omit<EvenementEconomique, "type"> & {
  readonly type: TypeEvenementEsp;
};

export function estTypeEvenementEsp(
  valeur: string,
): valeur is TypeEvenementEsp {
  return (
    estTypeEvenementEconomique(valeur) || estTypeEvenementExperience(valeur)
  );
}

export function estEvenementEconomique(
  evenement: EvenementEsp,
): evenement is EvenementEconomique {
  return estTypeEvenementEconomique(evenement.type);
}

export function filtrerEvenementsEconomiques(
  evenements: readonly EvenementEsp[],
): EvenementEconomique[] {
  return evenements.filter(estEvenementEconomique);
}
