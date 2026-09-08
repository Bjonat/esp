import type { MicroUsdc } from "./monnaie.js";
import type { ActionEnvironnementDecision } from "./observation-agent.js";

/**
 * Source d'une décision agent — jamais d'exécution directe par le LLM.
 */
export type SourceDecisionAgent =
  | "sans_inference"
  | "inference_xway"
  | "repli_echec_cognitif"
  | "proposition_invalide_repli";

/**
 * Décision agent validée localement — objet métier explicite.
 * Le LLM produit une PROPOSITION ; seule une DecisionAgent validée peut agir.
 */
export type DecisionAgent = {
  readonly identifiantDecision: string;
  readonly identifiantObservation: string;
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly action: ActionEnvironnementDecision;
  /** Confiance normalisée en points de base (0–10_000). */
  readonly confianceBps: number;
  readonly resume: string;
  readonly sourceDecision: SourceDecisionAgent;
  readonly identifiantDemandeXway?: string;
  readonly coutCognitifMicroUsdc: MicroUsdc;
  readonly modeleLogique?: string;
};

/**
 * Proposition structurée issue d'une inférence — avant validation.
 */
export type PropositionDecision = {
  readonly action: string;
  readonly confianceBps: number;
  readonly resume: string;
};

/**
 * Choix cognitif (hors protocole économique fondamental).
 */
export type ChoixCognitifAgent = {
  readonly utiliserInference: boolean;
  readonly modeleLogique: string | null;
  readonly limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
  readonly motif: string;
};
