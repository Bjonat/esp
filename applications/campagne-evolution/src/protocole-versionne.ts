/**
 * Dispatch versionné des protocoles campagne évolution (v0.1 | v0.2 | v0.3).
 */

import { ProtocoleEvolutionInvalideErreur } from "./protocole-evolution.js";
import {
  chargerProtocoleEvolutionDepuisObjet,
  empreinteProtocole,
  type ProtocoleExperienceEvolutionV01,
} from "./protocole-evolution.js";
import {
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION,
} from "./protocole-evolution.js";
import {
  chargerProtocoleEvolutionV02DepuisObjet,
  empreinteProtocoleV02,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
  type ProtocoleExperienceEvolutionV02,
} from "./protocole-evolution-v02.js";
import {
  chargerProtocoleEvolutionV03DepuisObjet,
  empreinteProtocoleV03,
  VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03,
  type ProtocoleExperienceEvolutionV03,
} from "./protocole-evolution-v03.js";
import { fabriquerConfigurationRun } from "./conditions.js";
import { fabriquerConfigurationRunV02 } from "./conditions-v02.js";
import { fabriquerConfigurationRunV03 } from "./conditions-v03.js";
import type { ConditionEvolution } from "./protocole-evolution.js";
import type { ConfigurationExperienceJson } from "@esp/controleur";
import { assertPreflightEvolutionV02OuEchouer } from "./preflight-evolution-v02.js";
import { assertPreflightEvolutionV03OuEchouer } from "./preflight-evolution-v03.js";

export type ProtocoleCampagneEvolution =
  | ProtocoleExperienceEvolutionV01
  | ProtocoleExperienceEvolutionV02
  | ProtocoleExperienceEvolutionV03;

export function estProtocoleEvolutionV03(
  protocole: ProtocoleCampagneEvolution,
): protocole is ProtocoleExperienceEvolutionV03 {
  return protocole.version === VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03;
}

export function estProtocoleEvolutionV02(
  protocole: ProtocoleCampagneEvolution,
): protocole is ProtocoleExperienceEvolutionV02 {
  return protocole.version === VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02;
}

export function estProtocoleEvolutionV01(
  protocole: ProtocoleCampagneEvolution,
): protocole is ProtocoleExperienceEvolutionV01 {
  return protocole.version === VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION;
}

/**
 * Charge un protocole selon sa version déclarée (fail closed).
 */
export function chargerProtocoleCampagneEvolutionDepuisObjet(
  brut: unknown,
): ProtocoleCampagneEvolution {
  if (typeof brut !== "object" || brut === null) {
    throw new ProtocoleEvolutionInvalideErreur("protocole JSON objet requis");
  }
  const version = (brut as { version?: unknown }).version;
  if (version === VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V03) {
    return chargerProtocoleEvolutionV03DepuisObjet(brut);
  }
  if (version === VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02) {
    return chargerProtocoleEvolutionV02DepuisObjet(brut);
  }
  if (version === VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION) {
    return chargerProtocoleEvolutionDepuisObjet(brut);
  }
  throw new ProtocoleEvolutionInvalideErreur(
    `version protocole inconnue : ${String(version)} (attendu v01, v02 ou v03)`,
  );
}

export function empreinteProtocoleCampagne(
  protocole: ProtocoleCampagneEvolution,
): string {
  if (estProtocoleEvolutionV03(protocole)) {
    return empreinteProtocoleV03(protocole);
  }
  if (estProtocoleEvolutionV02(protocole)) {
    return empreinteProtocoleV02(protocole);
  }
  return empreinteProtocole(protocole);
}

export function fabriquerConfigurationRunCampagne(
  protocole: ProtocoleCampagneEvolution,
  condition: ConditionEvolution,
  seed: number,
): ConfigurationExperienceJson {
  if (estProtocoleEvolutionV03(protocole)) {
    return fabriquerConfigurationRunV03(protocole, condition, seed);
  }
  if (estProtocoleEvolutionV02(protocole)) {
    return fabriquerConfigurationRunV02(protocole, condition, seed);
  }
  return fabriquerConfigurationRun(protocole, condition, seed);
}

export function preparerCampagneEvolution(
  protocole: ProtocoleCampagneEvolution,
): void {
  if (estProtocoleEvolutionV03(protocole)) {
    assertPreflightEvolutionV03OuEchouer(protocole);
    return;
  }
  if (estProtocoleEvolutionV02(protocole)) {
    assertPreflightEvolutionV02OuEchouer(protocole);
  }
}
