import {
  creerFournisseurInferenceOpenAi,
  type FournisseurInferenceOpenAi,
} from "@esp/adaptateur-openai";
import type { ConfigurationXway, FournisseurInference } from "@esp/xway";
import { creerFournisseurInferenceSimule } from "@esp/xway";

/**
 * Fabrique le fournisseur selon la config figée.
 * OpenAI : opt-in explicite + clé env ; jamais par défaut.
 */
export function fabriquerFournisseurInference(
  configuration: ConfigurationXway,
  options?: {
    /** Injection tests — faux client OpenAI. */
    readonly fournisseurInjecte?: FournisseurInference;
  },
): FournisseurInference {
  if (options?.fournisseurInjecte !== undefined) {
    return options.fournisseurInjecte;
  }

  if (configuration.fournisseur.selecteur === "openai") {
    if (configuration.baremeCoutInference === undefined) {
      throw new Error(
        "baremeCoutInference requis pour fournisseur openai",
      );
    }
    return creerFournisseurInferenceOpenAi({
      bareme: configuration.baremeCoutInference,
      ...(configuration.timeoutInferenceMs !== undefined
        ? { timeoutMs: configuration.timeoutInferenceMs }
        : {}),
    });
  }

  return creerFournisseurInferenceSimule();
}

export function estFournisseurOpenaiReel(
  configuration: ConfigurationXway | undefined,
): boolean {
  return configuration?.fournisseur.selecteur === "openai";
}

export type { FournisseurInferenceOpenAi };
