import { SCHEMA_PROPOSITION_COGNITIVE_V01 } from "./schema-proposition.js";
import type { RequeteResponsesInterne } from "./client-responses.js";

/**
 * Effort de raisonnement documenté pour gpt-5.6-luna (API OpenAI).
 * Source : documentation modèle Luna — none | low | medium | high | xhigh | max.
 *
 * Écart SDK openai@5.x : le type `ReasoningEffort` du paquet npm n'inclut que
 * `minimal | low | medium | high | null` — il ne reflète pas encore l'API Luna.
 * Nous construisons donc le corps HTTP à la frontière adaptateur avec la valeur
 * API réelle `"none"`, et l'envoyons via `client.post("/responses", …)` plutôt
 * que via `responses.create` typé trop étroitement.
 */
export type EffortRaisonnementApiLuna =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/** Effort v0.1 — minimiser coût et complexité du premier test. */
export const EFFORT_RAISONNEMENT_LUNA_V01 = "none" as const satisfies EffortRaisonnementApiLuna;

export const NOM_SCHEMA_PROPOSITION_COGNITIVE_V01 =
  "proposition_cognitive_esp_v01" as const;

/**
 * Corps HTTP exact destiné à POST /v1/responses.
 * Reflète la syntaxe Responses API (text.format json_schema), pas les types SDK.
 */
export type CorpsRequeteResponsesApi = {
  readonly model: string;
  readonly input: readonly {
    readonly role: "system" | "user" | "assistant";
    readonly content: string;
  }[];
  readonly max_output_tokens: number;
  readonly store: false;
  readonly tools: readonly [];
  readonly reasoning: {
    readonly effort: typeof EFFORT_RAISONNEMENT_LUNA_V01;
  };
  readonly text: {
    readonly format: {
      readonly type: "json_schema";
      readonly name: typeof NOM_SCHEMA_PROPOSITION_COGNITIVE_V01;
      readonly strict: true;
      readonly schema: typeof SCHEMA_PROPOSITION_COGNITIVE_V01;
    };
  };
  readonly metadata?: {
    readonly esp_idempotence: string;
  };
};

/**
 * Construit le payload exact envoyé à l'API Responses.
 * Point unique de vérité pour les tests de non-régression du câblage OpenAI.
 */
export function construireCorpsRequeteResponses(
  requete: RequeteResponsesInterne,
): CorpsRequeteResponsesApi {
  return {
    model: requete.modeleExterne,
    input: requete.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_output_tokens: requete.maxOutputTokens,
    store: false,
    tools: [],
    reasoning: { effort: EFFORT_RAISONNEMENT_LUNA_V01 },
    text: {
      format: {
        type: "json_schema",
        name: NOM_SCHEMA_PROPOSITION_COGNITIVE_V01,
        strict: true,
        schema: SCHEMA_PROPOSITION_COGNITIVE_V01,
      },
    },
    ...(requete.cleIdempotence !== undefined
      ? { metadata: { esp_idempotence: requete.cleIdempotence } }
      : {}),
  };
}
