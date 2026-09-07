import { describe, expect, it } from "vitest";
import {
  EFFORT_RAISONNEMENT_LUNA_V01,
  NOM_SCHEMA_PROPOSITION_COGNITIVE_V01,
  SCHEMA_PROPOSITION_COGNITIVE_V01,
  construireCorpsRequeteResponses,
  creerClientResponsesOpenAi,
  type CorpsRequeteResponsesApi,
  type EnvoyeurResponsesOpenAi,
} from "../src/index.js";
import {
  BAREME_OPENAI_LUNA_V01,
  TARIF_LUNA_REEL_V01,
  calculerCoutFournisseurEstimeMicroUsd,
  calculerCoutUsageMicroUsdc,
} from "@esp/xway";

describe("Adaptateur OpenAI — payload Responses API", () => {
  it("construit reasoning.effort = none (API Luna, pas minimal legacy)", () => {
    const corps = construireCorpsRequeteResponses({
      modeleExterne: "gpt-5.6-luna",
      messages: [{ role: "user", content: "ping" }],
      maxOutputTokens: 64,
      timeoutMs: 1_000,
    });
    expect(EFFORT_RAISONNEMENT_LUNA_V01).toBe("none");
    expect(corps.reasoning).toEqual({ effort: "none" });
    expect(corps.reasoning.effort).not.toBe("minimal");
  });

  it("construit text.format json_schema strict selon la syntaxe Responses API", () => {
    const corps = construireCorpsRequeteResponses({
      modeleExterne: "gpt-5.6-luna",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "obs" },
      ],
      maxOutputTokens: 128,
      timeoutMs: 5_000,
      cleIdempotence: "dem-001",
    });

    expect(corps.store).toBe(false);
    expect(corps.tools).toEqual([]);
    expect(corps.max_output_tokens).toBe(128);
    expect(corps.model).toBe("gpt-5.6-luna");
    expect(corps.metadata).toEqual({ esp_idempotence: "dem-001" });

    // Syntaxe documentée : text.format = { type, name, schema, strict }
    expect(corps.text.format.type).toBe("json_schema");
    expect(corps.text.format.name).toBe(NOM_SCHEMA_PROPOSITION_COGNITIVE_V01);
    expect(corps.text.format.strict).toBe(true);
    expect(corps.text.format.schema).toEqual(SCHEMA_PROPOSITION_COGNITIVE_V01);
    expect(corps.text.format.schema.additionalProperties).toBe(false);
    expect(corps.text.format.schema.required).toEqual([
      "resume",
      "actionProposee",
      "confiance",
    ]);
  });

  it("envoie exactement ce corps à l'envoyeur (frontière SDK inspectable)", async () => {
    const corpsCaptures: CorpsRequeteResponsesApi[] = [];
    const envoyeur: EnvoyeurResponsesOpenAi = {
      async envoyer(corps) {
        corpsCaptures.push(corps);
        return {
          id: "resp_test",
          model: "gpt-5.6-luna",
          status: "completed",
          output_text: JSON.stringify({
            resume: "ok",
            actionProposee: "attendre",
            confiance: 0.4,
          }),
          usage: {
            input_tokens: 40,
            output_tokens: 20,
            input_tokens_details: { cached_tokens: 5 },
          },
        };
      },
    };

    const client = creerClientResponsesOpenAi({
      cleApi: "test-non-utilise",
      envoyeur,
    });

    await client.creer({
      modeleExterne: "gpt-5.6-luna",
      messages: [{ role: "user", content: "hello" }],
      maxOutputTokens: 64,
      timeoutMs: 2_000,
      cleIdempotence: "idemp-xyz",
    });

    expect(corpsCaptures).toHaveLength(1);
    const envoyé = corpsCaptures[0]!;
    expect(envoyé).toEqual(
      construireCorpsRequeteResponses({
        modeleExterne: "gpt-5.6-luna",
        messages: [{ role: "user", content: "hello" }],
        maxOutputTokens: 64,
        timeoutMs: 2_000,
        cleIdempotence: "idemp-xyz",
      }),
    );
    expect(envoyé.reasoning.effort).toBe("none");
    expect(envoyé.text.format).toMatchObject({
      type: "json_schema",
      name: "proposition_cognitive_esp_v01",
      strict: true,
    });
  });
});

describe("Adaptateur OpenAI — jetons cachés / barème", () => {
  it("n'impute pas deux fois les cached_tokens côté agent", () => {
    const jetonsEntree = 100;
    const jetonsCache = 40;
    const jetonsSortie = 50;

    const avecCache = calculerCoutUsageMicroUsdc(
      jetonsEntree,
      jetonsSortie,
      TARIF_LUNA_REEL_V01,
      jetonsCache,
    );
    const sansParamCache = calculerCoutUsageMicroUsdc(
      jetonsEntree,
      jetonsSortie,
      TARIF_LUNA_REEL_V01,
      0,
    );
    // Même total entrée → même coût agent (cache ⊆ entrée, tarif unique).
    expect(avecCache).toBe(sansParamCache);

    // Double comptage interdit : entrée + cache séparément serait plus cher.
    const doubleCompteInterdit = calculerCoutUsageMicroUsdc(
      jetonsEntree + jetonsCache,
      jetonsSortie,
      TARIF_LUNA_REEL_V01,
      0,
    );
    expect(avecCache).toBeLessThan(doubleCompteInterdit);
  });

  it("distingue le tarif cache dans l'estimation fournisseur (barème figé)", () => {
    const jetonsEntree = 100;
    const jetonsCache = 40;
    const jetonsSortie = 50;

    const avecDistinction = calculerCoutFournisseurEstimeMicroUsd({
      jetonsEntree,
      jetonsSortie,
      jetonsEntreeCache: jetonsCache,
      bareme: BAREME_OPENAI_LUNA_V01,
    });

    const toutAuTarifEntree = calculerCoutFournisseurEstimeMicroUsd({
      jetonsEntree,
      jetonsSortie,
      jetonsEntreeCache: 0,
      bareme: BAREME_OPENAI_LUNA_V01,
    });

    // Cache facturé au tarif cache (plus bas) → estimation inférieure.
    expect(avecDistinction).toBeLessThan(toutAuTarifEntree);

    const nonCache = 60n;
    const attendu =
      (nonCache * BAREME_OPENAI_LUNA_V01.coutParMillionJetonsEntreeMicroUsd) /
        1_000_000n +
      (40n * BAREME_OPENAI_LUNA_V01.coutParMillionJetonsEntreeCacheMicroUsd) /
        1_000_000n +
      (50n * BAREME_OPENAI_LUNA_V01.coutParMillionJetonsSortieMicroUsd) /
        1_000_000n;
    expect(avecDistinction).toBe(attendu);
  });
});
