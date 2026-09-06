import type {
  EntreeEvenementEsp,
  EvenementEsp,
} from "@esp/protocole";
import { VERSION_SCHEMA_EVENEMENT } from "@esp/protocole";

/**
 * Événement du registre — enveloppe ESP (économique + contrôle d'expérience).
 * Une fois enregistré, un événement est immuable (ESP-ECO-003).
 */
export type Evenement = EvenementEsp;

/**
 * Entrée avant persistance : sans `sequence`.
 * La séquence est attribuée par le registre, monotone par expérience.
 */
export type EntreeEvenement = EntreeEvenementEsp;

export interface RegistreEvenements {
  /**
   * Insère un événement et lui attribue la prochaine séquence
   * monotone de son expérience (1, 2, 3, …).
   */
  ajouter(entree: EntreeEvenement): Evenement;
  /** Prochaine séquence qui serait attribuée pour l'expérience. */
  consulterProchaineSequence(identifiantExperience: string): number;
  lister(): readonly Evenement[];
  listerParAgent(identifiantAgent: string): readonly Evenement[];
  listerParExperience(identifiantExperience: string): readonly Evenement[];
  listerParCycle(
    identifiantExperience: string,
    numeroCycle: number,
  ): readonly Evenement[];
  taille(): number;
}

/**
 * Figement profond : copie structurelle puis Object.freeze récursif.
 * Protège contre les mutations imbriquées de la charge utile (scénario G).
 */
export function figerProfondement<T>(valeur: T): T {
  const copie = structuredClone(valeur);
  return figerRecursif(copie);
}

function figerRecursif<T>(valeur: T): T {
  if (valeur === null || typeof valeur !== "object") {
    return valeur;
  }

  if (Array.isArray(valeur)) {
    for (const element of valeur) {
      figerRecursif(element);
    }
    return Object.freeze(valeur);
  }

  for (const cle of Reflect.ownKeys(valeur)) {
    const enregistrement = valeur as Record<PropertyKey, unknown>;
    figerRecursif(enregistrement[cle]);
  }

  return Object.freeze(valeur);
}

export function normaliserEntreeEvenement(
  entree: EntreeEvenement,
  sequence: number,
): Evenement {
  return figerProfondement({
    identifiant: entree.identifiant,
    versionSchema: entree.versionSchema ?? VERSION_SCHEMA_EVENEMENT,
    type: entree.type,
    identifiantExperience: entree.identifiantExperience,
    numeroCycle: entree.numeroCycle,
    sequence,
    chargeUtile: figerProfondement(entree.chargeUtile ?? {}),
    ...(entree.identifiantAgent !== undefined
      ? { identifiantAgent: entree.identifiantAgent }
      : {}),
    ...(entree.dateEnregistrement !== undefined
      ? { dateEnregistrement: entree.dateEnregistrement }
      : {}),
  });
}
