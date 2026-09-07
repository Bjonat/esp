import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ClientResponsesOpenAi} from "@esp/adaptateur-openai";
import {
  ErreurClientOpenAi,
  NOM_VARIABLE_CLE_OPENAI,
  creerFournisseurInferenceOpenAi,
  validerPropositionCognitiveV01,
} from "@esp/adaptateur-openai";
import {
  genererPaireIdentiteEd25519,
  SignataireAgentLocal,
} from "@esp/moteur-agent";
import {
  BAREME_OPENAI_LUNA_V01,
  TARIF_LUNA_REEL_V01,
  calculerCoutFournisseurEstimeMicroUsd,
  calculerCoutUsageMicroUsdc,
  construireMessageCanoniqueDemandeInference,
  creerConfigurationXwayDemonstration,
  creerConfigurationXwayOpenaiDemonstration,
  creerPasserelleXway,
  ErreurFournisseurInference,
  MODELE_LOGIQUE_LUNA_REEL_V01,
  parserConfigurationXway,
  serialiserBaremeCoutInference,
  serialiserConfigurationXway,
  trouverTarifModele,
  type DemandeInference,
  type ReponseInference,
} from "@esp/xway";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) rmSync(r, { recursive: true, force: true });
  }
});

const CLE_FAUSSE_TEST = "sk-fake-secret-test-key-NEVER-LEAK-openai";

const TEXTE_PROPOSITION_VALIDE = JSON.stringify({
  resume: "ok",
  actionProposee: "attendre",
  confiance: 0.5,
});

function clientReussi(surcharges?: {
  readonly texte?: string;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cachedInputTokens: number;
  };
  readonly surAppel?: () => void;
}): ClientResponsesOpenAi {
  return {
    async creer() {
      surcharges?.surAppel?.();
      const texte = surcharges?.texte ?? TEXTE_PROPOSITION_VALIDE;
      const usage = surcharges?.usage ?? {
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 10,
      };
      return {
        id: "resp_fake",
        modeleEffectif: "gpt-5.6-luna",
        statutOpenAi: "completed",
        statut: "complete",
        texte,
        usage: {
          ...usage,
          reasoningTokens: 0,
        },
        incompleteDetails: null,
        presenceRefusal: false,
        metadonnees: {
          id: "resp_fake",
          statut: "completed",
          statutBrut: "completed",
          incompleteDetails: null,
          modele: "gpt-5.6-luna",
          longueurOutputText: texte.length,
          typesOutputItems: ["message"],
          typesContent: ["output_text"],
          presenceRefusal: false,
          inputTokens: usage.inputTokens,
          cachedTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: 0,
        },
        texteBrutDiagnostic: texte,
      };
    },
  };
}

function demandeLuna(
  surcharges: Partial<DemandeInference> = {},
): DemandeInference {
  return {
    identifiantDemande: "dem-luna-001",
    identifiantExperience: "exp-openai-v01",
    identifiantAgent: "agent-a",
    numeroCycle: 1,
    modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
    messages: [
      { role: "systeme", contenu: "Contexte ESP." },
      { role: "utilisateur", contenu: "Analyse minimale." },
    ],
    nombreMaxJetonsSortie: 128,
    limiteDepenseAutoriseeMicroUsdc: 1_000_000n,
    ...surcharges,
  };
}

function fabriquerFournisseurAvecClient(
  client: ClientResponsesOpenAi,
  bareme = BAREME_OPENAI_LUNA_V01,
) {
  return creerFournisseurInferenceOpenAi({
    bareme,
    client,
  });
}

describe("ESP FOURNISSEUR IA RÉEL v0.1", () => {
  describe("A — secret absent", () => {
    it("estDisponible false ; inferer echec_certain ; aucun réseau", async () => {
      // Sans client injecté + clé absente → indisponible (fail closed, aucun HTTP).
      const fournisseur = creerFournisseurInferenceOpenAi({
        bareme: BAREME_OPENAI_LUNA_V01,
        lireCleApi: () => undefined,
      });
      expect(fournisseur.estDisponible()).toBe(false);
      await expect(
        fournisseur.inferer(demandeLuna(), TARIF_LUNA_REEL_V01),
      ).rejects.toSatisfy((erreur: unknown) => {
        expect(erreur).toBeInstanceOf(ErreurFournisseurInference);
        const e = erreur as ErreurFournisseurInference;
        expect(e.natureEchec).toBe("echec_certain");
        expect(e.code).toBe("cle_api_absente");
        return true;
      });
    });
  });

  describe("B — auth agent invalide", () => {
    it("refuse authentification_invalide ; fournisseur jamais appelé", async () => {
      let appelsClient = 0;
      const client = clientReussi({
        surAppel: () => {
          appelsClient += 1;
        },
      });
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const fournisseur = fabriquerFournisseurAvecClient(client, conf.baremeCoutInference);
      const a = genererPaireIdentiteEd25519();
      const b = genererPaireIdentiteEd25519();
      const signataireB = SignataireAgentLocal.depuisClePriveeMemoire({
        identifiantAgent: "agent-b",
        clePriveePkcs8Der: b.clePriveePkcs8Der,
      });
      const demande = demandeLuna({ identifiantAgent: "agent-a" });
      const message = construireMessageCanoniqueDemandeInference(demande);
      const signe = signataireB.signer(message);
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur,
        authentificationRequise: true,
        clesPubliquesParAgent: new Map([["agent-a", a.clePubliqueBase64Url]]),
      });
      const resultat = await passerelle.executer({
        demande,
        clePubliqueBase64Url: signe.clePubliqueBase64Url,
        signatureBase64Url: signe.signatureBase64Url,
      });
      expect(resultat.statut).toBe("refusee");
      if (resultat.statut === "refusee") {
        expect(resultat.motif).toBe("authentification_invalide");
      }
      expect(appelsClient).toBe(0);
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(0);
    });
  });

  describe("C — budget agent insuffisant", () => {
    it("refuse budget ; aucun appel fournisseur", async () => {
      let appelsClient = 0;
      const client = clientReussi({
        surAppel: () => {
          appelsClient += 1;
        },
      });
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          client,
          conf.baremeCoutInference,
        ),
      });
      const resultat = await passerelle.executer(
        demandeLuna({ limiteDepenseAutoriseeMicroUsdc: 1n }),
      );
      expect(resultat.statut).toBe("refusee");
      if (resultat.statut === "refusee") {
        expect(resultat.motif).toBe("budget_insuffisant");
      }
      expect(appelsClient).toBe(0);
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(0);
    });
  });

  describe("D — plafond fournisseur réel atteint", () => {
    it("motif plafond_fournisseur_reel_atteint ; aucun appel provider", async () => {
      let appelsClient = 0;
      const client = clientReussi({
        surAppel: () => {
          appelsClient += 1;
        },
      });
      const conf = creerConfigurationXwayOpenaiDemonstration({
        plafondDepenseFournisseurReelleMicroUsd: 1n,
      });
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          client,
          conf.baremeCoutInference,
        ),
      });
      const resultat = await passerelle.executer(demandeLuna());
      expect(resultat.statut).toBe("refusee");
      if (resultat.statut === "refusee") {
        expect(resultat.motif).toBe("plafond_fournisseur_reel_atteint");
      }
      expect(appelsClient).toBe(0);
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(0);
    });
  });

  describe("E — appel réussi avec faux provider", () => {
    it("coûts exacts via calculerCoutUsageMicroUsdc et calculerCoutFournisseurEstimeMicroUsd", async () => {
      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 10,
      };
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const bareme = conf.baremeCoutInference!;
      const tarif = trouverTarifModele(conf.modeles, MODELE_LOGIQUE_LUNA_REEL_V01)!;
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          clientReussi({ usage }),
          bareme,
        ),
      });
      const resultat = await passerelle.executer(demandeLuna());
      expect(resultat.statut).toBe("executee");
      if (resultat.statut !== "executee") {
        return;
      }
      const attenduAgent = calculerCoutUsageMicroUsdc(
        usage.inputTokens,
        usage.outputTokens,
        tarif,
        usage.cachedInputTokens,
      );
      const attenduFournisseur = calculerCoutFournisseurEstimeMicroUsd({
        jetonsEntree: usage.inputTokens,
        jetonsSortie: usage.outputTokens,
        jetonsEntreeCache: usage.cachedInputTokens,
        bareme,
      });
      expect(resultat.reponse.usage.coutMicroUsdc).toBe(attenduAgent);
      expect(resultat.coutFournisseurEstimeMicroUsd).toBe(attenduFournisseur);
      expect(resultat.reponse.coutFournisseurEstimeMicroUsd).toBe(
        attenduFournisseur,
      );
      expect(resultat.reponse.usage.jetonsEntree).toBe(100);
      expect(resultat.reponse.usage.jetonsSortie).toBe(50);
      expect(resultat.reponse.usage.jetonsEntreeCache).toBe(10);
    });
  });

  describe("F — coût fournisseur ≠ coût agent", () => {
    it("coutMicroUsdc et coutFournisseurEstimeMicroUsd tous deux présents et distincts", async () => {
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          clientReussi(),
          conf.baremeCoutInference,
        ),
      });
      const resultat = await passerelle.executer(demandeLuna());
      expect(resultat.statut).toBe("executee");
      if (resultat.statut !== "executee") {
        return;
      }
      const coutAgent = resultat.reponse.usage.coutMicroUsdc;
      const coutFournisseur = resultat.reponse.coutFournisseurEstimeMicroUsd;
      expect(coutAgent).toBeDefined();
      expect(coutFournisseur).toBeDefined();
      expect(typeof coutAgent).toBe("bigint");
      expect(typeof coutFournisseur).toBe("bigint");
      // Devises / champs distincts (MicroUsdc agent vs MicroUsd fournisseur).
      expect(coutFournisseur).not.toBe(coutAgent);
      expect(resultat.coutFournisseurEstimeMicroUsd).toBe(coutFournisseur);
    });
  });

  describe("G — timeout ambigu", () => {
    it("resultat_indetermine ; réservation conservée", async () => {
      const client: ClientResponsesOpenAi = {
        async creer() {
          throw new ErreurClientOpenAi("timeout ambigu simulé", {
            natureEchec: "resultat_indetermine",
          });
        },
      };
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          client,
          conf.baremeCoutInference,
        ),
      });
      const demande = demandeLuna({ identifiantDemande: "dem-timeout" });
      const resultat = await passerelle.executer(demande);
      expect(resultat.statut).toBe("resultat_indetermine");
      if (resultat.statut === "resultat_indetermine") {
        expect(resultat.natureEchec).toBe("resultat_indetermine");
      }
      expect(
        passerelle.obtenirCompteReservations().totalReservationsActives({
          identifiantAgent: demande.identifiantAgent,
          numeroCycle: demande.numeroCycle,
        }),
      ).toBeGreaterThan(0n);
    });
  });

  describe("H — erreur certaine", () => {
    it("echouee ; réservation libérée", async () => {
      const client: ClientResponsesOpenAi = {
        async creer() {
          throw new ErreurClientOpenAi("erreur HTTP 401 simulée", {
            natureEchec: "echec_certain",
          });
        },
      };
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          client,
          conf.baremeCoutInference,
        ),
      });
      const demande = demandeLuna({ identifiantDemande: "dem-echec-certain" });
      const resultat = await passerelle.executer(demande);
      expect(resultat.statut).toBe("echouee");
      if (resultat.statut === "echouee") {
        expect(resultat.natureEchec).toBe("echec_certain");
      }
      expect(
        passerelle.obtenirCompteReservations().totalReservationsActives({
          identifiantAgent: demande.identifiantAgent,
          numeroCycle: demande.numeroCycle,
        }),
      ).toBe(0n);
    });
  });

  describe("I — idempotence redémarrage", () => {
    it("second executer → dejaConnue ; un seul appel fournisseur", async () => {
      let appelsClient = 0;
      const client = clientReussi({
        surAppel: () => {
          appelsClient += 1;
        },
      });
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          client,
          conf.baremeCoutInference,
        ),
      });
      const demande = demandeLuna({ identifiantDemande: "dem-idempotente" });
      const premier = await passerelle.executer(demande);
      expect(premier.statut).toBe("executee");
      expect(appelsClient).toBe(1);
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(1);

      const second = await passerelle.executer(demande);
      expect(second.statut).toBe("executee");
      if (second.statut === "executee") {
        expect(second.dejaConnue).toBe(true);
      }
      expect(appelsClient).toBe(1);
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(1);
    });
  });

  describe("J — sortie structurée invalide", () => {
    it("propositionStructuree.valide === false", async () => {
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          clientReussi({ texte: "{not json" }),
          conf.baremeCoutInference,
        ),
      });
      const resultat = await passerelle.executer(
        demandeLuna({ identifiantDemande: "dem-json-invalide" }),
      );
      expect(resultat.statut).toBe("executee");
      if (resultat.statut !== "executee") {
        return;
      }
      expect(resultat.reponse.propositionStructuree).toBeDefined();
      expect(resultat.reponse.propositionStructuree!.valide).toBe(false);
      // Cohérence avec le validateur exposé.
      expect(validerPropositionCognitiveV01("{not json").valide).toBe(false);
    });
  });

  describe("K — pas de secret", () => {
    it("OPENAI_API_KEY et clé factice absents des sérialisations / charge", async () => {
      const conf = creerConfigurationXwayOpenaiDemonstration();
      const fournisseur = creerFournisseurInferenceOpenAi({
        bareme: conf.baremeCoutInference!,
        client: clientReussi(),
        lireCleApi: () => CLE_FAUSSE_TEST,
      });
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur,
      });
      const resultat = await passerelle.executer(
        demandeLuna({ identifiantDemande: "dem-secret" }),
      );
      expect(resultat.statut).toBe("executee");

      const confJson = serialiserConfigurationXway(conf);
      const confTexte = JSON.stringify(confJson);
      const baremeTexte = JSON.stringify(
        serialiserBaremeCoutInference(conf.baremeCoutInference!),
      );
      const resultatTexte = JSON.stringify(resultat, (_k, v) =>
        typeof v === "bigint" ? v.toString(10) : v,
      );
      const journal = {
        niveau: "info",
        message: "inference executee",
        configuration: confJson,
        resultat,
      };
      const journalTexte = JSON.stringify(journal, (_k, v) =>
        typeof v === "bigint" ? v.toString(10) : v,
      );

      const reponse = (resultat as { reponse: ReponseInference }).reponse;
      const chargeInferenceExecutee = {
        type: "INFERENCE_EXECUTEE",
        identifiantDemande: "dem-secret",
        modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
        coutFinalMicroUsdc: String(reponse.usage.coutMicroUsdc),
        coutFournisseurEstimeMicroUsd:
          reponse.coutFournisseurEstimeMicroUsd !== undefined
            ? String(reponse.coutFournisseurEstimeMicroUsd)
            : undefined,
        texte: reponse.texte,
        usage: {
          jetonsEntree: reponse.usage.jetonsEntree,
          jetonsSortie: reponse.usage.jetonsSortie,
          jetonsEntreeCache: reponse.usage.jetonsEntreeCache,
        },
      };
      const chargeTexte = JSON.stringify(chargeInferenceExecutee);

      for (const blob of [
        confTexte,
        baremeTexte,
        resultatTexte,
        journalTexte,
        chargeTexte,
      ]) {
        expect(blob).not.toContain(NOM_VARIABLE_CLE_OPENAI);
        expect(blob).not.toContain("OPENAI_API_KEY");
        expect(blob).not.toContain(CLE_FAUSSE_TEST);
        expect(blob.toLowerCase()).not.toContain("sk-fake");
      }
    });
  });

  describe("L — déterminisme économique historique", () => {
    it("ConfigurationXway figée conserve le barème après mutation du fichier JSON", () => {
      const repertoire = mkdtempSync(join(tmpdir(), "esp-openai-bareme-"));
      repertoires.push(repertoire);
      const chemin = join(repertoire, "xway-openai.json");

      const initiale = creerConfigurationXwayOpenaiDemonstration();
      const jsonInitial = serialiserConfigurationXway(initiale);
      writeFileSync(chemin, JSON.stringify(jsonInitial, null, 2), "utf8");

      const fige = parserConfigurationXway(
        JSON.parse(readFileSync(chemin, "utf8")),
      );
      const baremeAvant = fige.baremeCoutInference!;
      expect(baremeAvant.coutParMillionJetonsEntreeMicroUsd).toBe(
        BAREME_OPENAI_LUNA_V01.coutParMillionJetonsEntreeMicroUsd,
      );

      // Mutation du fichier (simule dérive post-EXPERIENCE_CREEE).
      const mute = JSON.parse(readFileSync(chemin, "utf8")) as ReturnType<
        typeof serialiserConfigurationXway
      >;
      mute.baremeCoutInference = {
        ...mute.baremeCoutInference!,
        coutParMillionJetonsEntreeMicroUsd: "999999999",
        coutParMillionJetonsSortieMicroUsd: "888888888",
      };
      writeFileSync(chemin, JSON.stringify(mute, null, 2), "utf8");

      // L'objet figé en mémoire (snapshot EXPERIENCE_CREEE) reste inchangé.
      expect(fige.baremeCoutInference!.coutParMillionJetonsEntreeMicroUsd).toBe(
        baremeAvant.coutParMillionJetonsEntreeMicroUsd,
      );
      expect(fige.baremeCoutInference!.coutParMillionJetonsSortieMicroUsd).toBe(
        baremeAvant.coutParMillionJetonsSortieMicroUsd,
      );
      expect(fige.baremeCoutInference!.versionBareme).toBe(
        BAREME_OPENAI_LUNA_V01.versionBareme,
      );

      // Re-parse du fichier muté donne bien les nouvelles valeurs.
      const reparse = parserConfigurationXway(
        JSON.parse(readFileSync(chemin, "utf8")),
      );
      expect(
        reparse.baremeCoutInference!.coutParMillionJetonsEntreeMicroUsd,
      ).toBe(999_999_999n);
    });
  });

  describe("M — fournisseur simulé", () => {
    it("creerConfigurationXwayDemonstration + Passerelle défaut exécute encore", async () => {
      const passerelle = creerPasserelleXway({
        configuration: creerConfigurationXwayDemonstration(),
      });
      const resultat = await passerelle.executer({
        identifiantDemande: "dem-simule-regression",
        identifiantExperience: "exp-simule",
        identifiantAgent: "agent-sim",
        numeroCycle: 1,
        modeleDemande: "modele_standard",
        messages: [{ role: "utilisateur", contenu: "régression simule" }],
        nombreMaxJetonsSortie: 128,
        limiteDepenseAutoriseeMicroUsdc: 1_000_000n,
      });
      expect(resultat.statut).toBe("executee");
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(1);
    });
  });

  describe("N — plafond réel global", () => {
    it("deux agents ; second refusé plafond ; un seul appel provider", async () => {
      let appelsClient = 0;
      const client = clientReussi({
        surAppel: () => {
          appelsClient += 1;
        },
      });

      const confBase = creerConfigurationXwayOpenaiDemonstration();
      const bareme = confBase.baremeCoutInference!;
      const fournisseurProbe = fabriquerFournisseurAvecClient(client, bareme);
      const tarif = trouverTarifModele(
        confBase.modeles,
        MODELE_LOGIQUE_LUNA_REEL_V01,
      )!;

      const demandeA = demandeLuna({
        identifiantDemande: "dem-plafond-a",
        identifiantAgent: "agent-a",
      });
      const estimationA = fournisseurProbe.estimerCout(demandeA, tarif);
      const plafondExact = estimationA.coutMaximumEstimeFournisseurMicroUsd!;
      expect(plafondExact).toBeGreaterThan(0n);

      const conf = creerConfigurationXwayOpenaiDemonstration({
        plafondDepenseFournisseurReelleMicroUsd: plafondExact,
      });
      const passerelle = creerPasserelleXway({
        configuration: conf,
        fournisseur: fabriquerFournisseurAvecClient(
          client,
          conf.baremeCoutInference,
        ),
      });

      const premier = await passerelle.executer(demandeA);
      expect(premier.statut).toBe("executee");
      expect(appelsClient).toBe(1);

      const second = await passerelle.executer(
        demandeLuna({
          identifiantDemande: "dem-plafond-b",
          identifiantAgent: "agent-b",
        }),
      );
      expect(second.statut).toBe("refusee");
      if (second.statut === "refusee") {
        expect(second.motif).toBe("plafond_fournisseur_reel_atteint");
      }
      expect(appelsClient).toBe(1);
      expect(passerelle.obtenirNombreAppelsFournisseur()).toBe(1);
    });
  });
});
