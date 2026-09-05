export type {
  Agent,
  EntreeCreationAgent,
} from "./agent.js";
export { creerAgent } from "./agent.js";

export type { EtatSurvie, EtatVivant } from "./etat-survie.js";
export {
  ETATS_SURVIE,
  ETATS_VIVANTS,
  TransitionEtatSurvieInvalideErreur,
  estEtatMort,
  estEtatVivant,
  peutTransitionnerEtatSurvie,
  transitionnerEtatSurvie,
} from "./etat-survie.js";
