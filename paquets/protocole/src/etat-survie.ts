/**
 * États de survie d'un agent ESP.
 *
 * Un agent dans l'état `mort` ne peut plus passer à un état vivant
 * dans une expérience conforme.
 */
export const ETATS_SURVIE = [
  "sain",
  "contraint",
  "critique",
  "dormant",
  "mort",
] as const;

export type EtatSurvie = (typeof ETATS_SURVIE)[number];

/** États considérés comme vivants (non morts). */
export const ETATS_VIVANTS = [
  "sain",
  "contraint",
  "critique",
  "dormant",
] as const satisfies readonly EtatSurvie[];

export type EtatVivant = (typeof ETATS_VIVANTS)[number];

export function estEtatVivant(etat: EtatSurvie): etat is EtatVivant {
  return etat !== "mort";
}

export function estEtatMort(etat: EtatSurvie): etat is "mort" {
  return etat === "mort";
}

/**
 * Indique si une transition d'état de survie est autorisée.
 * Invariant : un agent mort ne peut pas revenir vers un état vivant.
 */
export function peutTransitionnerEtatSurvie(
  depuis: EtatSurvie,
  vers: EtatSurvie,
): boolean {
  if (depuis === vers) {
    return true;
  }

  if (estEtatMort(depuis) && estEtatVivant(vers)) {
    return false;
  }

  return true;
}

export class TransitionEtatSurvieInvalideErreur extends Error {
  readonly depuis: EtatSurvie;
  readonly vers: EtatSurvie;

  constructor(depuis: EtatSurvie, vers: EtatSurvie) {
    super(
      `Transition d'état de survie interdite : ${depuis} -> ${vers}. Un agent mort ne peut pas revenir vers un état vivant.`,
    );
    this.name = "TransitionEtatSurvieInvalideErreur";
    this.depuis = depuis;
    this.vers = vers;
  }
}

/**
 * Applique une transition d'état de survie en respectant l'invariant de mortalité.
 * @throws {TransitionEtatSurvieInvalideErreur} si la transition est interdite
 */
export function transitionnerEtatSurvie(
  depuis: EtatSurvie,
  vers: EtatSurvie,
): EtatSurvie {
  if (!peutTransitionnerEtatSurvie(depuis, vers)) {
    throw new TransitionEtatSurvieInvalideErreur(depuis, vers);
  }

  return vers;
}
