/**
 * Critères d'arrêt expérimentaux v0.1 — contrôleur d'expérience.
 *
 * Responsabilité : « l'expérience continue-t-elle ? »
 * Distinct de la politique de reproduction (« cet agent peut-il se reproduire ? »).
 *
 * Figés dans EXPERIENCE_CREEE. Absents = aucun plafond de cycles.
 */

export const VERSION_CRITERES_ARRET_EXPERIENCE =
  "criteres-arret-experience-v01" as const;

export type CriteresArretExperience = {
  readonly version: typeof VERSION_CRITERES_ARRET_EXPERIENCE;
  /**
   * Plafond de cycles d'expérience.
   * Absent / undefined = pas de limite.
   * Atteint (numeroCycle >= cycleMaximum) → EXPERIENCE_TERMINEE.
   */
  readonly cycleMaximum?: number;
};

export type CriteresArretExperienceJson = {
  readonly version: string;
  readonly cycleMaximum?: number;
};

export class CriteresArretExperienceInvalidesErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriteresArretExperienceInvalidesErreur";
  }
}

export function parserCriteresArretExperience(
  brut: CriteresArretExperienceJson,
): CriteresArretExperience {
  if (brut.version !== VERSION_CRITERES_ARRET_EXPERIENCE) {
    throw new CriteresArretExperienceInvalidesErreur(
      `version critères d'arrêt attendue ${VERSION_CRITERES_ARRET_EXPERIENCE}, reçu ${brut.version}`,
    );
  }
  if (brut.cycleMaximum !== undefined) {
    if (
      typeof brut.cycleMaximum !== "number" ||
      !Number.isInteger(brut.cycleMaximum) ||
      brut.cycleMaximum < 1
    ) {
      throw new CriteresArretExperienceInvalidesErreur(
        "cycleMaximum doit être un entier >= 1 lorsqu'il est fourni",
      );
    }
  }
  return {
    version: VERSION_CRITERES_ARRET_EXPERIENCE,
    ...(brut.cycleMaximum !== undefined
      ? { cycleMaximum: brut.cycleMaximum }
      : {}),
  };
}

export function serialiserCriteresArretExperience(
  criteres: CriteresArretExperience,
): CriteresArretExperienceJson {
  return {
    version: criteres.version,
    ...(criteres.cycleMaximum !== undefined
      ? { cycleMaximum: criteres.cycleMaximum }
      : {}),
  };
}

/** Indique si le cycle courant doit clôturer l'expérience. */
export function doitTerminerExperienceApresCycle(options: {
  readonly criteresArret: CriteresArretExperience | undefined;
  readonly numeroCycle: number;
}): boolean {
  const plafond = options.criteresArret?.cycleMaximum;
  if (plafond === undefined) {
    return false;
  }
  return options.numeroCycle >= plafond;
}
