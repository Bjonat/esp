/**
 * Rapports factuels de batch — aucun scoreEvolution / classement.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  ResumeComparaisonBigint,
  ResumeComparaisonNombre,
} from "./comparaisons.js";
import { calculerComparaisonsAppariees } from "./comparaisons.js";
import type { ManifesteBatchEvolution } from "./manifeste-batch.js";
import type { ResumeRunEvolution } from "./resume-run.js";
import {
  medianeNombres,
  quartile1Nombres,
  quartile3Nombres,
  medianeBigints,
  quartile1Bigints,
  quartile3Bigints,
} from "./statistiques.js";
import type { PointTrajectoireEvolution } from "./trajectoire.js";
import { parserPointTrajectoire } from "./trajectoire.js";

export type AgregatTrajectoireConditionCycle = {
  readonly condition: string;
  readonly cycle: number;
  readonly n: number;
  readonly medianePopulationVivante: number | null;
  readonly q1PopulationVivante: number | null;
  readonly q3PopulationVivante: number | null;
  readonly minPopulationVivante: number | null;
  readonly maxPopulationVivante: number | null;
  readonly medianeVenMicroUsdc: string | null;
  readonly q1VenMicroUsdc: string | null;
  readonly q3VenMicroUsdc: string | null;
};

function echapperCsv(valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined) {
    return "";
  }
  const t = String(valeur);
  if (t.includes(",") || t.includes('"') || t.includes("\n")) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

function ligneCsv(champs: readonly (string | number | null | undefined)[]): string {
  return champs.map(echapperCsv).join(",");
}

export function agregerTrajectoiresParConditionCycle(
  trajectoires: ReadonlyMap<string, readonly PointTrajectoireEvolution[]>,
  resumes: readonly ResumeRunEvolution[],
): AgregatTrajectoireConditionCycle[] {
  type Cle = string;
  const buckets = new Map<
    Cle,
    { pops: number[]; vens: bigint[]; condition: string; cycle: number }
  >();

  for (const resume of resumes) {
    const points = trajectoires.get(resume.identifiantRun) ?? [];
    for (const p of points) {
      const cle = `${resume.condition}:${String(p.cycle)}`;
      let b = buckets.get(cle);
      if (b === undefined) {
        b = { pops: [], vens: [], condition: resume.condition, cycle: p.cycle };
        buckets.set(cle, b);
      }
      b.pops.push(p.populationVivante);
      b.vens.push(BigInt(p.venPopulationMicroUsdc));
    }
  }

  const sorties: AgregatTrajectoireConditionCycle[] = [];
  for (const b of buckets.values()) {
    const pops = [...b.pops].sort((a, c) => a - c);
    const vens = [...b.vens].sort((a, c) => (a < c ? -1 : a > c ? 1 : 0));
    sorties.push({
      condition: b.condition,
      cycle: b.cycle,
      n: pops.length,
      medianePopulationVivante: medianeNombres(pops),
      q1PopulationVivante: quartile1Nombres(pops),
      q3PopulationVivante: quartile3Nombres(pops),
      minPopulationVivante: pops[0] ?? null,
      maxPopulationVivante: pops[pops.length - 1] ?? null,
      medianeVenMicroUsdc: medianeBigints(vens)?.toString(10) ?? null,
      q1VenMicroUsdc: quartile1Bigints(vens)?.toString(10) ?? null,
      q3VenMicroUsdc: quartile3Bigints(vens)?.toString(10) ?? null,
    });
  }
  return sorties.sort((a, b) =>
    a.condition === b.condition
      ? a.cycle - b.cycle
      : a.condition.localeCompare(b.condition),
  );
}

export function ecrireRapportsBatch(options: {
  readonly repertoireBatch: string;
  readonly manifeste: ManifesteBatchEvolution;
  readonly resumes: readonly ResumeRunEvolution[];
  readonly trajectoires: ReadonlyMap<string, readonly PointTrajectoireEvolution[]>;
  readonly controleNegatifOk: boolean;
}): void {
  const { repertoireBatch, manifeste, resumes, trajectoires } = options;
  mkdirSync(repertoireBatch, { recursive: true });

  const comparaisons = calculerComparaisonsAppariees(resumes);
  const agregats = agregerTrajectoiresParConditionCycle(trajectoires, resumes);

  const resumeBatch = {
    identifiantBatch: manifeste.identifiantBatch,
    identifiantProtocole: manifeste.identifiantProtocole,
    empreinteProtocole: manifeste.empreinteProtocole,
    mode: manifeste.mode,
    dateLancement: manifeste.dateLancement,
    metaCode: manifeste.metaCode,
    marqueurs: manifeste.marqueurs,
    nombreRuns: resumes.length,
    runsEchoues: manifeste.runs.filter((r) => r.statut === "echoue").length,
    controleNegatifOk: options.controleNegatifOk,
    runsContraintsParGardeFou: resumes.filter((r) => r.runContraintParGardeFou)
      .length,
    // Aucun scoreEvolution / fitnessGlobale — analyse multidimensionnelle.
    resumes: resumes.map((r) => ({
      identifiantRun: r.identifiantRun,
      condition: r.condition,
      seed: r.seed,
      empreinteExecutionRun: r.empreinteExecutionRun,
      empreinteResultatScientifique: r.empreinteResultatScientifique,
      empreinteRun: r.empreinteExecutionRun,
      eteinte: r.eteinte,
      cycleExtinction: r.cycleExtinction,
      populationVivanteFinale: r.populationVivanteFinale,
      venPopulationFinaleMicroUsdc: r.venPopulationFinaleMicroUsdc,
      naissancesCumulees: r.naissancesCumulees,
      mutationsCumulees: r.mutationsCumulees,
      runContraintParGardeFou: r.runContraintParGardeFou,
    })),
  };

  writeFileSync(
    join(repertoireBatch, "resume-batch.json"),
    JSON.stringify(resumeBatch, null, 2),
    "utf8",
  );

  const lignesComp = [
    ligneCsv([
      "paire",
      "metrique",
      "n",
      "mediane",
      "q1",
      "q3",
      "min",
      "max",
      "nPos",
      "nNul",
      "nNeg",
    ]),
  ];
  const pousserComp = (
    c: ResumeComparaisonBigint | ResumeComparaisonNombre,
  ): void => {
    lignesComp.push(
      ligneCsv([
        c.paire,
        c.metrique,
        c.n,
        c.mediane,
        c.q1,
        c.q3,
        c.min,
        c.max,
        c.nPos,
        c.nNul,
        c.nNeg,
      ]),
    );
  };
  for (const c of comparaisons.bigint) pousserComp(c);
  for (const c of comparaisons.nombre) pousserComp(c);
  writeFileSync(
    join(repertoireBatch, "comparaisons.csv"),
    lignesComp.join("\n") + "\n",
    "utf8",
  );

  const lignesAgg = [
    ligneCsv([
      "condition",
      "cycle",
      "n",
      "medianePopulationVivante",
      "q1PopulationVivante",
      "q3PopulationVivante",
      "minPopulationVivante",
      "maxPopulationVivante",
      "medianeVenMicroUsdc",
      "q1VenMicroUsdc",
      "q3VenMicroUsdc",
    ]),
  ];
  for (const a of agregats) {
    lignesAgg.push(
      ligneCsv([
        a.condition,
        a.cycle,
        a.n,
        a.medianePopulationVivante,
        a.q1PopulationVivante,
        a.q3PopulationVivante,
        a.minPopulationVivante,
        a.maxPopulationVivante,
        a.medianeVenMicroUsdc,
        a.q1VenMicroUsdc,
        a.q3VenMicroUsdc,
      ]),
    );
  }
  writeFileSync(
    join(repertoireBatch, "trajectoires-agregees.csv"),
    lignesAgg.join("\n") + "\n",
    "utf8",
  );

  const lignesFreq = [
    ligneCsv([
      "identifiantRun",
      "condition",
      "seed",
      "cycle",
      "empreinteConfiguration",
      "agentsVivants",
      "partPopulationVivanteBps",
    ]),
  ];
  for (const resume of resumes) {
    const points = trajectoires.get(resume.identifiantRun) ?? [];
    for (const p of points) {
      for (const g of p.frequencesGenotypes) {
        lignesFreq.push(
          ligneCsv([
            resume.identifiantRun,
            resume.condition,
            resume.seed,
            p.cycle,
            g.empreinteConfiguration,
            g.agentsVivants,
            g.partPopulationVivanteBps,
          ]),
        );
      }
    }
  }
  writeFileSync(
    join(repertoireBatch, "frequences-genotypiques.csv"),
    lignesFreq.join("\n") + "\n",
    "utf8",
  );

  const md = [
    `# Rapport batch évolution — ${manifeste.identifiantBatch}`,
    "",
    "## Protocole",
    "",
    `- identifiant : ${manifeste.identifiantProtocole}`,
    `- empreinteProtocole : ${manifeste.empreinteProtocole}`,
    `- formatsEmpreintes : ${JSON.stringify(manifeste.formatsEmpreintes)}`,
    `- mode : ${manifeste.mode}`,
    `- SHA code : ${manifeste.metaCode.gitSha ?? "indisponible"}`,
    `- working tree dirty : ${String(manifeste.metaCode.workingTreeDirty)}`,
    `- marqueurs : ${manifeste.marqueurs.join(", ") || "aucun"}`,
    "",
    "## Runs",
    "",
    `- nombre : ${String(resumes.length)}`,
    `- échoués : ${String(manifeste.runs.filter((r) => r.statut === "echoue").length)}`,
    `- contrôle négatif B/C : ${options.controleNegatifOk ? "OK" : "ÉCHEC"}`,
    `- runs contraints par garde-fou : ${String(resumes.filter((r) => r.runContraintParGardeFou).length)}`,
    "",
    "## Limites",
    "",
    "- Rapport factuel uniquement — aucune métrique synthétique globale ni classement agent/gène.",
    "- Extinctions conservées dans les dénominateurs (pas de biais survivants).",
    "- Calibration ≠ évaluation.",
    "",
  ].join("\n");

  writeFileSync(join(repertoireBatch, "rapport.md"), md, "utf8");
}

export function chargerTrajectoireFichier(
  chemin: string,
): PointTrajectoireEvolution[] {
  if (!existsSync(chemin)) {
    return [];
  }
  const texte = readFileSync(chemin, "utf8").trim();
  if (texte === "") {
    return [];
  }
  return texte.split("\n").map((l) => parserPointTrajectoire(l));
}
