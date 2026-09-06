export const VERSION_CONFIGURATION_IDENTITE = "0.1.0" as const;

export type ConfigurationIdentiteJson = {
  readonly active: boolean;
  readonly algorithme: "ed25519";
  readonly version: string;
};

export type ConfigurationIdentite = {
  readonly active: boolean;
  readonly algorithme: "ed25519";
  readonly version: string;
};

export function parserConfigurationIdentite(
  brut: ConfigurationIdentiteJson,
): ConfigurationIdentite {
  if (brut.algorithme !== "ed25519") {
    throw new Error(`Algorithme d'identité non supporté : ${String(brut.algorithme)}`);
  }
  if (typeof brut.active !== "boolean") {
    throw new Error("identite.active doit être un booléen");
  }
  if (typeof brut.version !== "string" || brut.version.trim() === "") {
    throw new Error("identite.version requise");
  }
  return {
    active: brut.active,
    algorithme: "ed25519",
    version: brut.version,
  };
}

export function serialiserConfigurationIdentite(
  configuration: ConfigurationIdentite,
): ConfigurationIdentiteJson {
  return {
    active: configuration.active,
    algorithme: configuration.algorithme,
    version: configuration.version,
  };
}
