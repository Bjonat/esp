/**
 * Schéma JSON strict pour sortie structurée Responses API.
 * Reste à la frontière adaptateur — non exporté comme type OpenAI.
 */
export const SCHEMA_PROPOSITION_COGNITIVE_V01 = {
  type: "object",
  additionalProperties: false,
  properties: {
    resume: { type: "string" },
    actionProposee: { type: "string", enum: ["attendre", "agir"] },
    confiance: { type: "number" },
  },
  required: ["resume", "actionProposee", "confiance"],
} as const;
