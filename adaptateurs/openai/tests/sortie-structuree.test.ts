import { describe, expect, it } from "vitest";
import {
  SCHEMA_PROPOSITION_COGNITIVE_V01,
  construireCorpsRequeteResponses,
  creerClientResponsesOpenAi,
  creerFournisseurInferenceOpenAi,
  extraireTexteOutputResponses,
  interpreterPropositionDepuisReponse,
  type ClientResponsesOpenAi,
  type CorpsRequeteResponsesApi,
  type EnvoyeurResponsesOpenAi,
  type MetadonneesReponseResponses,
  type ReponseResponsesInterne,
} from "../src/index.js";
import {
  BAREME_OPENAI_LUNA_V01,
  TARIF_LUNA_REEL_V01,
  creerConfigurationXwayOpenaiDemonstration,
  creerPasserelleXway,
  MODELE_LOGIQUE_LUNA_REEL_V01,
  type DemandeInference,
} from "@esp/xway";

const TEXTE_VALIDE = JSON.stringify({
  resume: "observation minimale",
  actionProposee: "attendre",
  confiance: 0.4,
});

function metadonneesBase(
  surcharges: Partial<MetadonneesReponseResponses> = {},
): MetadonneesReponseResponses {
  return {
    id: "resp_test",
    statut: "completed",
    statutBrut: "completed",
    incompleteDetails: null,
    modele: "gpt-5.6-luna",
    longueurOutputText: TEXTE_VALIDE.length,
    typesOutputItems: ["message"],
    typesContent: ["output_text"],
    presenceRefusal: false,
    inputTokens: 100,
    cachedTokens: 0,
    outputTokens: 40,
    reasoningTokens: 0,
    ...surcharges,
  };
}

function reponseInterne(
  surcharges: Partial<ReponseResponsesInterne> & {
    readonly texte?: string;
  } = {},
): ReponseResponsesInterne {
  const texte = surcharges.texte ?? TEXTE_VALIDE;
  const meta = surcharges.metadonnees ?? metadonneesBase({
    longueurOutputText: texte.length,
  });
  return {
    id: surcharges.id ?? meta.id,
    modeleEffectif: surcharges.modeleEffectif ?? "gpt-5.6-luna",
    statutOpenAi: surcharges.statutOpenAi ?? meta.statut,
    statut:
      surcharges.statut ??
      (meta.statut === "completed"
        ? "complete"
        : meta.statut === "incomplete"
          ? "incomplete"
          : "echec"),
    texte,
    usage: surcharges.usage ?? {
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      cachedInputTokens: meta.cachedTokens,
      reasoningTokens: meta.reasoningTokens,
    },
    incompleteDetails: surcharges.incompleteDetails ?? meta.incompleteDetails,
    presenceRefusal: surcharges.presenceRefusal ?? meta.presenceRefusal,
    metadonnees: meta,
    texteBrutDiagnostic: texte,
  };
}

function clientDepuisReponse(
  fabriquer: () => ReponseResponsesInterne,
  compteur?: { appels: number },
): ClientResponsesOpenAi {
  return {
    async creer() {
      if (compteur !== undefined) {
        compteur.appels += 1;
      }
      return fabriquer();
    },
  };
}

function demande(): DemandeInference {
  return {
    identifiantDemande: "dem-sortie-001",
    identifiantExperience: "exp-sortie",
    identifiantAgent: "agent-a",
    numeroCycle: 1,
    modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
    messages: [
      { role: "systeme", contenu: "sys" },
      { role: "utilisateur", contenu: "obs" },
    ],
    nombreMaxJetonsSortie: 128,
    limiteDepenseAutoriseeMicroUsdc: 1_000_000n,
  };
}

describe("Sortie structurée OpenAI — sans réseau", () => {
  it("A — completed + structured output valide → proposition valide", async () => {
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client: clientDepuisReponse(() => reponseInterne()),
    });
    const reponse = await fournisseur.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(reponse.etatResultatFournisseur).toBe(
      "resultat_fournisseur_complet",
    );
    expect(reponse.propositionStructuree?.valide).toBe(true);
    expect(reponse.propositionStructuree?.actionProposee).toBe("attendre");
  });

  it("B — incomplete + max_output_tokens → non actionnable, état explicite", async () => {
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client: clientDepuisReponse(() =>
        reponseInterne({
          texte: '{"resume":"tronq',
          statutOpenAi: "incomplete",
          statut: "incomplete",
          incompleteDetails: { reason: "max_output_tokens" },
          metadonnees: metadonneesBase({
            statut: "incomplete",
            statutBrut: "incomplete",
            incompleteDetails: { reason: "max_output_tokens" },
            longueurOutputText: 16,
          }),
        }),
      ),
    });
    const reponse = await fournisseur.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(reponse.etatResultatFournisseur).toBe(
      "resultat_fournisseur_incomplet",
    );
    expect(reponse.propositionStructuree?.valide).toBe(false);
    expect(reponse.usageFournisseur?.motifIncomplet).toBe("max_output_tokens");
    expect(reponse.detailResultatFournisseur).toMatch(/max_output_tokens/);
  });

  it("C — refusal → proposition non actionnable", async () => {
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client: clientDepuisReponse(() =>
        reponseInterne({
          texte: "",
          presenceRefusal: true,
          metadonnees: metadonneesBase({
            presenceRefusal: true,
            longueurOutputText: 0,
            typesContent: ["refusal"],
          }),
        }),
      ),
    });
    const reponse = await fournisseur.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(reponse.etatResultatFournisseur).toBe("refus_fournisseur");
    expect(reponse.propositionStructuree?.valide).toBe(false);
  });

  it("D — completed + payload volontairement invalide → sortie_structuree_invalide", async () => {
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client: clientDepuisReponse(() =>
        reponseInterne({
          texte: '{"pas":"conforme"}',
          metadonnees: metadonneesBase({ longueurOutputText: 18 }),
        }),
      ),
    });
    const reponse = await fournisseur.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(reponse.etatResultatFournisseur).toBe("sortie_structuree_invalide");
    expect(reponse.propositionStructuree?.valide).toBe(false);
  });

  it("E — sortie invalide mais usage consommé → coût imputé exactement une fois", async () => {
    const compteur = { appels: 0 };
    const conf = creerConfigurationXwayOpenaiDemonstration();
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: conf.baremeCoutInference!,
      client: clientDepuisReponse(
        () =>
          reponseInterne({
            texte: "pas-json",
            metadonnees: metadonneesBase({ longueurOutputText: 8 }),
            usage: {
              inputTokens: 50,
              outputTokens: 20,
              cachedInputTokens: 0,
              reasoningTokens: 0,
            },
          }),
        compteur,
      ),
    });
    const passerelle = creerPasserelleXway({
      configuration: conf,
      fournisseur,
    });
    const resultat = await passerelle.executer(demande());
    expect(resultat.statut).toBe("executee");
    if (resultat.statut !== "executee") {
      throw new Error("attendu executee");
    }
    expect(resultat.reponse.etatResultatFournisseur).toBe(
      "sortie_structuree_invalide",
    );
    expect(resultat.reponse.propositionStructuree?.valide).toBe(false);
    expect(resultat.coutFinalMicroUsdc).toBeGreaterThan(0n);
    expect(compteur.appels).toBe(1);
    // Relancer la même demande : idempotence, pas de 2e appel.
    const reprise = await passerelle.executer(demande());
    expect(reprise.statut).toBe("executee");
    expect(compteur.appels).toBe(1);
  });

  it("F — aucune tentative automatique de réparation/retry", async () => {
    const compteur = { appels: 0 };
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client: clientDepuisReponse(
        () =>
          reponseInterne({
            texte: "```json\n" + TEXTE_VALIDE + "\n```",
            metadonnees: metadonneesBase({ longueurOutputText: 40 }),
          }),
        compteur,
      ),
    });
    const reponse = await fournisseur.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(compteur.appels).toBe(1);
    expect(reponse.etatResultatFournisseur).toBe("sortie_structuree_invalide");
    expect(reponse.propositionStructuree?.valide).toBe(false);
  });

  it("G — parsing local équivalent output_parsed (sans Zod)", () => {
    const meta = metadonneesBase();
    const ok = interpreterPropositionDepuisReponse({
      texte: TEXTE_VALIDE,
      metadonnees: meta,
    });
    expect(ok.etat).toBe("resultat_fournisseur_complet");
    expect(ok.proposition.valide).toBe(true);

    // Même schéma que le payload Responses API.
    expect(SCHEMA_PROPOSITION_COGNITIVE_V01.required).toEqual([
      "resume",
      "actionProposee",
      "confiance",
    ]);
    expect(SCHEMA_PROPOSITION_COGNITIVE_V01.additionalProperties).toBe(false);

    const corps = construireCorpsRequeteResponses({
      modeleExterne: "gpt-5.6-luna",
      messages: [{ role: "user", content: "x" }],
      maxOutputTokens: 128,
      timeoutMs: 1000,
    });
    expect(corps.text.format.type).toBe("json_schema");
    expect(corps.text.format.strict).toBe(true);
  });

  it("extrait le texte depuis output[] lorsque output_text top-level est absent (bug smoke)", async () => {
    const corpsCaptures: CorpsRequeteResponsesApi[] = [];
    const envoyeur: EnvoyeurResponsesOpenAi = {
      async envoyer(corps) {
        corpsCaptures.push(corps);
        // Forme HTTP brute typique — PAS de output_text (addOutputText non appliqué).
        return {
          id: "resp_sans_output_text",
          model: "gpt-5.6-luna",
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: TEXTE_VALIDE }],
            },
          ],
          usage: {
            input_tokens: 172,
            output_tokens: 56,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        };
      },
    };

    expect(
      extraireTexteOutputResponses({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: TEXTE_VALIDE }],
          },
        ],
      }),
    ).toBe(TEXTE_VALIDE);

    const client = creerClientResponsesOpenAi({
      cleApi: "test",
      envoyeur,
    });
    const reponse = await client.creer({
      modeleExterne: "gpt-5.6-luna",
      messages: [{ role: "user", content: "hello" }],
      maxOutputTokens: 128,
      timeoutMs: 2000,
    });
    expect(reponse.texte).toBe(TEXTE_VALIDE);
    expect(reponse.statutOpenAi).toBe("completed");
    expect(reponse.metadonnees.longueurOutputText).toBe(TEXTE_VALIDE.length);
    expect(corpsCaptures).toHaveLength(1);

    const client2 = creerClientResponsesOpenAi({ cleApi: "test", envoyeur });
    const fournisseur2 = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client: client2,
    });
    const domaine = await fournisseur2.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(domaine.etatResultatFournisseur).toBe(
      "resultat_fournisseur_complet",
    );
    expect(domaine.propositionStructuree?.valide).toBe(true);
  });

  it("lit incomplete_details et ne valide pas le JSON tronqué", async () => {
    const envoyeur: EnvoyeurResponsesOpenAi = {
      async envoyer() {
        return {
          id: "resp_incomplete",
          model: "gpt-5.6-luna",
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: '{"resume":"' }],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 128,
            output_tokens_details: { reasoning_tokens: 20 },
          },
        };
      },
    };
    const client = creerClientResponsesOpenAi({ cleApi: "t", envoyeur });
    const fournisseur = creerFournisseurInferenceOpenAi({
      bareme: BAREME_OPENAI_LUNA_V01,
      client,
    });
    const reponse = await fournisseur.inferer(demande(), TARIF_LUNA_REEL_V01);
    expect(reponse.etatResultatFournisseur).toBe(
      "resultat_fournisseur_incomplet",
    );
    expect(reponse.metadonneesFournisseur?.incompleteDetails).toEqual({
      reason: "max_output_tokens",
    });
    expect(reponse.metadonneesFournisseur?.reasoningTokens).toBe(20);
    expect(reponse.propositionStructuree?.valide).toBe(false);
  });
});
