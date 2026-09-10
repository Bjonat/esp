/**
 * Contrôle négatif B vs C (même seed) :
 * mutation inactive vs mutation active taux=0 — résultats scientifiques identiques.
 *
 * Vérification primaire : empreinteResultatScientifique.
 * Diagnostic secondaire : comparaison structurée résumé / trajectoire.
 */

import type { ResumeRunEvolution } from "./resume-run.js";
import type { PointTrajectoireEvolution } from "./trajectoire.js";

export type ResultatControleNegatifSeed = {
  readonly seed: number;
  readonly identique: boolean;
  readonly motif?: string;
  readonly empreinteResultatScientifiqueB?: string;
  readonly empreinteResultatScientifiqueC?: string;
  readonly empreinteExecutionRunB?: string;
  readonly empreinteExecutionRunC?: string;
};

export type ResultatControleNegatifBatch = {
  readonly ok: boolean;
  readonly paires: readonly ResultatControleNegatifSeed[];
};

/**
 * Échec bloquant du contrôle négatif B≡C (campagne v0.3).
 * Les artefacts diagnostiques peuvent déjà être écrits ; la campagne
 * n'est pas scientifiquement exploitable.
 */
export class ControlegeNegatifBcEchoueErreur extends Error {
  readonly controle: ResultatControleNegatifBatch;
  readonly repertoireBatch: string;

  constructor(options: {
    readonly controle: ResultatControleNegatifBatch;
    readonly repertoireBatch: string;
  }) {
    const pairesEchouees = options.controle.paires.filter((p) => !p.identique);
    super(
      `contrôle négatif B≡C échoué — campagne INVALIDE (${String(pairesEchouees.length)} paire(s) divergente(s)) ; artefacts diagnostiques dans ${options.repertoireBatch}`,
    );
    this.name = "ControlegeNegatifBcEchoueErreur";
    this.controle = options.controle;
    this.repertoireBatch = options.repertoireBatch;
  }
}

const CHAMPS_RESUME: readonly (keyof ResumeRunEvolution)[] = [
  "venPopulationFinaleMicroUsdc",
  "resultatActiviteBrutCumuleMicroUsdc",
  "resultatApresContratCumuleMicroUsdc",
  "resultatApresReproductionCumuleMicroUsdc",
  "computeCumuleMicroUsdc",
  "populationVivanteFinale",
  "eteinte",
  "cycleExtinction",
  "naissancesCumulees",
  "generationMaximale",
  "ligneesVivantes",
  "mutationsCumulees",
  "configurationsDistinctesFinales",
];

const CHAMPS_TRAJECTOIRE: readonly (keyof PointTrajectoireEvolution)[] = [
  "populationVivante",
  "venPopulationMicroUsdc",
  "capitalLiquidePopulationMicroUsdc",
  "revenusActiviteMicroUsdc",
  "pertesActiviteMicroUsdc",
  "computeMicroUsdc",
  "naissances",
  "deces",
  "ligneesVivantes",
  "mutationsCumulees",
  "configurationsHeritablesDistinctes",
];

export function comparerControleNegatifBC(options: {
  readonly resumeB: ResumeRunEvolution;
  readonly resumeC: ResumeRunEvolution;
  readonly trajectoireB: readonly PointTrajectoireEvolution[];
  readonly trajectoireC: readonly PointTrajectoireEvolution[];
}): ResultatControleNegatifSeed {
  const seed = options.resumeB.seed;
  const base = {
    seed,
    empreinteResultatScientifiqueB:
      options.resumeB.empreinteResultatScientifique,
    empreinteResultatScientifiqueC:
      options.resumeC.empreinteResultatScientifique,
    empreinteExecutionRunB: options.resumeB.empreinteExecutionRun,
    empreinteExecutionRunC: options.resumeC.empreinteExecutionRun,
  };

  /**
   * Vérification primaire : empreintes résultat scientifique.
   * Les empreintes d'exécution PEUVENT différer (mutation.active).
   */
  if (
    options.resumeB.empreinteResultatScientifique !==
    options.resumeC.empreinteResultatScientifique
  ) {
    return {
      ...base,
      identique: false,
      motif: "empreinteResultatScientifique diverge",
    };
  }

  for (const champ of CHAMPS_RESUME) {
    if (options.resumeB[champ] !== options.resumeC[champ]) {
      return {
        ...base,
        identique: false,
        motif: `resume.${String(champ)} diverge`,
      };
    }
  }

  if (options.trajectoireB.length !== options.trajectoireC.length) {
    return {
      ...base,
      identique: false,
      motif: "longueur trajectoire diverge",
    };
  }

  for (let i = 0; i < options.trajectoireB.length; i += 1) {
    const b = options.trajectoireB[i]!;
    const c = options.trajectoireC[i]!;
    for (const champ of CHAMPS_TRAJECTOIRE) {
      const vb = b[champ];
      const vc = c[champ];
      if (JSON.stringify(vb) !== JSON.stringify(vc)) {
        return {
          ...base,
          identique: false,
          motif: `trajectoire cycle ${String(b.cycle)} champ ${String(champ)} diverge`,
        };
      }
    }
  }

  return { ...base, identique: true };
}

export function evaluerControleNegatifBatch(options: {
  readonly resumes: readonly ResumeRunEvolution[];
  readonly trajectoires: ReadonlyMap<string, readonly PointTrajectoireEvolution[]>;
}): ResultatControleNegatifBatch {
  const parCle = new Map<string, ResumeRunEvolution>();
  for (const r of options.resumes) {
    parCle.set(`${r.condition}:${r.seed}`, r);
  }
  const seeds = [
    ...new Set(
      options.resumes.filter((r) => r.condition === "B").map((r) => r.seed),
    ),
  ].sort((a, b) => a - b);

  const paires: ResultatControleNegatifSeed[] = [];
  for (const seed of seeds) {
    const resumeB = parCle.get(`B:${seed}`);
    const resumeC = parCle.get(`C:${seed}`);
    if (resumeB === undefined || resumeC === undefined) {
      paires.push({
        seed,
        identique: false,
        motif: "paire B/C manquante",
      });
      continue;
    }
    const trajectoireB = options.trajectoires.get(resumeB.identifiantRun) ?? [];
    const trajectoireC = options.trajectoires.get(resumeC.identifiantRun) ?? [];
    paires.push(
      comparerControleNegatifBC({
        resumeB,
        resumeC,
        trajectoireB,
        trajectoireC,
      }),
    );
  }

  return {
    ok: paires.every((p) => p.identique),
    paires,
  };
}
