/**
 * Configuration héritable d'un agent — frontière d'héritabilité v0.1.
 *
 * Distincte de : constitution/protocole, état économique, mémoire,
 * secrets, identité cryptographique.
 *
 * Reproduction : copie parent → enfant, puis mutation optionnelle
 * (voir appliquerMutationConfigurationHeritable) — parent immuable.
 */

export const VERSION_CONFIGURATION_HERITABLE =
  "configuration-heritable-v01" as const;

/**
 * Paramètres comportementaux héritables (extensible).
 * v0.1 : structure minimale ; mutation via catalogue gènes mutables.
 */
export type ConfigurationHeritableAgent = {
  readonly version: typeof VERSION_CONFIGURATION_HERITABLE;
  /**
   * Paramètres expérimentaux héritables (chaînes / nombres / booléens uniquement).
   * Pas de secrets, pas de clés, pas d'état économique.
   */
  readonly parametres: Readonly<Record<string, string | number | boolean>>;
};

export function creerConfigurationHeritableVide(): ConfigurationHeritableAgent {
  return {
    version: VERSION_CONFIGURATION_HERITABLE,
    parametres: {},
  };
}

/** Copie exacte — le parent n'est jamais muté en place. */
export function copierConfigurationHeritable(
  source: ConfigurationHeritableAgent,
): ConfigurationHeritableAgent {
  return {
    version: source.version,
    parametres: { ...source.parametres },
  };
}

export function serialiserConfigurationHeritable(
  configuration: ConfigurationHeritableAgent,
): Readonly<Record<string, unknown>> {
  return {
    version: configuration.version,
    parametres: { ...configuration.parametres },
  };
}

export function parserConfigurationHeritable(
  brut: unknown,
): ConfigurationHeritableAgent {
  if (brut === null || typeof brut !== "object") {
    return creerConfigurationHeritableVide();
  }
  const objet = brut as Record<string, unknown>;
  if (objet.version !== VERSION_CONFIGURATION_HERITABLE) {
    return creerConfigurationHeritableVide();
  }
  const parametresBruts = objet.parametres;
  const parametres: Record<string, string | number | boolean> = {};
  if (parametresBruts !== null && typeof parametresBruts === "object") {
    for (const [cle, valeur] of Object.entries(
      parametresBruts as Record<string, unknown>,
    )) {
      if (
        typeof valeur === "string" ||
        typeof valeur === "number" ||
        typeof valeur === "boolean"
      ) {
        parametres[cle] = valeur;
      }
    }
  }
  return {
    version: VERSION_CONFIGURATION_HERITABLE,
    parametres,
  };
}
