import type { IdentifiantModeleInference } from "@esp/xway";

/**
 * ============================================================================
 * POLITIQUE COGNITIVE DE DÉVELOPPEMENT
 * ============================================================================
 * Décide de façon DÉTERMINISTE si un agent tente une inférence Xway
 * et quel modèle demander. Hors protocole. Remplaçable par le moteur agent.
 */

export type DecisionCognitiveDeveloppement =
  | { readonly action: "aucun" }
  | { readonly action: "appeler"; readonly modele: IdentifiantModeleInference };

export function deciderPolitiqueCognitiveDeveloppement(options: {
  readonly graineSimulation: number;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
}): DecisionCognitiveDeveloppement {
  const graine = melanger(
    options.graineSimulation,
    options.identifiantAgent,
    options.numeroCycle,
  );
  const reste = graine % 4;
  if (reste === 0) {
    return { action: "aucun" };
  }
  if (reste === 1) {
    return { action: "appeler", modele: "modele_economique" };
  }
  if (reste === 2) {
    return { action: "appeler", modele: "modele_standard" };
  }
  return { action: "appeler", modele: "modele_premium" };
}

function melanger(
  graineSimulation: number,
  identifiantAgent: string,
  numeroCycle: number,
): number {
  let hachage = (graineSimulation >>> 0) ^ 0x9e3779b9;
  for (let index = 0; index < identifiantAgent.length; index += 1) {
    hachage ^= identifiantAgent.charCodeAt(index);
    hachage = Math.imul(hachage, 16777619);
  }
  hachage ^= Math.imul(numeroCycle, 0x85ebca6b);
  return hachage >>> 0;
}
