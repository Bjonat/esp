/**
 * Exécution isolée d'un run condition × seed.
 * SQLite + keystore dédiés ; datesEvenementsFixes pour déterminisme.
 */

import {
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import {
  ControleurExperience,
  parserConfigurationExperience,
  lirePlanReproductionAutonomeCycle,
  type ConfigurationExperienceJson,
} from "@esp/controleur";
import type { EvenementEsp } from "@esp/protocole";
import {
  DATE_EVENEMENTS_FIXES_EVOLUTION,
  identifiantRun,
} from "./conditions.js";
import {
  calculerEmpreinteExecutionRun,
  calculerEmpreinteResultatScientifiqueDepuisRun,
} from "./empreinte.js";
import type { MetaCode } from "./meta-code.js";
import type { ConditionEvolution } from "./protocole-evolution.js";
import {
  empreinteProtocoleCampagne,
  fabriquerConfigurationRunCampagne,
  type ProtocoleCampagneEvolution,
} from "./protocole-versionne.js";
import {
  fabriquerResumeDepuisTrajectoire,
  type ResumeRunEvolution,
} from "./resume-run.js";
import type {
  InstantaneFrequenceGenotype,
  InstantaneLignee,
  PointTrajectoireEvolution,
} from "./trajectoire.js";

export type OptionsExecuterRun = {
  readonly protocole: ProtocoleCampagneEvolution;
  readonly condition: ConditionEvolution;
  readonly seed: number;
  readonly repertoireRun: string;
  readonly identifiantBatch: string;
  readonly metaCode: MetaCode;
  readonly dateLancement: string;
};

export type ResultatExecuterRun = {
  readonly resume: ResumeRunEvolution;
  readonly empreinteExecutionRun: string;
  readonly empreinteResultatScientifique: string;
  /** @deprecated alias empreinteExecutionRun */
  readonly empreinteRun: string;
  readonly points: readonly PointTrajectoireEvolution[];
};

function micro(n: bigint): string {
  return n.toString(10);
}

function compterMutations(
  evenements: readonly EvenementEsp[],
  cycle?: number,
): number {
  let n = 0;
  for (const e of evenements) {
    if (e.type !== "MUTATION_APPLIQUEE") {
      continue;
    }
    if (cycle !== undefined && e.numeroCycle !== cycle) {
      continue;
    }
    n += 1;
  }
  return n;
}

function construirePoint(options: {
  readonly controleur: ControleurExperience;
  readonly cycle: number;
  readonly mortsPrecedents: number;
  readonly eteinte: boolean;
}): { point: PointTrajectoireEvolution; morts: number } {
  const { controleur, cycle } = options;
  const pop = controleur.projeterPopulation();
  const dynamique = pop.dynamiqueEvolutive;
  const evenements = controleur.registre.listerParExperience(
    controleur.configuration.identifiantExperience,
  );
  const agents = controleur.projeterAgents();

  let revenus = 0n;
  let pertes = 0n;
  let compute = 0n;
  let donnees = 0n;
  let frais = 0n;
  let loyers = 0n;
  let redevances = 0n;
  for (const agent of agents) {
    revenus += BigInt(agent.economie.revenusCumules.microUsdc);
    pertes += BigInt(agent.economie.pertesCumulees.microUsdc);
    compute += BigInt(agent.economie.compute.microUsdc);
    donnees += BigInt(agent.economie.donnees.microUsdc);
    frais += BigInt(agent.economie.fraisExecution.microUsdc);
    loyers += BigInt(agent.economie.loyers.microUsdc);
    redevances += BigInt(agent.economie.redevances.microUsdc);
  }

  const brut = revenus - pertes;
  const apresContrat = brut - compute - donnees - frais - loyers - redevances;
  const coutsRepro = BigInt(pop.coutsReproductifsCumules.microUsdc);
  const apresRepro = apresContrat - coutsRepro;

  const tresorerie = controleur.projeterTresorerie();
  const contribution = BigInt(tresorerie.soldeNet.microUsdc);

  let demandesInference = 0;
  let coutCognitif = compute;
  const xway = controleur.projeterXway();
  demandesInference = xway.demandesRecues;
  coutCognitif = BigInt(xway.coutComputeCumule.microUsdc);

  let regretNum = "0";
  const regretDen = "10000";
  let tauxOpt: number | null = null;
  const fitness = controleur.projeterFitnessPopulation();
  let num = 0n;
  let decisionsAvecTaux = 0;
  let sommeTaux = 0;
  for (const ligne of fitness.agents) {
    num += BigInt(ligne.regretExAnteCumule.numerateurMicroUsdcBps);
    if (ligne.tauxDecisionsOptimalesExAnteBps !== null) {
      decisionsAvecTaux += 1;
      sommeTaux += ligne.tauxDecisionsOptimalesExAnteBps;
    }
  }
  regretNum = num.toString(10);
  tauxOpt =
    decisionsAvecTaux > 0 ? Math.floor(sommeTaux / decisionsAvecTaux) : null;

  const frequencesGenotypes: InstantaneFrequenceGenotype[] = (
    dynamique?.frequencesGenotypes ?? []
  ).map((g) => ({
    empreinteConfiguration: g.empreinteConfiguration,
    agentsVivants: g.agentsVivants,
    partPopulationVivanteBps: g.partPopulationVivanteBps,
  }));

  const lignees: InstantaneLignee[] = (dynamique?.lignees ?? []).map((l) => {
    let generationMaximale = 0;
    for (const agent of agents) {
      if (
        agent.identifiantLignee === l.identifiantLignee &&
        agent.generation > generationMaximale
      ) {
        generationMaximale = agent.generation;
      }
    }
    return {
      identifiantLignee: l.identifiantLignee,
      membresVivants: l.membresVivants,
      membresCumules: l.membresCumules,
      partPopulationVivanteBps: l.partPopulationVivanteBps,
      generationMaximale,
    };
  });

  const morts = pop.agentsMorts;
  const deces = Math.max(0, morts - options.mortsPrecedents);
  const mutationsCumulees = compterMutations(evenements);
  const mutationsCycle = compterMutations(evenements, cycle);

  const point: PointTrajectoireEvolution = {
    cycle,
    populationTotale: pop.populationTotale,
    populationVivante: pop.agentsVivants,
    venPopulationMicroUsdc: pop.venTotale.microUsdc,
    capitalLiquidePopulationMicroUsdc: pop.capitalLiquideTotal.microUsdc,
    revenusActiviteMicroUsdc: micro(revenus),
    pertesActiviteMicroUsdc: micro(pertes),
    computeMicroUsdc: micro(compute),
    donneesMicroUsdc: micro(donnees),
    fraisExecutionMicroUsdc: micro(frais),
    loyersMicroUsdc: micro(loyers),
    redevancesMicroUsdc: micro(redevances),
    coutsReproductionMicroUsdc: micro(coutsRepro),
    resultatApresContratMicroUsdc: micro(apresContrat),
    resultatApresReproductionMicroUsdc: micro(apresRepro),
    naissances: pop.naissancesCycle,
    deces,
    generationsPresentes: [...pop.generationsPresentes].sort((a, b) => a - b),
    ligneesVivantes: pop.ligneesVivantes,
    configurationsHeritablesDistinctes:
      dynamique?.configurationsHeritablesDistinctes ??
      frequencesGenotypes.length,
    mutationsCumulees,
    mutationsCycle,
    demandesInference,
    coutCognitifMicroUsdc: micro(coutCognitif),
    regretExAnteCumuleNumerateur: regretNum,
    regretExAnteCumuleDenominateur: regretDen,
    tauxDecisionsOptimalesExAnteBps: tauxOpt,
    contributionProprietaireMicroUsdc: micro(contribution),
    eteinte: options.eteinte || pop.agentsVivants === 0,
    frequencesGenotypes,
    lignees,
  };

  return { point, morts };
}

function pointExteintPadded(
  dernier: PointTrajectoireEvolution,
  cycle: number,
): PointTrajectoireEvolution {
  return {
    ...dernier,
    cycle,
    populationVivante: 0,
    naissances: 0,
    deces: 0,
    mutationsCycle: 0,
    eteinte: true,
    frequencesGenotypes: dernier.frequencesGenotypes.map((g) => ({
      ...g,
      agentsVivants: 0,
      partPopulationVivanteBps: 0,
    })),
    lignees: dernier.lignees.map((l) => ({
      ...l,
      membresVivants: 0,
      partPopulationVivanteBps: 0,
    })),
    ligneesVivantes: 0,
  };
}

function detecterGardeFous(options: {
  readonly controleur: ControleurExperience;
  readonly conf: ConfigurationExperienceJson;
  readonly cycle: number;
}): {
  populationMax: boolean;
  plafondNaissances: boolean;
} {
  const pop = options.controleur.projeterPopulation();
  const populationMaximale =
    options.conf.reproduction?.populationMaximale ?? Number.POSITIVE_INFINITY;
  const populationMax = pop.agentsVivants >= populationMaximale;

  const evenements = options.controleur.registre.listerParExperience(
    options.controleur.configuration.identifiantExperience,
  );
  const plan = lirePlanReproductionAutonomeCycle(evenements, options.cycle);
  let plafondNaissances = false;
  if (plan !== undefined) {
    plafondNaissances =
      plan.identifiantsRefusCapacite.length > 0 &&
      plan.identifiantsEligiblesOrdonnes.length > 0;
  }
  const dynamique = options.controleur.projeterDynamiqueEvolutive();
  if (dynamique.refusCapacite > 0 && dynamique.candidatsReproduction > 0) {
    plafondNaissances = true;
  }

  return { populationMax, plafondNaissances };
}

/**
 * Exécute un run complet et écrit trajectoire.jsonl + resume.json.
 */
export async function executerRun(
  options: OptionsExecuterRun,
): Promise<ResultatExecuterRun> {
  const debut = Date.now();
  const { protocole, condition, seed, repertoireRun } = options;
  const idRun = identifiantRun(condition, seed);
  const confJson = fabriquerConfigurationRunCampagne(
    protocole,
    condition,
    seed,
  );
  const conf = parserConfigurationExperience(confJson);

  mkdirSync(repertoireRun, { recursive: true });
  const cheminSqlite = join(repertoireRun, "esp.sqlite");
  const cheminKeystore = join(repertoireRun, "identites");
  mkdirSync(cheminKeystore, { recursive: true });

  writeFileSync(
    join(repertoireRun, "configuration.json"),
    JSON.stringify(confJson, null, 2),
    "utf8",
  );

  const controleur = ControleurExperience.ouvrir({
    configuration: conf,
    cheminSqlite,
    cheminKeystoreIdentites: cheminKeystore,
    dateCreationFixe: DATE_EVENEMENTS_FIXES_EVOLUTION,
    datesEvenementsFixes: DATE_EVENEMENTS_FIXES_EVOLUTION,
  });

  const points: PointTrajectoireEvolution[] = [];
  let mortsPrecedents = 0;
  let cyclesPopulationMaximaleAtteinte = 0;
  let cyclesPlafondNaissancesAtteint = 0;
  let eteinte = false;
  let cycleExtinction: number | null = null;

  try {
    while (points.length < protocole.cyclesMaximum) {
      const statut = controleur.projeterExperience().statut;
      if (statut === "terminee") {
        break;
      }

      const avant = controleur.projeterPopulation();
      if (
        avant.agentsVivants === 0 &&
        controleur.obtenirNumeroCycleCourant() > 0
      ) {
        eteinte = true;
        if (cycleExtinction === null) {
          cycleExtinction = controleur.obtenirNumeroCycleCourant();
        }
        break;
      }

      const { numeroCycle, population } = await controleur.avancerUnCycle();
      const gardes = detecterGardeFous({
        controleur,
        conf: confJson,
        cycle: numeroCycle,
      });
      if (gardes.populationMax) {
        cyclesPopulationMaximaleAtteinte += 1;
      }
      if (gardes.plafondNaissances) {
        cyclesPlafondNaissancesAtteint += 1;
      }

      if (population.agentsVivants === 0) {
        eteinte = true;
        if (cycleExtinction === null) {
          cycleExtinction = numeroCycle;
        }
      }

      const { point, morts } = construirePoint({
        controleur,
        cycle: numeroCycle,
        mortsPrecedents,
        eteinte,
      });
      mortsPrecedents = morts;
      points.push(point);

      if (eteinte) {
        break;
      }
      if (controleur.projeterExperience().statut === "terminee") {
        break;
      }
    }

    if (points.length > 0 && points.length < protocole.cyclesMaximum) {
      const dernier = points[points.length - 1]!;
      for (let c = points.length + 1; c <= protocole.cyclesMaximum; c += 1) {
        points.push(pointExteintPadded(dernier, c));
      }
    }
  } finally {
    controleur.fermer();
  }

  const relecture = ControleurExperience.ouvrir({
    identifiantExperience: conf.identifiantExperience,
    cheminSqlite,
    cheminKeystoreIdentites: cheminKeystore,
    datesEvenementsFixes: DATE_EVENEMENTS_FIXES_EVOLUTION,
  });
  let evenementsListe: EvenementEsp[];
  try {
    evenementsListe = [
      ...relecture.registre.listerParExperience(conf.identifiantExperience),
    ];
  } finally {
    relecture.fermer();
  }

  const empProtocole = empreinteProtocoleCampagne(protocole);
  const empreinteExecutionRun = calculerEmpreinteExecutionRun({
    empreinteProtocole: empProtocole,
    condition,
    seed,
    evenements: evenementsListe,
  });

  let resume = fabriquerResumeDepuisTrajectoire({
    identifiantRun: idRun,
    identifiantBatch: options.identifiantBatch,
    condition,
    seed,
    empreinteProtocole: empProtocole,
    empreinteExecutionRun,
    versionProtocole: protocole.version,
    metaCode: {
      gitSha: options.metaCode.gitSha,
      workingTreeDirty: options.metaCode.workingTreeDirty,
      source: options.metaCode.source,
    },
    dateLancement: options.dateLancement,
    dureeMs: Date.now() - debut,
    cyclesMaximum: protocole.cyclesMaximum,
    points,
    cyclesPopulationMaximaleAtteinte,
    cyclesPlafondNaissancesAtteint,
  });

  if (eteinte && resume.cycleExtinction === null && cycleExtinction !== null) {
    const resumeCorrige = { ...resume, cycleExtinction };
    resume = {
      ...resumeCorrige,
      empreinteResultatScientifique:
        calculerEmpreinteResultatScientifiqueDepuisRun({
          empreinteProtocole: empProtocole,
          seed,
          points: points as unknown as readonly Readonly<
            Record<string, unknown>
          >[],
          resume: resumeCorrige as unknown as Readonly<Record<string, unknown>>,
        }),
    };
  }

  writeFileSync(
    join(repertoireRun, "trajectoire.jsonl"),
    points.map((p) => JSON.stringify(p)).join("\n") +
      (points.length > 0 ? "\n" : ""),
    "utf8",
  );
  writeFileSync(
    join(repertoireRun, "resume.json"),
    JSON.stringify(resume, null, 2),
    "utf8",
  );
  writeFileSync(
    join(repertoireRun, "statut.json"),
    JSON.stringify(
      {
        statut: "termine",
        empreinteExecutionRun: resume.empreinteExecutionRun,
        empreinteResultatScientifique: resume.empreinteResultatScientifique,
        empreinteRun: resume.empreinteExecutionRun,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    resume,
    empreinteExecutionRun: resume.empreinteExecutionRun,
    empreinteResultatScientifique: resume.empreinteResultatScientifique,
    empreinteRun: resume.empreinteExecutionRun,
    points,
  };
}

/** Supprime un répertoire de run partiel avant recommencement. */
export function nettoyerRunPartiel(repertoireRun: string): void {
  if (existsSync(repertoireRun)) {
    rmSync(repertoireRun, { recursive: true, force: true });
  }
}
