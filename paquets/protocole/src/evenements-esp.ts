import type {
  EntreeEvenementDecision,
  TypeEvenementDecision,
} from "./evenements-decision.js";
import { estTypeEvenementDecision } from "./evenements-decision.js";
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
  EntreeEvenementMutation,
  TypeEvenementMutation,
} from "./evenements-mutation.js";
import { estTypeEvenementMutation } from "./evenements-mutation.js";
import type {
  EntreeEvenementReproduction,
  TypeEvenementReproduction,
} from "./evenements-reproduction.js";
import { estTypeEvenementReproduction } from "./evenements-reproduction.js";
import type {
  EntreeEvenementReproductionAutonome,
  TypeEvenementReproductionAutonome,
} from "./evenements-reproduction-autonome.js";
import { estTypeEvenementReproductionAutonome } from "./evenements-reproduction-autonome.js";
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
  | TypeEvenementIdentite
  | TypeEvenementDecision
  | TypeEvenementReproduction
  | TypeEvenementReproductionAutonome
  | TypeEvenementMutation;

export type EntreeEvenementEsp =
  | EntreeEvenementEconomique
  | EntreeEvenementExperience
  | EntreeEvenementXway
  | EntreeEvenementIdentite
  | EntreeEvenementDecision
  | EntreeEvenementReproduction
  | EntreeEvenementReproductionAutonome
  | EntreeEvenementMutation;

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
    estTypeEvenementIdentite(valeur) ||
    estTypeEvenementDecision(valeur) ||
    estTypeEvenementReproduction(valeur) ||
    estTypeEvenementReproductionAutonome(valeur) ||
    estTypeEvenementMutation(valeur)
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

export function estEvenementDecision(
  evenement: EvenementEsp,
): evenement is EvenementEsp & { type: TypeEvenementDecision } {
  return estTypeEvenementDecision(evenement.type);
}

export function filtrerEvenementsDecision(
  evenements: readonly EvenementEsp[],
): Array<EvenementEsp & { type: TypeEvenementDecision }> {
  return evenements.filter(estEvenementDecision);
}
