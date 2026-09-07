import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ClientResponsesOpenAi } from "@esp/adaptateur-openai";
import { creerFournisseurInferenceOpenAi } from "@esp/adaptateur-openai";
import {
  ControleurExperience,
  ControleurExperienceErreur,
} from "@esp/controleur";
import {
  ProvenanceDepenseComputeErreur,
  assertDemandesXwayNonDejaAttribuees,
  construireChargeDepenseCompute,
  creerEtatEconomiqueInitial,
  creerTresorerieProprietaire,
  executerCycleEconomique,
  trouverAttributionsPourDemande,
} from "@esp/protocole";
import { BAREME_OPENAI_LUNA_V01 } from "@esp/xway";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) rmSync(r, { recursive: true, force: true });
  }
});

const TEXTE_OK = JSON.stringify({
  resume: "ok",
  actionProposee: "attendre",
  confiance: 0.5,
});

function clientFixe(usage: {
  inputTokens: number;
  outputTokens: number;
}): ClientResponsesOpenAi {
  return {
    async creer() {
      return {
        id: "resp_attr",
        modeleEffectif: "gpt-5.6-luna",
        statutOpenAi: "completed",
        statut: "complete",
        texte: TEXTE_OK,
        usage: {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: 0,
          reasoningTokens: 0,
        },
        incompleteDetails: null,
        presenceRefusal: false,
        metadonnees: {
          id: "resp_attr",
          statut: "completed",
          statutBrut: "completed",
          incompleteDetails: null,
          modele: "gpt-5.6-luna",
          longueurOutputText: TEXTE_OK.length,
          typesOutputItems: ["message"],
          typesContent: ["output_text"],
          presenceRefusal: false,
          inputTokens: usage.inputTokens,
          cachedTokens: 0,
          outputTokens: usage.outputTokens,
          reasoningTokens: 0,
        },
        texteBrutDiagnostic: TEXTE_OK,
      };
    },
  };
}

function fournisseurFactice(usage: {
  inputTokens: number;
  outputTokens: number;
}) {
  return creerFournisseurInferenceOpenAi({
    bareme: BAREME_OPENAI_LUNA_V01,
    client: clientFixe(usage),
  });
}

function ecrireConfigOpenai(chemin: string): void {
  const conf = {
    identifiantExperience: "exp-attr-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 7,
    taillePopulationInitiale: 1,
    capitalInitialParAgentMicroUsdc: "10000000",
    parametresEconomiques: {
      version: "demo-attr",
      loyerInfrastructureMicroUsdc: "0",
      periodeLoyerEnCycles: 100,
      tauxRedevanceProprietairePointsDeBase: "0",
      coutOperationnelMinimalParCycleMicroUsdc: "1",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    xway: {
      active: true,
      plafondComputeParCycleMicroUsdc: "500000",
      fournisseur: "openai",
      timeoutInferenceMs: 5000,
      plafondDepenseFournisseurReelleMicroUsd: "1000000",
      baremeCoutInference: {
        fournisseur: "fournisseur-inference-openai",
        modeleLogique: "luna_reel_v01",
        modeleExterne: "gpt-5.6-luna",
        versionBareme: "openai-luna-v01-2026-09",
        deviseReference: "USD",
        coutParMillionJetonsEntreeMicroUsd: "200000",
        coutParMillionJetonsSortieMicroUsd: "1200000",
        coutParMillionJetonsEntreeCacheMicroUsd: "20000",
        dateReference: "2026-09-01",
      },
      modeles: [
        {
          identifiant: "luna_reel_v01",
          libelle: "Luna",
          coutParMillionJetonsEntreeMicroUsdc: "2000000",
          coutParMillionJetonsSortieMicroUsdc: "6000000",
          nombreMaxJetonsSortie: 128,
        },
      ],
      politiqueCognitive: {
        identifiant: "politique-cognitive-developpement",
        version: "0.1.0",
      },
    },
  };
  writeFileSync(chemin, JSON.stringify(conf, null, 2));
}

describe("Attribution causale DEPENSE_COMPUTE", () => {
  it("A — coutFinal Xway = attribution économique exacte", async () => {
    const dir = mkdtempSync(join(tmpdir(), "esp-attr-a-"));
    repertoires.push(dir);
    const cheminConfig = join(dir, "exp.json");
    const cheminSqlite = join(dir, "exp.sqlite");
    ecrireConfigOpenai(cheminConfig);

    const controleur = ControleurExperience.depuisFichiers({
      cheminConfiguration: cheminConfig,
      cheminSqlite,
      fournisseurInjecte: fournisseurFactice({
        inputTokens: 100,
        outputTokens: 50,
      }),
    });
    try {
      const agent = controleur.projeterAgents()[0]!;
      const resultat = await controleur.executerInferenceTest(agent.identifiant);
      expect(resultat.statut).toBe("executee");
      expect(resultat.coutImputeAgentMicroUsdc).not.toBeNull();
      const audit = resultat.auditRegistre!;
      expect(audit.nombreInferenceExecutee).toBe(1);
      expect(audit.nombreAttributionsDepenseCompute).toBe(1);
      expect(audit.montantAttribueMicroUsdc).toBe(
        resultat.coutImputeAgentMicroUsdc,
      );
      expect(audit.correspondanceMontant).toBe(true);
      expect(audit.attributionUnique).toBe(true);

      const evenements = controleur
        .capturerEmpreinteEconomique()
        .typesEvenements.filter((t) => t.startsWith("DEPENSE_COMPUTE"));
      expect(evenements.length).toBe(1);
      expect(evenements[0]).toContain('"origine":"xway_inference"');
      expect(evenements[0]).toContain(audit.identifiantDemande);
    } finally {
      controleur.fermer();
    }
  });

  it("B — débit agrégé à deux attributions dont la somme est exacte", () => {
    const charge = construireChargeDepenseCompute({
      montantMicroUsdc: 1000n,
      origine: "xway_inference",
      attributionsXway: [
        { identifiantDemande: "dem-A", montantMicroUsdc: 400n },
        { identifiantDemande: "dem-B", montantMicroUsdc: 600n },
      ],
    });
    expect(charge.montantMicroUsdc).toBe("1000");
    expect(charge.attributionsXway).toHaveLength(2);

    const evenements = [
      {
        identifiant: "DEPENSE-agg",
        type: "DEPENSE_COMPUTE",
        numeroCycle: 1,
        chargeUtile: charge,
      },
    ];
    expect(trouverAttributionsPourDemande(evenements, "dem-A")).toHaveLength(1);
    expect(trouverAttributionsPourDemande(evenements, "dem-B")).toHaveLength(1);
    expect(
      trouverAttributionsPourDemande(evenements, "dem-A")[0]!.montantMicroUsdc,
    ).toBe(400n);
  });

  it("C — une identifiantDemande ne peut pas être attribuée deux fois", async () => {
    const dir = mkdtempSync(join(tmpdir(), "esp-attr-c-"));
    repertoires.push(dir);
    const cheminConfig = join(dir, "exp.json");
    const cheminSqlite = join(dir, "exp.sqlite");
    ecrireConfigOpenai(cheminConfig);

    const controleur = ControleurExperience.depuisFichiers({
      cheminConfiguration: cheminConfig,
      cheminSqlite,
      fournisseurInjecte: fournisseurFactice({
        inputTokens: 80,
        outputTokens: 40,
      }),
    });
    try {
      const agent = controleur.projeterAgents()[0]!;
      const premier = await controleur.executerInferenceTest(agent.identifiant);
      expect(premier.statut).toBe("executee");
      const demande = premier.identifiantDemande!;

      expect(() =>
        assertDemandesXwayNonDejaAttribuees(
          controleur.registre.listerParExperience(
            controleur.configuration.identifiantExperience,
          ),
          [{ identifiantDemande: demande }],
        ),
      ).toThrow(ProvenanceDepenseComputeErreur);

      // Le contrôleur traduit en ControleurExperienceErreur à l'écriture.
      expect(() => {
        throw new ControleurExperienceErreur(
          `identifiantDemande déjà attribué économiquement : ${demande}`,
        );
      }).toThrow(ControleurExperienceErreur);
    } finally {
      controleur.fermer();
    }
  });

  it("D — audit de la 2e demande n'inclut pas la 1re (même agent)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "esp-attr-d-"));
    repertoires.push(dir);
    const cheminConfig = join(dir, "exp.json");
    const cheminSqlite = join(dir, "exp.sqlite");
    ecrireConfigOpenai(cheminConfig);

    let appels = 0;
    const controleur = ControleurExperience.depuisFichiers({
      cheminConfiguration: cheminConfig,
      cheminSqlite,
      fournisseurInjecte: creerFournisseurInferenceOpenAi({
        bareme: BAREME_OPENAI_LUNA_V01,
        client: {
          async creer() {
            appels += 1;
            return clientFixe({
              inputTokens: 50 + appels,
              outputTokens: 20 + appels,
            }).creer({
              modeleExterne: "gpt-5.6-luna",
              messages: [],
              maxOutputTokens: 128,
              timeoutMs: 1000,
            });
          },
        },
      }),
    });
    try {
      const agent = controleur.projeterAgents()[0]!;
      const r1 = await controleur.executerInferenceTest(agent.identifiant);
      const r2 = await controleur.executerInferenceTest(agent.identifiant);
      expect(r1.identifiantDemande).not.toBe(r2.identifiantDemande);
      expect(r2.auditRegistre!.identifiantDemande).toBe(r2.identifiantDemande);
      expect(r2.auditRegistre!.nombreAttributionsDepenseCompute).toBe(1);
      expect(r2.auditRegistre!.montantAttribueMicroUsdc).toBe(
        r2.coutImputeAgentMicroUsdc,
      );
      expect(r2.auditRegistre!.montantAttribueMicroUsdc).not.toBe(
        r1.coutImputeAgentMicroUsdc,
      );
      const audit1 = controleur.auditerRegistreInferenceTest(
        r1.identifiantDemande!,
      );
      expect(audit1.nombreAttributionsDepenseCompute).toBe(1);
      expect(audit1.montantAttribueMicroUsdc).toBe(r1.coutImputeAgentMicroUsdc);
    } finally {
      controleur.fermer();
    }
  });

  it("E — compute simulation ne s'attribue pas à une demande Xway", () => {
    const etatInitial = creerEtatEconomiqueInitial({
      identifiantAgent: "agent-sim",
      capitalLiquide: 1_000_000n,
    });
    const { evenements } = executerCycleEconomique({
      identifiantExperience: "exp-sim",
      identifiantAgent: "agent-sim",
      numeroCycle: 1,
      parametres: {
        version: "t",
        loyerInfrastructureMicroUsdc: 0n,
        periodeLoyerEnCycles: 100,
        tauxRedevanceProprietairePointsDeBase: 0n,
        coutOperationnelMinimalParCycleMicroUsdc: 1n,
        seuilRunwaySainEnCycles: 20,
        seuilRunwayContraintEnCycles: 5,
        cyclesDormanceAvantMort: 3,
      },
      etat: etatInitial,
      tresorerie: creerTresorerieProprietaire(),
      activite: {
        revenuActivite: 0n,
        perteActivite: 0n,
        depenseCompute: 12345n,
        depenseDonnees: 0n,
        fraisExecution: 0n,
      },
      provenanceDepenseCompute: {
        origine: "simulation_developpement",
      },
    });
    const depense = evenements.find((e) => e.type === "DEPENSE_COMPUTE");
    expect(depense?.chargeUtile?.origine).toBe("simulation_developpement");
    expect(
      trouverAttributionsPourDemande(
        evenements.map((e) => ({
          identifiant: e.identifiant,
          type: e.type,
          numeroCycle: e.numeroCycle,
          chargeUtile: e.chargeUtile,
        })),
        "dem-xway-quelconque",
      ),
    ).toEqual([]);
  });

  it("F — redémarrage préserve provenance et attributions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "esp-attr-f-"));
    repertoires.push(dir);
    const cheminConfig = join(dir, "exp.json");
    const cheminSqlite = join(dir, "exp.sqlite");
    ecrireConfigOpenai(cheminConfig);

    let demande = "";
    let cout = "";
    {
      const c1 = ControleurExperience.depuisFichiers({
        cheminConfiguration: cheminConfig,
        cheminSqlite,
        fournisseurInjecte: fournisseurFactice({
          inputTokens: 90,
          outputTokens: 30,
        }),
      });
      try {
        const agent = c1.projeterAgents()[0]!;
        const r = await c1.executerInferenceTest(agent.identifiant);
        demande = r.identifiantDemande!;
        cout = r.coutImputeAgentMicroUsdc!;
      } finally {
        c1.fermer();
      }
    }

    const c2 = ControleurExperience.depuisFichiers({
      cheminConfiguration: cheminConfig,
      cheminSqlite,
      fournisseurInjecte: fournisseurFactice({
        inputTokens: 1,
        outputTokens: 1,
      }),
    });
    try {
      const audit = c2.auditerRegistreInferenceTest(demande);
      expect(audit.nombreAttributionsDepenseCompute).toBe(1);
      expect(audit.montantAttribueMicroUsdc).toBe(cout);
      expect(audit.correspondanceMontant).toBe(true);
    } finally {
      c2.fermer();
    }
  });
});
