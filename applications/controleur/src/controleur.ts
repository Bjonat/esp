import type { EnvironnementEconomique } from "@esp/environnement";
import { creerEnvironnementInactif } from "@esp/environnement";
import type { RegistreEvenements } from "@esp/registre-evenements";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";

/**
 * Contrôleur d'expérience minimal.
 * Gère la configuration et l'observation ; pas encore de population active.
 */
export interface ControleurExperience {
  readonly population: number;
  readonly generationMaximale: number;
  readonly environnement: EnvironnementEconomique;
  readonly registre: RegistreEvenements;
  readonly mode: "developpement" | "experience";
  resumeObservation(): ResumeObservation;
}

export interface ResumeObservation {
  readonly statut: string;
  readonly population: number;
  readonly generation: number;
  readonly environnement: string;
  readonly mode: string;
}

export type OptionsControleur = {
  environnement?: EnvironnementEconomique;
  registre?: RegistreEvenements;
  mode?: "developpement" | "experience";
};

export function creerControleurExperience(
  options: OptionsControleur = {},
): ControleurExperience {
  const environnement =
    options.environnement ?? creerEnvironnementInactif();
  const registre = options.registre ?? creerRegistreEvenementsMemoire();
  const mode = options.mode ?? "developpement";

  return {
    population: 0,
    generationMaximale: 0,
    environnement,
    registre,
    mode,
    resumeObservation() {
      return {
        statut: "Fondations",
        population: 0,
        generation: 0,
        environnement: environnement.statut().description,
        mode: mode === "developpement" ? "Développement" : "Expérience",
      };
    },
  };
}
