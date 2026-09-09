/**
 * Contrôle positif de sensibilité phénotypique v0.2.
 * Démontre qu'une différence de génotype héritable produit une divergence
 * observable sur la voie décisionnelle (choix / décision / action).
 *
 * Sans réseau, déterministe, reproductible.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ControleurExperience,
  parserConfigurationExperience,
  type ConfigurationExperienceJson,
} from "@esp/controleur";
import type { EvenementEsp } from "@esp/protocole";
import { DATE_EVENEMENTS_FIXES_EVOLUTION } from "./conditions.js";

const DATE_FIXE = DATE_EVENEMENTS_FIXES_EVOLUTION;

export class ControleSensibilitePhenotypiqueErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControleSensibilitePhenotypiqueErreur";
  }
}

export type ResultatControleSensibilite = {
  readonly ok: boolean;
  readonly controle: "A" | "B" | "C" | "D";
  readonly detail: string;
};

const XWAY_SIMULE = {
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

const PARAMS_ECO_LEGER = {
  version: "demo-sensibilite-v02",
  loyerInfrastructureMicroUsdc: "0",
  periodeLoyerEnCycles: 100,
  tauxRedevanceProprietairePointsDeBase: "0",
  coutOperationnelMinimalParCycleMicroUsdc: "1000",
  seuilRunwaySainEnCycles: 20,
  seuilRunwayContraintEnCycles: 5,
  cyclesDormanceAvantMort: 3,
};

function repertoireTemp(): string {
  return mkdtempSync(join(tmpdir(), "esp-sensibilite-v02-"));
}

function ouvrirControleur(
  confJson: ConfigurationExperienceJson,
): ControleurExperience {
  const conf = parserConfigurationExperience(confJson);
  const repertoire = repertoireTemp();
  const cheminSqlite = join(repertoire, "esp.sqlite");
  const cheminKeystore = join(repertoire, "identites");
  const controleur = ControleurExperience.ouvrir({
    configuration: conf,
    cheminSqlite,
    cheminKeystoreIdentites: cheminKeystore,
    dateCreationFixe: DATE_FIXE,
    datesEvenementsFixes: DATE_FIXE,
  });
  // Attache le répertoire pour nettoyage via symbole local
  (
    controleur as ControleurExperience & { __repertoireTemp?: string }
  ).__repertoireTemp = repertoire;
  return controleur;
}

function fermerControleur(controleur: ControleurExperience): void {
  const repertoire = (
    controleur as ControleurExperience & { __repertoireTemp?: string }
  ).__repertoireTemp;
  controleur.fermer();
  if (repertoire !== undefined) {
    rmSync(repertoire, { recursive: true, force: true });
  }
}

function construireConfigBase(options: {
  readonly identifiantExperience: string;
  readonly graineSimulation: number;
  readonly capitalInitialParAgentMicroUsdc: string;
  readonly environnementDecision: NonNullable<
    ConfigurationExperienceJson["environnementDecision"]
  >;
  readonly politiqueBudgetCognitif: NonNullable<
    ConfigurationExperienceJson["politiqueBudgetCognitif"]
  >;
  readonly mutation?: ConfigurationExperienceJson["mutation"];
  readonly reproduction?: ConfigurationExperienceJson["reproduction"];
}): ConfigurationExperienceJson {
  return {
    identifiantExperience: options.identifiantExperience,
    versionProtocole: "0.2.0",
    mode: "decision_simulee",
    graineSimulation: options.graineSimulation,
    taillePopulationInitiale: 1,
    capitalInitialParAgentMicroUsdc: options.capitalInitialParAgentMicroUsdc,
    parametresEconomiques: PARAMS_ECO_LEGER,
    environnementDecision: options.environnementDecision,
    politiqueBudgetCognitif: options.politiqueBudgetCognitif,
    xway: XWAY_SIMULE,
    ...(options.mutation !== undefined ? { mutation: options.mutation } : {}),
    ...(options.reproduction !== undefined
      ? { reproduction: options.reproduction }
      : {}),
    criteresArret: {
      version: "criteres-arret-experience-v01",
      cycleMaximum: 5,
    },
  };
}

function evenementsExperience(
  controleur: ControleurExperience,
): EvenementEsp[] {
  return [
    ...controleur.registre.listerParExperience(
      controleur.configuration.identifiantExperience,
    ),
  ];
}

function choixCognitifsAgent(
  evenements: readonly EvenementEsp[],
  identifiantAgent: string,
): EvenementEsp[] {
  return evenements.filter(
    (e) =>
      e.type === "CHOIX_COGNITIF_EFFECTUE" &&
      e.identifiantAgent === identifiantAgent,
  );
}

function decisionsValideesAgent(
  evenements: readonly EvenementEsp[],
  identifiantAgent: string,
): EvenementEsp[] {
  return evenements.filter(
    (e) =>
      e.type === "DECISION_AGENT_VALIDEE" &&
      e.identifiantAgent === identifiantAgent,
  );
}

function actionsExecuteesAgent(
  evenements: readonly EvenementEsp[],
  identifiantAgent: string,
): EvenementEsp[] {
  return evenements.filter(
    (e) =>
      e.type === "ACTION_ENVIRONNEMENT_EXECUTEE" &&
      e.identifiantAgent === identifiantAgent,
  );
}

/**
 * Contrôle A — comportementSansInference diverge l'action enregistrée.
 * Situation sans inférence + EV strictement positive.
 */
export async function executerControleAComportementSansInference(): Promise<ResultatControleSensibilite> {
  const env = {
    identifiant: "environnement-opportunites-simulees" as const,
    version: "0.1.0",
    probabiliteSuccesBaseBps: 8000,
    amplitudeProbabiliteBps: 0,
    gainSiSuccesMicroUsdc: "125000",
    perteSiEchecMicroUsdc: "50000",
    fraisActionMicroUsdc: "1000",
    fraisAttendreMicroUsdc: "0",
  };
  // Seuil > enjeu (125000) → force sans inférence.
  const politiqueCommun = {
    identifiant: "politique-budget-cognitif-agent" as const,
    version: "0.1.0",
    seuilEnjeuPourInferenceMicroUsdc: "200000",
    partMaxVenParCycleBps: 50,
    plafondCognitifMicroUsdc: "10000",
    modeleLogique: "modele_standard",
    refuserSiCritiqueOuDormant: true,
  };

  const c0 = ouvrirControleur(
    construireConfigBase({
      identifiantExperience: "ctrl-a-g0-agir",
      graineSimulation: 42,
      capitalInitialParAgentMicroUsdc: "8000000",
      environnementDecision: env,
      politiqueBudgetCognitif: {
        ...politiqueCommun,
        comportementSansInference: "agir_si_favorable",
      },
    }),
  );
  const c1 = ouvrirControleur(
    construireConfigBase({
      identifiantExperience: "ctrl-a-g1-attendre",
      graineSimulation: 42,
      capitalInitialParAgentMicroUsdc: "8000000",
      environnementDecision: env,
      politiqueBudgetCognitif: {
        ...politiqueCommun,
        comportementSansInference: "attendre",
      },
    }),
  );

  try {
    await c0.avancerUnCycle();
    await c1.avancerUnCycle();
    const agent0 = c0.obtenirAgents()[0]!.identite.identifiant;
    const agent1 = c1.obtenirAgents()[0]!.identite.identifiant;
    const ev0 = evenementsExperience(c0);
    const ev1 = evenementsExperience(c1);

    const decisions0 = decisionsValideesAgent(ev0, agent0);
    const decisions1 = decisionsValideesAgent(ev1, agent1);
    const actions0 = actionsExecuteesAgent(ev0, agent0);
    const actions1 = actionsExecuteesAgent(ev1, agent1);

    if (decisions0.length === 0 || decisions1.length === 0) {
      return {
        ok: false,
        controle: "A",
        detail: "DECISION_AGENT_VALIDEE absente — voie décisionnelle non traversée",
      };
    }

    const action0 = String(
      (decisions0[0]!.chargeUtile as { action?: string }).action ?? "",
    );
    const action1 = String(
      (decisions1[0]!.chargeUtile as { action?: string }).action ?? "",
    );
    const actionEnv0 = String(
      (actions0[0]?.chargeUtile as { action?: string } | undefined)?.action ??
        action0,
    );
    const actionEnv1 = String(
      (actions1[0]?.chargeUtile as { action?: string } | undefined)?.action ??
        action1,
    );

    const ok =
      action0 === "agir" &&
      action1 === "attendre" &&
      actionEnv0 === "agir" &&
      actionEnv1 === "attendre";

    return {
      ok,
      controle: "A",
      detail: ok
        ? "G0 agir / G1 attendre sur DECISION_AGENT_VALIDEE et ACTION_ENVIRONNEMENT_EXECUTEE"
        : `divergence absente ou incorrecte : G0=${action0}/${actionEnv0} G1=${action1}/${actionEnv1}`,
    };
  } finally {
    fermerControleur(c0);
    fermerControleur(c1);
  }
}

/**
 * Contrôle B — seuil d'inférence : enjeu entre deux seuils → choix cognitifs divergents.
 */
export async function executerControleBSeuilInference(): Promise<ResultatControleSensibilite> {
  const env = {
    identifiant: "environnement-opportunites-simulees" as const,
    version: "0.1.0",
    probabiliteSuccesBaseBps: 6000,
    amplitudeProbabiliteBps: 0,
    gainSiSuccesMicroUsdc: "125000",
    perteSiEchecMicroUsdc: "50000",
    fraisActionMicroUsdc: "1000",
    fraisAttendreMicroUsdc: "0",
  };
  const politiqueBase = {
    identifiant: "politique-budget-cognitif-agent" as const,
    version: "0.1.0",
    partMaxVenParCycleBps: 50,
    plafondCognitifMicroUsdc: "10000",
    modeleLogique: "modele_standard",
    comportementSansInference: "attendre" as const,
    refuserSiCritiqueOuDormant: true,
  };

  const c0 = ouvrirControleur(
    construireConfigBase({
      identifiantExperience: "ctrl-b-g0-seuil-bas",
      graineSimulation: 42,
      capitalInitialParAgentMicroUsdc: "8000000",
      environnementDecision: env,
      politiqueBudgetCognitif: {
        ...politiqueBase,
        seuilEnjeuPourInferenceMicroUsdc: "100000",
      },
    }),
  );
  const c1 = ouvrirControleur(
    construireConfigBase({
      identifiantExperience: "ctrl-b-g1-seuil-haut",
      graineSimulation: 42,
      capitalInitialParAgentMicroUsdc: "8000000",
      environnementDecision: env,
      politiqueBudgetCognitif: {
        ...politiqueBase,
        seuilEnjeuPourInferenceMicroUsdc: "150000",
      },
    }),
  );

  try {
    await c0.avancerUnCycle();
    await c1.avancerUnCycle();
    const agent0 = c0.obtenirAgents()[0]!.identite.identifiant;
    const agent1 = c1.obtenirAgents()[0]!.identite.identifiant;
    const choix0 = choixCognitifsAgent(evenementsExperience(c0), agent0);
    const choix1 = choixCognitifsAgent(evenementsExperience(c1), agent1);

    if (choix0.length === 0 || choix1.length === 0) {
      return {
        ok: false,
        controle: "B",
        detail: "CHOIX_COGNITIF_EFFECTUE absent",
      };
    }

    const u0 = Boolean(
      (choix0[0]!.chargeUtile as { utiliserInference?: boolean })
        .utiliserInference,
    );
    const u1 = Boolean(
      (choix1[0]!.chargeUtile as { utiliserInference?: boolean })
        .utiliserInference,
    );

    const ok = u0 === true && u1 === false;
    return {
      ok,
      controle: "B",
      detail: ok
        ? "G0 utiliserInference=true / G1=false sur CHOIX_COGNITIF_EFFECTUE"
        : `divergence absente : G0=${String(u0)} G1=${String(u1)}`,
    };
  } finally {
    fermerControleur(c0);
    fermerControleur(c1);
  }
}

/**
 * Contrôle C — plafond cognitif borne active → limites divergentes.
 */
export async function executerControleCPlafondCognitif(): Promise<ResultatControleSensibilite> {
  const env = {
    identifiant: "environnement-opportunites-simulees" as const,
    version: "0.1.0",
    probabiliteSuccesBaseBps: 6000,
    amplitudeProbabiliteBps: 0,
    gainSiSuccesMicroUsdc: "200000",
    perteSiEchecMicroUsdc: "100000",
    fraisActionMicroUsdc: "1000",
    fraisAttendreMicroUsdc: "0",
  };
  // VEN ~ 8M, part 50 bps → 40000 ; plafonds 5k/10k/15k sont donc actifs.
  const plafonds = ["5000", "10000", "15000"] as const;
  const limites: bigint[] = [];

  for (const plafond of plafonds) {
    const c = ouvrirControleur(
      construireConfigBase({
        identifiantExperience: `ctrl-c-plafond-${plafond}`,
        graineSimulation: 42,
        capitalInitialParAgentMicroUsdc: "8000000",
        environnementDecision: env,
        politiqueBudgetCognitif: {
          identifiant: "politique-budget-cognitif-agent",
          version: "0.1.0",
          seuilEnjeuPourInferenceMicroUsdc: "100000",
          partMaxVenParCycleBps: 50,
          plafondCognitifMicroUsdc: plafond,
          modeleLogique: "modele_standard",
          comportementSansInference: "attendre",
          refuserSiCritiqueOuDormant: true,
        },
      }),
    );
    try {
      await c.avancerUnCycle();
      const agent = c.obtenirAgents()[0]!.identite.identifiant;
      const choix = choixCognitifsAgent(evenementsExperience(c), agent);
      if (choix.length === 0) {
        return {
          ok: false,
          controle: "C",
          detail: `CHOIX_COGNITIF_EFFECTUE absent pour plafond ${plafond}`,
        };
      }
      const limite = BigInt(
        String(
          (choix[0]!.chargeUtile as { limiteDepenseAutoriseeMicroUsdc?: string })
            .limiteDepenseAutoriseeMicroUsdc ?? "0",
        ),
      );
      limites.push(limite);
    } finally {
      fermerControleur(c);
    }
  }

  const distinctes = new Set(limites.map((l) => l.toString(10)));
  const ok =
    distinctes.size === 3 &&
    limites[0] === 5000n &&
    limites[1] === 10000n &&
    limites[2] === 15000n;

  return {
    ok,
    controle: "C",
    detail: ok
      ? "limites 5000/10000/15000 distinctes via plafond cognitif"
      : `limites observées : ${limites.map((l) => l.toString(10)).join(",")}`,
  };
}

/**
 * Contrôle D — partMaxVenParCycleBps borne active (VEN basse, plafond non masquant).
 */
export async function executerControleDPartMaxVen(): Promise<ResultatControleSensibilite> {
  const env = {
    identifiant: "environnement-opportunites-simulees" as const,
    version: "0.1.0",
    probabiliteSuccesBaseBps: 6000,
    amplitudeProbabiliteBps: 0,
    gainSiSuccesMicroUsdc: "200000",
    perteSiEchecMicroUsdc: "100000",
    fraisActionMicroUsdc: "1000",
    fraisAttendreMicroUsdc: "0",
  };
  // VEN initiale 1_000_000 ; plafond 100_000 → parts 25/50/75 bps visibles
  // (2500 / 5000 / 7500) sans être masquées par le plafond.
  const parts = [25, 50, 75] as const;
  const limites: bigint[] = [];

  for (const part of parts) {
    const c = ouvrirControleur(
      construireConfigBase({
        identifiantExperience: `ctrl-d-part-${String(part)}`,
        graineSimulation: 42,
        capitalInitialParAgentMicroUsdc: "1000000",
        environnementDecision: env,
        politiqueBudgetCognitif: {
          identifiant: "politique-budget-cognitif-agent",
          version: "0.1.0",
          seuilEnjeuPourInferenceMicroUsdc: "100000",
          partMaxVenParCycleBps: part,
          plafondCognitifMicroUsdc: "100000",
          modeleLogique: "modele_standard",
          comportementSansInference: "attendre",
          refuserSiCritiqueOuDormant: true,
        },
      }),
    );
    try {
      await c.avancerUnCycle();
      const agent = c.obtenirAgents()[0]!.identite.identifiant;
      const choix = choixCognitifsAgent(evenementsExperience(c), agent);
      if (choix.length === 0) {
        return {
          ok: false,
          controle: "D",
          detail: `CHOIX_COGNITIF_EFFECTUE absent pour part ${String(part)}`,
        };
      }
      const limite = BigInt(
        String(
          (choix[0]!.chargeUtile as { limiteDepenseAutoriseeMicroUsdc?: string })
            .limiteDepenseAutoriseeMicroUsdc ?? "0",
        ),
      );
      limites.push(limite);
    } finally {
      fermerControleur(c);
    }
  }

  const distinctes = new Set(limites.map((l) => l.toString(10)));
  const ok =
    distinctes.size === 3 &&
    limites[0]! < limites[1]! &&
    limites[1]! < limites[2]!;

  return {
    ok,
    controle: "D",
    detail: ok
      ? `parts 25/50/75 → limites croissantes ${limites.map((l) => l.toString(10)).join("/")}`
      : `limites non divergentes : ${limites.map((l) => l.toString(10)).join(",")}`,
  };
}

/**
 * Exécute les quatre contrôles positifs A/B/C/D.
 * Échoue (throw) si au moins un contrôle est négatif.
 */
export async function executerControleSensibilitePhenotypiqueV02(): Promise<
  readonly ResultatControleSensibilite[]
> {
  const resultats = [
    await executerControleAComportementSansInference(),
    await executerControleBSeuilInference(),
    await executerControleCPlafondCognitif(),
    await executerControleDPartMaxVen(),
  ];
  const echecs = resultats.filter((r) => !r.ok);
  if (echecs.length > 0) {
    throw new ControleSensibilitePhenotypiqueErreur(
      `contrôle sensibilité phénotypique v0.2 échoué : ${echecs
        .map((e) => `${e.controle} (${e.detail})`)
        .join(" ; ")}`,
    );
  }
  return resultats;
}
