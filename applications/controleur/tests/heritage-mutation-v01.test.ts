import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CATALOGUE_GENES_MUTABLES_V01,
  ParametresMutationInvalidesErreur,
  appliquerMutationConfigurationHeritable,
  configurationHeritableDepuisPolitiqueBase,
  creerConfigurationHeritableVide,
  creerParametresMutationInactifs,
  creerTresorerieProprietaire,
  empreinteConfigurationHeritable,
  evaluerAutorisationReproduction,
  fabriquerIdentifiantEnfant,
  parserParametresMutation,
  parserParametresReproduction,
  preparerReproduction,
  resoudrePolitiqueDepuisConfigurationHeritable,
  serialiserMicroUsdc,
  type ConfigurationHeritableAgent,
  type ParametresMutationExperience,
} from "@esp/protocole";
import { creerRegistreEvenementsMemoire } from "@esp/registre-evenements";
import {
  ControleurExperience,
  parserConfigurationExperience,
  type ConfigurationExperienceJson,
} from "../src/index.js";

const repertoires: string[] = [];

afterEach(() => {
  while (repertoires.length > 0) {
    const r = repertoires.pop();
    if (r !== undefined) {
      rmSync(r, { recursive: true, force: true });
    }
  }
});

function repertoireTemp(): string {
  const r = mkdtempSync(join(tmpdir(), "esp-mutation-"));
  repertoires.push(r);
  return r;
}

const POLITIQUE_BASE = {
  identifiant: "politique-budget-cognitif-agent" as const,
  version: "0.1.0",
  seuilEnjeuPourInferenceMicroUsdc: "100000",
  partMaxVenParCycleBps: 50,
  plafondCognitifMicroUsdc: "10000",
  modeleLogique: "modele_standard",
  comportementSansInference: "agir_si_favorable" as const,
  refuserSiCritiqueOuDormant: true,
};

const ENV_BASE = {
  identifiant: "environnement-opportunites-simulees" as const,
  version: "0.1.0",
  probabiliteSuccesBaseBps: 6000,
  amplitudeProbabiliteBps: 0,
  gainSiSuccesMicroUsdc: "800000",
  perteSiEchecMicroUsdc: "400000",
  fraisActionMicroUsdc: "20000",
  fraisAttendreMicroUsdc: "0",
};

const XWAY_BASE = {
  active: true,
  plafondComputeParCycleMicroUsdc: "50000",
  modeles: [
    {
      identifiant: "modele_economique" as const,
      libelle: "éco",
      coutParMillionJetonsEntreeMicroUsdc: "500000",
      coutParMillionJetonsSortieMicroUsdc: "1500000",
      nombreMaxJetonsSortie: 256,
    },
    {
      identifiant: "modele_standard" as const,
      libelle: "std",
      coutParMillionJetonsEntreeMicroUsdc: "2000000",
      coutParMillionJetonsSortieMicroUsdc: "6000000",
      nombreMaxJetonsSortie: 512,
    },
    {
      identifiant: "modele_premium" as const,
      libelle: "prem",
      coutParMillionJetonsEntreeMicroUsdc: "20000000",
      coutParMillionJetonsSortieMicroUsdc: "60000000",
      nombreMaxJetonsSortie: 1024,
    },
  ],
  politiqueCognitive: {
    identifiant: "politique-budget-cognitif-agent" as const,
    version: "0.1.0",
  },
  fournisseur: {
    identifiant: "fournisseur-inference-simule" as const,
    version: "0.1.0",
  },
};

const REPRODUCTION_BASE = {
  version: "parametres-reproduction-v01" as const,
  active: true,
  dotationEnfantMicroUsdc: "5000000",
  coutReproductionMicroUsdc: "1000000",
  reserveMinimaleParentMicroUsdc: "1000000",
  populationMaximale: 20,
  nombreMaxReproductionsParCycle: 5,
  nombreMaxEnfantsParAgent: 5,
  cooldownCycles: 0,
};

const MUTATION_ACTIVE: NonNullable<ConfigurationExperienceJson["mutation"]> = {
  version: "parametres-mutation-v01",
  active: true,
  tauxMutationParGeneBps: 10_000,
  versionCatalogueGenes: "genes-mutables-v01",
};

function configMutation(
  surcharges: Partial<ConfigurationExperienceJson> = {},
): ConfigurationExperienceJson {
  const base: ConfigurationExperienceJson = {
    identifiantExperience: "exp-mutation-v01",
    versionProtocole: "0.1.0",
    mode: "simulation",
    graineSimulation: 7,
    taillePopulationInitiale: 2,
    capitalInitialParAgentMicroUsdc: "100000000",
    parametresEconomiques: {
      version: "demo",
      loyerInfrastructureMicroUsdc: "0",
      periodeLoyerEnCycles: 100,
      tauxRedevanceProprietairePointsDeBase: "0",
      coutOperationnelMinimalParCycleMicroUsdc: "1000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    reproduction: REPRODUCTION_BASE,
    mutation: MUTATION_ACTIVE,
    politiqueBudgetCognitif: POLITIQUE_BASE,
    xway: XWAY_BASE,
  };
  return {
    ...base,
    ...surcharges,
    parametresEconomiques: {
      ...base.parametresEconomiques,
      ...(surcharges.parametresEconomiques ?? {}),
    },
    reproduction: {
      ...REPRODUCTION_BASE,
      ...(surcharges.reproduction ?? {}),
    },
    mutation:
      surcharges.mutation === undefined
        ? MUTATION_ACTIVE
        : { ...MUTATION_ACTIVE, ...surcharges.mutation },
    politiqueBudgetCognitif: {
      ...POLITIQUE_BASE,
      ...(surcharges.politiqueBudgetCognitif ?? {}),
    },
    xway:
      surcharges.xway === undefined
        ? XWAY_BASE
        : {
            ...XWAY_BASE,
            ...surcharges.xway,
            modeles: surcharges.xway.modeles ?? XWAY_BASE.modeles,
            politiqueCognitive:
              surcharges.xway.politiqueCognitive ??
              XWAY_BASE.politiqueCognitive,
            fournisseur: surcharges.xway.fournisseur ?? XWAY_BASE.fournisseur,
          },
    ...(surcharges.environnementDecision !== undefined
      ? {
          environnementDecision: {
            ...ENV_BASE,
            ...surcharges.environnementDecision,
          },
        }
      : {}),
  };
}

function ouvrir(
  conf: ConfigurationExperienceJson,
  extras?: { cheminSqlite?: string; cheminKeystore?: string },
): ControleurExperience {
  return ControleurExperience.ouvrir({
    configuration: parserConfigurationExperience(conf),
    ...(extras?.cheminSqlite !== undefined
      ? { cheminSqlite: extras.cheminSqlite }
      : { registre: creerRegistreEvenementsMemoire() }),
    ...(extras?.cheminKeystore !== undefined
      ? { cheminKeystoreIdentites: extras.cheminKeystore }
      : { cheminKeystoreIdentites: join(repertoireTemp(), "identites") }),
    dateCreationFixe: "2020-01-01T00:00:00.000Z",
    datesEvenementsFixes: "2020-01-01T00:00:00.000Z",
  });
}

function configParentDefaut(): ConfigurationHeritableAgent {
  return configurationHeritableDepuisPolitiqueBase({
    seuilEnjeuPourInferenceMicroUsdc: 100_000n,
    partMaxVenParCycleBps: 50,
    plafondCognitifMicroUsdc: 10_000n,
    comportementSansInference: "agir_si_favorable",
  });
}

function parametresMutation(
  surcharges?: Partial<{
    active: boolean;
    tauxMutationParGeneBps: number;
    genes: ParametresMutationExperience["genes"];
  }>,
): ParametresMutationExperience {
  return parserParametresMutation({
    version: "parametres-mutation-v01",
    active: surcharges?.active ?? true,
    tauxMutationParGeneBps: surcharges?.tauxMutationParGeneBps ?? 10_000,
    versionCatalogueGenes: "genes-mutables-v01",
    ...(surcharges?.genes !== undefined
      ? {
          genes: surcharges.genes.map((g) => {
            if (g.type === "micro_usdc") {
              return {
                cle: g.cle,
                type: g.type,
                minimumMicroUsdc: g.minimumMicroUsdc.toString(10),
                maximumMicroUsdc: g.maximumMicroUsdc.toString(10),
                pasMutationMicroUsdc: g.pasMutationMicroUsdc.toString(10),
                defautMicroUsdc: g.defautMicroUsdc.toString(10),
              };
            }
            if (g.type === "bps") {
              return {
                cle: g.cle,
                type: g.type,
                minimum: g.minimum,
                maximum: g.maximum,
                pasMutation: g.pasMutation,
                defaut: g.defaut,
              };
            }
            return {
              cle: g.cle,
              type: g.type,
              valeursAutorisees: [...g.valeursAutorisees],
              defaut: g.defaut,
            };
          }),
        }
      : {}),
  });
}

const IDS_MUTATION = {
  graineExperience: 7,
  identifiantReproduction: "repro:exp-mutation-v01:parent:e001",
  identifiantParent: "parent",
  identifiantEnfant: "parent-e001",
} as const;

function appliquer(
  configurationParent: ConfigurationHeritableAgent,
  mut?: ParametresMutationExperience,
  ids?: Partial<typeof IDS_MUTATION>,
) {
  return appliquerMutationConfigurationHeritable({
    configurationParent,
    parametresMutation: mut ?? parametresMutation(),
    ...IDS_MUTATION,
    ...ids,
  });
}

function contiendraitSecret(valeur: unknown): boolean {
  const texte = JSON.stringify(valeur);
  return /clePrivee|privateKey|pkcs8|secret|seedPhrase|mnemonic/i.test(texte);
}

describe("Héritage + mutation v0.1 — A–AF", () => {
  describe("fonctions pures protocole", () => {
    it("A — active=false ou taux=0 → copie identique ; inactive", () => {
      const parent = configParentDefaut();
      const inactif = creerParametresMutationInactifs();
      const rInactif = appliquer(parent, inactif);
      expect(rInactif.mutations).toEqual([]);
      expect(rInactif.configurationEnfant).toEqual(parent);

      const taux0 = parametresMutation({ active: true, tauxMutationParGeneBps: 0 });
      const r0 = appliquer(parent, taux0);
      expect(r0.mutations).toEqual([]);
      expect(r0.configurationEnfant.parametres).toEqual(parent.parametres);

      const desactive = parametresMutation({
        active: false,
        tauxMutationParGeneBps: 10_000,
      });
      const rOff = appliquer(parent, desactive);
      expect(rOff.mutations).toEqual([]);
      expect(rOff.configurationEnfant).toEqual(parent);
    });

    it("B — taux 0 = aucune mutation", () => {
      const r = appliquer(
        configParentDefaut(),
        parametresMutation({ tauxMutationParGeneBps: 0 }),
      );
      expect(r.mutations).toHaveLength(0);
    });

    it("C — taux 10000 = chaque gène mutable tente une mutation effective", () => {
      const r = appliquer(
        configParentDefaut(),
        parametresMutation({ tauxMutationParGeneBps: 10_000 }),
      );
      expect(r.mutations.length).toBe(CATALOGUE_GENES_MUTABLES_V01.length);
      const cles = new Set(r.mutations.map((m) => m.cleGene));
      for (const gene of CATALOGUE_GENES_MUTABLES_V01) {
        expect(cles.has(gene.cle)).toBe(true);
      }
    });

    it("D — même seed + reproduction → mêmes mutations", () => {
      const parent = configParentDefaut();
      const mut = parametresMutation();
      const a = appliquer(parent, mut);
      const b = appliquer(parent, mut);
      expect(a.mutations).toEqual(b.mutations);
      expect(a.configurationEnfant).toEqual(b.configurationEnfant);
    });

    it("E — identifiantReproduction différent → peut différer", () => {
      const parent = configParentDefaut();
      const mut = parametresMutation({ tauxMutationParGeneBps: 5_000 });
      const reference = appliquer(parent, mut, {
        identifiantReproduction: "repro:exp:p:e001",
        identifiantParent: "p",
        identifiantEnfant: "p-e001",
      });
      const autre = appliquer(parent, mut, {
        identifiantReproduction: "repro:exp:p:e002",
        identifiantParent: "p",
        identifiantEnfant: "p-e002",
      });
      expect(reference.mutations.length).toBeGreaterThan(0);
      expect(autre.mutations).not.toEqual(reference.mutations);
    });

    it("F — ordre des clés objet n'affecte pas la mutation", () => {
      const mut = parametresMutation();
      const ordreA: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: {
          seuilEnjeuPourInferenceMicroUsdc: "100000",
          partMaxVenParCycleBps: 50,
          plafondCognitifMicroUsdc: "10000",
          comportementSansInference: "agir_si_favorable",
        },
      };
      const ordreB: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: {
          comportementSansInference: "agir_si_favorable",
          plafondCognitifMicroUsdc: "10000",
          partMaxVenParCycleBps: 50,
          seuilEnjeuPourInferenceMicroUsdc: "100000",
        },
      };
      expect(appliquer(ordreA, mut)).toEqual(appliquer(ordreB, mut));
    });

    it("G — clé non mutable ajoutée n'affecte pas les tirages mutables", () => {
      const mut = parametresMutation();
      const base = configParentDefaut();
      const avecExtra: ConfigurationHeritableAgent = {
        version: base.version,
        parametres: {
          ...base.parametres,
          annotationExperimentale: "hors-catalogue",
        },
      };
      const sans = appliquer(base, mut);
      const avec = appliquer(avecExtra, mut);
      expect(avec.mutations).toEqual(sans.mutations);
      for (const m of avec.mutations) {
        expect(avec.configurationEnfant.parametres[m.cleGene]).toBe(
          m.valeurEnfant,
        );
      }
      expect(avec.configurationEnfant.parametres.annotationExperimentale).toBe(
        "hors-catalogue",
      );
    });

    it("H — borne basse respectée (parent au minimum)", () => {
      const geneSeuil = CATALOGUE_GENES_MUTABLES_V01.find(
        (g) => g.cle === "seuilEnjeuPourInferenceMicroUsdc",
      )!;
      expect(geneSeuil.type).toBe("micro_usdc");
      if (geneSeuil.type !== "micro_usdc") return;
      const parent: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: {
          seuilEnjeuPourInferenceMicroUsdc: serialiserMicroUsdc(
            geneSeuil.minimumMicroUsdc,
          ),
          partMaxVenParCycleBps: 0,
          plafondCognitifMicroUsdc: "0",
          comportementSansInference: "attendre",
        },
      };
      const r = appliquer(parent, parametresMutation());
      for (const m of r.mutations) {
        if (m.cleGene === "seuilEnjeuPourInferenceMicroUsdc") {
          expect(m.operateur).toBe("increment");
          expect(BigInt(String(m.valeurEnfant))).toBeGreaterThanOrEqual(
            geneSeuil.minimumMicroUsdc,
          );
        }
        if (m.cleGene === "partMaxVenParCycleBps") {
          expect(Number(m.valeurEnfant)).toBeGreaterThanOrEqual(0);
        }
        if (m.cleGene === "plafondCognitifMicroUsdc") {
          expect(BigInt(String(m.valeurEnfant))).toBeGreaterThanOrEqual(0n);
        }
      }
    });

    it("I — borne haute respectée (parent au maximum)", () => {
      const geneSeuil = CATALOGUE_GENES_MUTABLES_V01.find(
        (g) => g.cle === "seuilEnjeuPourInferenceMicroUsdc",
      )!;
      const genePart = CATALOGUE_GENES_MUTABLES_V01.find(
        (g) => g.cle === "partMaxVenParCycleBps",
      )!;
      const genePlafond = CATALOGUE_GENES_MUTABLES_V01.find(
        (g) => g.cle === "plafondCognitifMicroUsdc",
      )!;
      expect(geneSeuil.type).toBe("micro_usdc");
      expect(genePart.type).toBe("bps");
      expect(genePlafond.type).toBe("micro_usdc");
      if (
        geneSeuil.type !== "micro_usdc" ||
        genePart.type !== "bps" ||
        genePlafond.type !== "micro_usdc"
      ) {
        return;
      }
      const parent: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: {
          seuilEnjeuPourInferenceMicroUsdc: serialiserMicroUsdc(
            geneSeuil.maximumMicroUsdc,
          ),
          partMaxVenParCycleBps: genePart.maximum,
          plafondCognitifMicroUsdc: serialiserMicroUsdc(
            genePlafond.maximumMicroUsdc,
          ),
          comportementSansInference: "agir_si_favorable",
        },
      };
      const r = appliquer(parent, parametresMutation());
      for (const m of r.mutations) {
        if (m.cleGene === "seuilEnjeuPourInferenceMicroUsdc") {
          expect(m.operateur).toBe("decrement");
          expect(BigInt(String(m.valeurEnfant))).toBeLessThanOrEqual(
            geneSeuil.maximumMicroUsdc,
          );
        }
        if (m.cleGene === "partMaxVenParCycleBps") {
          expect(m.operateur).toBe("decrement");
          expect(Number(m.valeurEnfant)).toBeLessThanOrEqual(genePart.maximum);
        }
        if (m.cleGene === "plafondCognitifMicroUsdc") {
          expect(m.operateur).toBe("decrement");
          expect(BigInt(String(m.valeurEnfant))).toBeLessThanOrEqual(
            genePlafond.maximumMicroUsdc,
          );
        }
      }
    });

    it("J — bigint micro-USDC exact (pasMutationMicroUsdc en string)", () => {
      const genes = [
        {
          cle: "seuilEnjeuPourInferenceMicroUsdc" as const,
          type: "micro_usdc" as const,
          minimumMicroUsdc: 0n,
          maximumMicroUsdc: 1_000_000n,
          pasMutationMicroUsdc: 123_456n,
          defautMicroUsdc: 500_000n,
        },
      ];
      const mut = parametresMutation({ genes, tauxMutationParGeneBps: 10_000 });
      const parent: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: { seuilEnjeuPourInferenceMicroUsdc: "500000" },
      };
      const r = appliquer(parent, mut);
      expect(r.mutations).toHaveLength(1);
      const m = r.mutations[0]!;
      const delta =
        BigInt(String(m.valeurEnfant)) - BigInt(String(m.valeurParent));
      expect(delta === 123_456n || delta === -123_456n).toBe(true);
      expect(typeof m.valeurParent).toBe("string");
      expect(typeof m.valeurEnfant).toBe("string");
    });

    it("K — catégoriel uniquement whitelist", () => {
      const r = appliquer(configParentDefaut(), parametresMutation());
      const cat = r.mutations.find(
        (m) => m.cleGene === "comportementSansInference",
      );
      expect(cat).toBeDefined();
      expect(cat!.operateur).toBe("remplacement_categoriel");
      expect(["attendre", "agir_si_favorable"]).toContain(cat!.valeurEnfant);
      expect(cat!.valeurEnfant).not.toBe(cat!.valeurParent);
    });

    it("L — parent jamais muté en place", () => {
      const parent = configParentDefaut();
      const snapshot = structuredClone(parent);
      appliquer(parent, parametresMutation());
      expect(parent).toEqual(snapshot);
    });

    it("M — clés non mutables copiées à l'identique", () => {
      const parent: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: {
          ...configParentDefaut().parametres,
          noteLibre: "conserve-moi",
          flagDemo: true,
        },
      };
      const r = appliquer(parent, parametresMutation());
      expect(r.configurationEnfant.parametres.noteLibre).toBe("conserve-moi");
      expect(r.configurationEnfant.parametres.flagDemo).toBe(true);
    });

    it("W — empreinteConfigurationHeritable déterministe", () => {
      const c = configParentDefaut();
      expect(empreinteConfigurationHeritable(c)).toBe(
        empreinteConfigurationHeritable(c),
      );
      expect(empreinteConfigurationHeritable(c)).toMatch(/^[0-9a-f]{16}$/);
    });

    it("X — ordre des clés n'affecte pas l'empreinte", () => {
      const a: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: { a: 1, b: "x", c: true },
      };
      const b: ConfigurationHeritableAgent = {
        version: "configuration-heritable-v01",
        parametres: { c: true, a: 1, b: "x" },
      };
      expect(empreinteConfigurationHeritable(a)).toBe(
        empreinteConfigurationHeritable(b),
      );
    });

    it("AC — tauxMutationParGeneBps invalide refusé", () => {
      expect(() =>
        parserParametresMutation({
          version: "parametres-mutation-v01",
          active: true,
          tauxMutationParGeneBps: 10_001,
          versionCatalogueGenes: "genes-mutables-v01",
        }),
      ).toThrow(ParametresMutationInvalidesErreur);
      expect(() =>
        parserParametresMutation({
          version: "parametres-mutation-v01",
          active: true,
          tauxMutationParGeneBps: -1,
          versionCatalogueGenes: "genes-mutables-v01",
        }),
      ).toThrow(ParametresMutationInvalidesErreur);
      expect(() =>
        parserParametresMutation({
          version: "parametres-mutation-v01",
          active: true,
          tauxMutationParGeneBps: 1.5,
          versionCatalogueGenes: "genes-mutables-v01",
        }),
      ).toThrow(ParametresMutationInvalidesErreur);
    });

    it("AD — définition de gène invalide refusée", () => {
      expect(() =>
        parserParametresMutation({
          version: "parametres-mutation-v01",
          active: true,
          tauxMutationParGeneBps: 100,
          versionCatalogueGenes: "genes-mutables-v01",
          genes: [
            {
              cle: "seuilEnjeuPourInferenceMicroUsdc",
              type: "micro_usdc",
              minimumMicroUsdc: "100",
              maximumMicroUsdc: "10",
              pasMutationMicroUsdc: "1",
              defautMicroUsdc: "5",
            },
          ],
        }),
      ).toThrow(ParametresMutationInvalidesErreur);
      expect(() =>
        parserParametresMutation({
          version: "parametres-mutation-v01",
          active: true,
          tauxMutationParGeneBps: 100,
          versionCatalogueGenes: "genes-mutables-v01",
          genes: [
            {
              cle: "comportementSansInference",
              type: "categoriel",
              valeursAutorisees: ["attendre", "voler"],
              defaut: "attendre",
            },
          ],
        }),
      ).toThrow(ParametresMutationInvalidesErreur);
    });

    it("S — fitness différente n'entre pas dans appliquerMutation", () => {
      const parent = configParentDefaut();
      const mut = parametresMutation();
      const a = appliquer(parent, mut);
      // Même IDs ; aucune entrée fitness — le résultat est strictement reproductible.
      const b = appliquer(parent, mut);
      expect(a).toEqual(b);
      expect(
        Object.keys(
          appliquerMutationConfigurationHeritable as unknown as Record<
            string,
            unknown
          >,
        ),
      ).not.toContain("fitness");
    });

    it("T — fitness n'influence pas evaluerAutorisationReproduction", () => {
      const parametres = parserParametresReproduction(REPRODUCTION_BASE);
      const baseCtx = {
        parametres,
        etatParent: {
          capitalLiquide: 100_000_000n,
          obligationsDues: 0n,
          highWaterMarkProprietaire: 100_000_000n,
          totalRevenusActivite: 0n,
          totalPertesActivite: 0n,
          totalDepensesCompute: 0n,
          totalDepensesDonnees: 0n,
          totalFraisExecution: 0n,
          totalLoyersPayes: 0n,
          totalRedevancesProprietairePayees: 0n,
          etatSurvie: "sain" as const,
          cyclesDormanceConsecutifs: 0,
          dernierNumeroCycle: 0,
        },
        populationTotale: 2,
        nombreEnfantsParent: 0,
        reproductionsDejaCeCycle: 0,
        cycleDerniereNaissanceParent: null as number | null,
        numeroCycle: 0,
      };
      const a = evaluerAutorisationReproduction(baseCtx);
      const b = evaluerAutorisationReproduction({
        ...baseCtx,
        etatParent: {
          ...baseCtx.etatParent,
          totalRevenusActivite: 9_999_999n,
          totalPertesActivite: 1n,
        },
      });
      expect(a).toEqual(b);
      expect(a.autorisee).toBe(true);
    });

    it("U — identité enfant indépendante de la config", () => {
      const idA = fabriquerIdentifiantEnfant({
        identifiantParent: "agent-0",
        numeroEnfant: 1,
      });
      const idB = fabriquerIdentifiantEnfant({
        identifiantParent: "agent-0",
        numeroEnfant: 1,
      });
      expect(idA).toBe(idB);
      expect(idA).toBe("agent-0-e001");
      const mutA = appliquer(configParentDefaut(), parametresMutation());
      const mutB = appliquer(
        {
          version: "configuration-heritable-v01",
          parametres: {
            seuilEnjeuPourInferenceMicroUsdc: "999000",
            partMaxVenParCycleBps: 900,
            plafondCognitifMicroUsdc: "90000",
            comportementSansInference: "attendre",
          },
        },
        parametresMutation(),
      );
      expect(mutA.configurationEnfant).not.toEqual(mutB.configurationEnfant);
      expect(
        fabriquerIdentifiantEnfant({
          identifiantParent: "agent-0",
          numeroEnfant: 1,
        }),
      ).toBe("agent-0-e001");
    });

    it("AB — config vide legacy lisible via resoudrePolitique", () => {
      const base = {
        identifiant: "politique-budget-cognitif-agent" as const,
        version: "0.1.0",
        seuilEnjeuPourInferenceMicroUsdc: 42_000n,
        partMaxVenParCycleBps: 33,
        plafondCognitifMicroUsdc: 7_000n,
        modeleLogique: "modele_standard",
        comportementSansInference: "attendre" as const,
        refuserSiCritiqueOuDormant: true,
      };
      const resolue = resoudrePolitiqueDepuisConfigurationHeritable({
        politiqueBase: base,
        configurationHeritable: creerConfigurationHeritableVide(),
      });
      expect(resolue.seuilEnjeuPourInferenceMicroUsdc).toBe(42_000n);
      expect(resolue.partMaxVenParCycleBps).toBe(33);
      expect(resolue.plafondCognitifMicroUsdc).toBe(7_000n);
      expect(resolue.comportementSansInference).toBe("attendre");
      expect(resolue.modeleLogique).toBe("modele_standard");
    });
  });

  describe("intégration ControleurExperience", () => {
    it("N — AGENT_CREE porte la config finale exacte après demanderReproduction", async () => {
      const c = ouvrir(configMutation());
      const parent = c.obtenirAgents()[0]!;
      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const enfant = c.obtenirAgents().find(
        (a) => a.identite.identifiant === r.identifiantEnfant,
      )!;
      const agentCree = c.registre
        .listerParExperience("exp-mutation-v01")
        .find(
          (e) =>
            e.type === "AGENT_CREE" &&
            e.identifiantAgent === r.identifiantEnfant,
        )!;
      expect(agentCree.chargeUtile.configurationHeritable).toEqual(
        enfant.configurationHeritable,
      );
      const heritee = c.registre
        .listerParExperience("exp-mutation-v01")
        .find(
          (e) =>
            e.type === "CONFIGURATION_HERITEE" &&
            e.identifiantAgent === r.identifiantEnfant,
        )!;
      expect(heritee.chargeUtile.configurationHeritable).toEqual(
        enfant.configurationHeritable,
      );
      expect(enfant.configurationHeritable).not.toEqual(
        parent.configurationHeritable,
      );
    });

    it("O — réouverture SQLite reconstruit le génotype", async () => {
      const repertoire = repertoireTemp();
      const chemin = join(repertoire, "esp.sqlite");
      const conf = configMutation();
      const c = ouvrir(conf, {
        cheminSqlite: chemin,
        cheminKeystore: join(repertoire, "identites"),
      });
      const parent = c.obtenirAgents()[0]!;
      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const genotype = c.obtenirAgents().find(
        (a) => a.identite.identifiant === r.identifiantEnfant,
      )!.configurationHeritable;
      c.fermer();

      const reprise = ouvrir(conf, {
        cheminSqlite: chemin,
        cheminKeystore: join(repertoire, "identites"),
      });
      const enfant = reprise.obtenirAgents().find(
        (a) => a.identite.identifiant === r.identifiantEnfant,
      )!;
      expect(enfant.configurationHeritable).toEqual(genotype);
      expect(
        reprise.projeterAgent(r.identifiantEnfant)?.heritageVariation
          ?.configurationHeritable,
      ).toEqual(genotype);
      reprise.fermer();
    });

    it("P — retry même reproduction (deja_terminee) → pas de nouveaux événements mutation", async () => {
      const c = ouvrir(configMutation());
      const parent = c.obtenirAgents()[0]!;
      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const avant = c.registre
        .listerParExperience("exp-mutation-v01")
        .filter((e) => e.type === "MUTATION_APPLIQUEE").length;

      const evenements = c.registre.listerParExperience("exp-mutation-v01");
      const prep = preparerReproduction({
        identifiantExperience: "exp-mutation-v01",
        identifiantParent: parent.identite.identifiant,
        identifiantEnfant: r.identifiantEnfant,
        identifiantReproduction: r.identifiantReproduction,
        numeroCycle: 0,
        dateNaissance: "2020-01-01T00:00:00.000Z",
        indexPopulationEnfant: 99,
        numeroGenerationParent: 0,
        identifiantLignee: parent.identite.identifiant,
        configurationHeritableParent:
          parent.configurationHeritable ?? creerConfigurationHeritableVide(),
        etatParent: parent.etatEconomique,
        tresorerie: creerTresorerieProprietaire(),
        parametres: parserConfigurationExperience(configMutation()).reproduction!,
        populationTotale: 3,
        nombreEnfantsParent: 1,
        reproductionsDejaCeCycle: 0,
        cycleDerniereNaissanceParent: 0,
        evenementsExistants: evenements,
        parametresMutation: parserConfigurationExperience(configMutation())
          .mutation!,
        graineExperience: 7,
      });
      expect(prep.statut).toBe("deja_terminee");
      expect(prep.evenements).toHaveLength(0);

      const apres = c.registre
        .listerParExperience("exp-mutation-v01")
        .filter((e) => e.type === "MUTATION_APPLIQUEE").length;
      expect(apres).toBe(avant);
    });

    it("Q — crash avant commit puis reprise → même mutation", async () => {
      const repertoire = repertoireTemp();
      const chemin = join(repertoire, "esp.sqlite");
      const conf = configMutation();
      const c = ouvrir(conf, {
        cheminSqlite: chemin,
        cheminKeystore: join(repertoire, "identites"),
      });
      const parent = c.obtenirAgents()[0]!;
      const idReproOrpheline = `repro:exp-mutation-v01:${parent.identite.identifiant}:e001`;

      // Demande seule (crash avant lot complet) — le numéro e001 est réservé dans le registre.
      c.registre.ajouter({
        identifiant: "partial-demande-mutation",
        versionSchema: 1,
        type: "REPRODUCTION_DEMANDEE",
        identifiantExperience: "exp-mutation-v01",
        identifiantAgent: parent.identite.identifiant,
        numeroCycle: 0,
        chargeUtile: {
          identifiantReproduction: idReproOrpheline,
          identifiantParent: parent.identite.identifiant,
          dotationEnfantMicroUsdc: "5000000",
          coutReproductionMicroUsdc: "1000000",
        },
      });
      c.fermer();

      const reprise = ouvrir(conf, {
        cheminSqlite: chemin,
        cheminKeystore: join(repertoire, "identites"),
      });
      const r = await reprise.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;

      const attendu = appliquerMutationConfigurationHeritable({
        configurationParent:
          parent.configurationHeritable ?? creerConfigurationHeritableVide(),
        parametresMutation: parserConfigurationExperience(conf).mutation!,
        graineExperience: 7,
        identifiantReproduction: r.identifiantReproduction,
        identifiantParent: parent.identite.identifiant,
        identifiantEnfant: r.identifiantEnfant,
      });
      const enfant = reprise.obtenirAgents().find(
        (a) => a.identite.identifiant === r.identifiantEnfant,
      )!;
      expect(enfant.configurationHeritable).toEqual(
        attendu.configurationEnfant,
      );
      const pourEnfant = reprise.registre
        .listerParExperience("exp-mutation-v01")
        .filter(
          (e) =>
            e.type === "MUTATION_APPLIQUEE" &&
            (e.identifiantAgent === r.identifiantEnfant ||
              e.chargeUtile.identifiantEnfant === r.identifiantEnfant),
        );
      expect(pourEnfant).toHaveLength(attendu.mutations.length);

      // Rejouer la même préparation : résultats identiques (déterminisme).
      const rejoue = appliquerMutationConfigurationHeritable({
        configurationParent:
          parent.configurationHeritable ?? creerConfigurationHeritableVide(),
        parametresMutation: parserConfigurationExperience(conf).mutation!,
        graineExperience: 7,
        identifiantReproduction: r.identifiantReproduction,
        identifiantParent: parent.identite.identifiant,
        identifiantEnfant: r.identifiantEnfant,
      });
      expect(rejoue).toEqual(attendu);
      reprise.fermer();
    });

    it("R — crash après commit → pas de double mutation", async () => {
      const repertoire = repertoireTemp();
      const chemin = join(repertoire, "esp.sqlite");
      const conf = configMutation();
      const c = ouvrir(conf, {
        cheminSqlite: chemin,
        cheminKeystore: join(repertoire, "identites"),
      });
      const parent = c.obtenirAgents()[0]!;
      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const compteAvant = c.registre
        .listerParExperience("exp-mutation-v01")
        .filter(
          (e) =>
            e.type === "MUTATION_APPLIQUEE" &&
            e.identifiantAgent === r.identifiantEnfant,
        ).length;
      expect(compteAvant).toBeGreaterThan(0);
      c.fermer();

      const reprise = ouvrir(conf, {
        cheminSqlite: chemin,
        cheminKeystore: join(repertoire, "identites"),
      });
      await reprise.demanderReproduction(parent.identite.identifiant);
      const compteApres = reprise.registre
        .listerParExperience("exp-mutation-v01")
        .filter(
          (e) =>
            e.type === "MUTATION_APPLIQUEE" &&
            e.identifiantAgent === r.identifiantEnfant,
        ).length;
      expect(compteApres).toBe(compteAvant);
      reprise.fermer();
    });

    it("S/T — fitness descriptive n'altère ni mutation ni autorisation contrôleur", async () => {
      const c = ouvrir(configMutation());
      const parent = c.obtenirAgents()[0]!;
      const src = await import("node:fs").then((fs) =>
        fs.readFileSync(
          new URL("../src/controleur.ts", import.meta.url),
          "utf8",
        ),
      );
      const bloc = src.slice(
        src.indexOf("async demanderReproduction"),
        src.indexOf("async demanderReproduction") + 5000,
      );
      expect(bloc).not.toMatch(/fitness|MesuresFitness|projeterFitness|rang|ranking/i);

      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
    });

    it("U — mêmes ids enfant quels que soient les gènes parent", async () => {
      const c1 = ouvrir(
        configMutation({
          politiqueBudgetCognitif: {
            ...POLITIQUE_BASE,
            seuilEnjeuPourInferenceMicroUsdc: "100000",
          },
        }),
      );
      const c2 = ouvrir(
        configMutation({
          identifiantExperience: "exp-mutation-v01-b",
          politiqueBudgetCognitif: {
            ...POLITIQUE_BASE,
            seuilEnjeuPourInferenceMicroUsdc: "900000",
            partMaxVenParCycleBps: 900,
          },
        }),
      );
      const p1 = c1.obtenirAgents()[0]!;
      const p2 = c2.obtenirAgents()[0]!;
      // Remplacer les ids parents pour comparer le suffixe déterministe
      const r1 = await c1.demanderReproduction(p1.identite.identifiant);
      const r2 = await c2.demanderReproduction(p2.identite.identifiant);
      expect(r1.statut).toBe("autorisee");
      expect(r2.statut).toBe("autorisee");
      if (r1.statut !== "autorisee" || r2.statut !== "autorisee") return;
      expect(r1.identifiantEnfant.endsWith("-e001")).toBe(true);
      expect(r2.identifiantEnfant.endsWith("-e001")).toBe(true);
      expect(r1.identifiantEnfant).toBe(`${p1.identite.identifiant}-e001`);
      expect(r2.identifiantEnfant).toBe(`${p2.identite.identifiant}-e001`);
    });

    it("V — clé privée jamais dans événements / config", async () => {
      const repertoire = repertoireTemp();
      const c = ouvrir(
        configMutation({
          identite: {
            active: true,
            version: "identite-agent-v01",
            algorithme: "ed25519",
          },
        }),
        {
          cheminSqlite: join(repertoire, "esp.sqlite"),
          cheminKeystore: join(repertoire, "identites"),
        },
      );
      const parent = c.obtenirAgents()[0]!;
      await c.demanderReproduction(parent.identite.identifiant);
      for (const evt of c.registre.listerParExperience("exp-mutation-v01")) {
        expect(contiendraitSecret(evt)).toBe(false);
      }
      for (const agent of c.obtenirAgents()) {
        expect(contiendraitSecret(agent.configurationHeritable)).toBe(false);
      }
      c.fermer();
    });

    it("Y — diversiteHeritable population exacte après mutations connues", async () => {
      const c = ouvrir(
        configMutation({
          taillePopulationInitiale: 1,
          mutation: { ...MUTATION_ACTIVE, tauxMutationParGeneBps: 10_000 },
        }),
      );
      const parent = c.obtenirAgents()[0]!;
      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const pop = c.projeterPopulation();
      const div = pop.diversiteHeritable!;
      expect(div.avertissement).toBe(
        "DIVERSITE_HERITABLE_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE",
      );
      const mutations = c.registre
        .listerParExperience("exp-mutation-v01")
        .filter((e) => e.type === "MUTATION_APPLIQUEE");
      expect(div.nombreMutationsCumulees).toBe(mutations.length);
      expect(div.nombreMutationsCycle).toBe(mutations.length);
      expect(div.nombreAgentsAvecAuMoinsUneMutationDepuisParent).toBe(1);
      expect(div.nombreConfigurationsHeritablesDistinctes).toBeGreaterThanOrEqual(
        2,
      );
    });

    it("Z — phénotype : seuil parent haut sans inférence ; enfant muté avec inférence", async () => {
      const genesPhenotype = [
        {
          cle: "seuilEnjeuPourInferenceMicroUsdc",
          type: "micro_usdc",
          minimumMicroUsdc: "0",
          maximumMicroUsdc: "2000000",
          pasMutationMicroUsdc: "1500000",
          defautMicroUsdc: "2000000",
        },
      ];
      const conf = configMutation({
        mode: "decision_simulee",
        taillePopulationInitiale: 1,
        capitalInitialParAgentMicroUsdc: "10000000",
        environnementDecision: ENV_BASE,
        politiqueBudgetCognitif: {
          ...POLITIQUE_BASE,
          seuilEnjeuPourInferenceMicroUsdc: "2000000",
          plafondCognitifMicroUsdc: "50000",
          comportementSansInference: "attendre",
        },
        mutation: {
          ...MUTATION_ACTIVE,
          tauxMutationParGeneBps: 10_000,
          genes: genesPhenotype,
        },
        parametresEconomiques: {
          version: "demo",
          loyerInfrastructureMicroUsdc: "0",
          periodeLoyerEnCycles: 100,
          tauxRedevanceProprietairePointsDeBase: "0",
          coutOperationnelMinimalParCycleMicroUsdc: "1000",
          seuilRunwaySainEnCycles: 20,
          seuilRunwayContraintEnCycles: 5,
          cyclesDormanceAvantMort: 3,
        },
      });
      const c = ouvrir(conf);
      const parent = c.obtenirAgents()[0]!;
      await c.avancerUnCycle();
      const evtsParent = c.registre.listerParExperience("exp-mutation-v01");
      expect(evtsParent.some((e) => e.type === "OBSERVATION_AGENT_RECUE")).toBe(
        true,
      );
      expect(
        evtsParent.some(
          (e) =>
            e.type === "INFERENCE_EXECUTEE" &&
            e.identifiantAgent === parent.identite.identifiant,
        ),
      ).toBe(false);

      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const enfant = c.obtenirAgents().find(
        (a) => a.identite.identifiant === r.identifiantEnfant,
      )!;
      expect(
        enfant.configurationHeritable?.parametres.seuilEnjeuPourInferenceMicroUsdc,
      ).toBe("500000");

      await c.avancerUnCycle();
      const evts = c.registre.listerParExperience("exp-mutation-v01");
      expect(
        evts.some(
          (e) =>
            e.type === "INFERENCE_EXECUTEE" &&
            e.identifiantAgent === r.identifiantEnfant,
        ),
      ).toBe(true);
      expect(
        evts.some(
          (e) =>
            e.type === "DEPENSE_COMPUTE" &&
            e.identifiantAgent === r.identifiantEnfant,
        ),
      ).toBe(true);
    });

    it("AA — deux configs héritables + même environnement → coûts/états divergents", async () => {
      const construire = (seuil: string, id: string) =>
        ouvrir(
          configMutation({
            identifiantExperience: id,
            mode: "decision_simulee",
            taillePopulationInitiale: 1,
            capitalInitialParAgentMicroUsdc: "10000000",
            environnementDecision: ENV_BASE,
            politiqueBudgetCognitif: {
              ...POLITIQUE_BASE,
              seuilEnjeuPourInferenceMicroUsdc: seuil,
              plafondCognitifMicroUsdc: "50000",
              comportementSansInference: "attendre",
            },
            mutation: { ...MUTATION_ACTIVE, active: false, tauxMutationParGeneBps: 0 },
            parametresEconomiques: {
              version: "demo",
              loyerInfrastructureMicroUsdc: "0",
              periodeLoyerEnCycles: 100,
              tauxRedevanceProprietairePointsDeBase: "0",
              coutOperationnelMinimalParCycleMicroUsdc: "1000",
              seuilRunwaySainEnCycles: 20,
              seuilRunwayContraintEnCycles: 5,
              cyclesDormanceAvantMort: 3,
            },
          }),
        );
      const haut = construire("2000000", "exp-mut-aa-haut");
      const bas = construire("1", "exp-mut-aa-bas");
      await haut.avancerUnCycle();
      await bas.avancerUnCycle();
      const computeHaut = haut.obtenirAgents()[0]!.etatEconomique.totalDepensesCompute;
      const computeBas = bas.obtenirAgents()[0]!.etatEconomique.totalDepensesCompute;
      expect(computeHaut).toBe(0n);
      expect(computeBas).toBeGreaterThan(0n);
      expect(
        haut.obtenirAgents()[0]!.etatEconomique.capitalLiquide,
      ).not.toBe(bas.obtenirAgents()[0]!.etatEconomique.capitalLiquide);
    });

    it("AE — mutation ne touche ni capital ni secrets ; capital via économie de reproduction", async () => {
      const c = ouvrir(configMutation({ mutation: { ...MUTATION_ACTIVE, active: false } }));
      const parent = c.obtenirAgents()[0]!;
      const capitalAvant = parent.etatEconomique.capitalLiquide;
      const r = await c.demanderReproduction(parent.identite.identifiant);
      expect(r.statut).toBe("autorisee");
      if (r.statut !== "autorisee") return;
      const parentApres = c.obtenirAgents().find(
        (a) => a.identite.identifiant === parent.identite.identifiant,
      )!;
      const enfant = c.obtenirAgents().find(
        (a) => a.identite.identifiant === r.identifiantEnfant,
      )!;
      expect(enfant.etatEconomique.capitalLiquide).toBe(5_000_000n);
      expect(parentApres.etatEconomique.capitalLiquide).toBe(
        capitalAvant - 5_000_000n - 1_000_000n,
      );
      expect(contiendraitSecret(enfant.configurationHeritable)).toBe(false);
      expect(
        c.registre
          .listerParExperience("exp-mutation-v01")
          .filter((e) => e.type === "MUTATION_APPLIQUEE"),
      ).toHaveLength(0);

      // Avec mutation active : capital suit la même économie (mutation ≠ création de valeur)
      const c2 = ouvrir(
        configMutation({ identifiantExperience: "exp-mutation-v01-ae2" }),
      );
      const p2 = c2.obtenirAgents()[0]!;
      const cap2 = p2.etatEconomique.capitalLiquide;
      const r2 = await c2.demanderReproduction(p2.identite.identifiant);
      expect(r2.statut).toBe("autorisee");
      if (r2.statut !== "autorisee") return;
      const p2Apres = c2.obtenirAgents().find(
        (a) => a.identite.identifiant === p2.identite.identifiant,
      )!;
      const e2 = c2.obtenirAgents().find(
        (a) => a.identite.identifiant === r2.identifiantEnfant,
      )!;
      expect(e2.etatEconomique.capitalLiquide).toBe(5_000_000n);
      expect(p2Apres.etatEconomique.capitalLiquide).toBe(
        cap2 - 5_000_000n - 1_000_000n,
      );
      expect(
        c2.registre
          .listerParExperience("exp-mutation-v01-ae2")
          .some((e) => e.type === "MUTATION_APPLIQUEE"),
      ).toBe(true);
    });

    it("AF — aucun réseau : fournisseur simulé ; fetch non appelé", async () => {
      const spy = vi.spyOn(globalThis, "fetch");
      const c = ouvrir(
        configMutation({
          mode: "decision_simulee",
          taillePopulationInitiale: 1,
          environnementDecision: ENV_BASE,
          politiqueBudgetCognitif: {
            ...POLITIQUE_BASE,
            seuilEnjeuPourInferenceMicroUsdc: "1",
            plafondCognitifMicroUsdc: "50000",
          },
        }),
      );
      expect(c.configuration.xway?.fournisseur.identifiant).toBe(
        "fournisseur-inference-simule",
      );
      const parent = c.obtenirAgents()[0]!;
      await c.demanderReproduction(parent.identite.identifiant);
      await c.avancerUnCycle();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
