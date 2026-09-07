import type {
  EntreeEvenementEconomique,
  EvenementEconomique,
  TypeEvenementEconomique,
} from "./evenements-economiques.js";
import { estTypeEvenementEconomique } from "./evenements-economiques.js";
import type {
  EntreeEvenementExperience,
  TypeEvenementExperience,
} from "./evenements-experience.js";
import { estTypeEvenementExperience } from "./evenements-experience.js";
import type {
  EntreeEvenementIdentite,
  TypeEvenementIdentite,
} from "./evenements-identite.js";
import { estTypeEvenementIdentite } from "./evenements-identite.js";
import type {
  EntreeEvenementXway,
  TypeEvenementXway,
} from "./evenements-xway.js";
import { estTypeEvenementXway } from "./evenements-xway.js";

/**
 * Union des taxonomies d'événements ESP persistables dans le registre.
 */
export type TypeEvenementEsp =
  | TypeEvenementEconomique
  | TypeEvenementExperience
  | TypeEvenementXway
  | TypeEvenementIdentite;

export type EntreeEvenementEsp =
  | EntreeEvenementEconomique
  | EntreeEvenementExperience
  | EntreeEvenementXway
  | EntreeEvenementIdentite;

export type EvenementEsp = Omit<EvenementEconomique, "type"> & {
  readonly type: TypeEvenementEsp;
};

export function estTypeEvenementEsp(
  valeur: string,
): valeur is TypeEvenementEsp {
  return (
    estTypeEvenementEconomique(valeur) ||
    estTypeEvenementExperience(valeur) ||
    estTypeEvenementXway(valeur) ||
    estTypeEvenementIdentite(valeur)
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

export function estEvenementXway(
  evenement: EvenementEsp,
): evenement is EvenementEsp & { type: TypeEvenementXway } {
  return estTypeEvenementXway(evenement.type);
}

export function filtrerEvenementsXway(
  evenements: readonly EvenementEsp[],
): Array<EvenementEsp & { type: TypeEvenementXway }> {
  return evenements.filter(estEvenementXway);
}

export function estEvenementIdentite(
  evenement: EvenementEsp,
): evenement is EvenementEsp & { type: TypeEvenementIdentite } {
  return estTypeEvenementIdentite(evenement.type);
}

export function filtrerEvenementsIdentite(
  evenements: readonly EvenementEsp[],
): Array<EvenementEsp & { type: TypeEvenementIdentite }> {
  return evenements.filter(estEvenementIdentite);
}
