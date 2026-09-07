import { describe, expect, it } from "vitest";

/**
 * Smoke test manuel OpenAI — IGNORÉ par défaut.
 * Ne s'exécute que si OPENAI_API_KEY et ESP_SMOKE_OPENAI=1.
 * Jamais dans pnpm test CI.
 */
const actif =
  process.env.ESP_SMOKE_OPENAI === "1" &&
  typeof process.env.OPENAI_API_KEY === "string" &&
  process.env.OPENAI_API_KEY.length > 0;

describe.skipIf(!actif)("smoke OpenAI réel (manuel)", () => {
  it("appelle Responses API une fois via adaptateur", async () => {
    const { creerFournisseurInferenceOpenAi } = await import(
      "@esp/adaptateur-openai"
    );
    const { BAREME_OPENAI_LUNA_V01, TARIF_LUNA_REEL_V01 } = await import(
      "@esp/xway"
    );
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      timeoutMs: 30_000,
    });
    expect(fournisseur.estDisponible()).toBe(true);
    const reponse = await fournisseur.inferer(
      {
        identifiantDemande: "smoke-manuel-001",
        identifiantExperience: "smoke",
        identifiantAgent: "agent-smoke",
        numeroCycle: 1,
        modeleDemande: "luna_reel_v01",
        messages: [
          {
            role: "systeme",
            contenu:
              'Réponds uniquement JSON {"resume":"...","actionProposee":"attendre","confiance":0.5}',
          },
          {
            role: "utilisateur",
            contenu: 'Observation: {"cycle":1,"etatSurvie":"sain"}',
          },
        ],
        nombreMaxJetonsSortie: 64,
        limiteDepenseAutoriseeMicroUsdc: 50_000n,
      },
      TARIF_LUNA_REEL_V01,
    );
    expect(reponse.usage.jetonsEntree).toBeGreaterThan(0);
    expect(reponse.coutFournisseurEstimeMicroUsd).toBeDefined();
  });
});
