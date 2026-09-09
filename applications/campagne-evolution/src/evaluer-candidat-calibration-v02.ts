/**
 * Évaluation d'un candidat de calibration évolution v0.2 (critères A–G).
 * Aucune métrique D−C n'entre dans la décision.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { medianeNombres } from "./statistiques.js";
import type { ResumeRunEvolution } from "./resume-run.js";
import type { PointTrajectoireEvolution } from "./trajectoire.js";
import { chargerTrajectoireFichier } from "./rapports.js";
import type { ManifesteBatchEvolution } from "./manifeste-batch.js";
import type { ResumeDiagnosticExposition } from "./diagnostic-exposition-phenotypique-v02.js";
import {
  IDENTIFIANTS_CRITERES_CALIBRATION_V02,
  SEUILS_CALIBRATION_V02,
  VERSION_CRITERES_CALIBRATION_V02,
  descendanceDifferentiellePresente,
  type IdentifiantCritereCalibrationV02,
  type VerdictCritereCalibration,
} from "./criteres-calibration-v02.js";

export type ResumeCalibrationV02 = {
  readonly version: typeof VERSION_CRITERES_CALIBRATION_V02;
  readonly identifiantCandidat: string;
  readonly identifiantBatch: string;
  readonly identifiantProtocole: string;
  readonly parametresModifiesParRapportPrecedent: string;
  readonly raisonModification: string;
  readonly runsPrevus: number;
  readonly runsTermines: number;
  readonly runsEchoues: number;
  readonly controleNegatifBcIdentique: boolean;
  readonly generationMaximaleMedianeBCD: number | null;
  readonly naissancesPresentesParCondition: Readonly<
    Record<"B" | "C" | "D", boolean>
  >;
  readonly seedsDescendanceDifferentielleParCondition: Readonly<
    Record<"B" | "C" | "D", number>
  >;
  readonly runsDAvecMutation: number;
  readonly runsDExpressionCognitive: number;
  readonly runsDExpressionComportementOuEco: number;
  readonly couverturePhenotypiqueAtteinte: boolean;
  readonly fractionRunsContraintsParGardeFou: number;
  readonly fractionCyclesPopulationMaxAtteinte: number;
  readonly fractionCyclesPlafondNaissancesAtteint: number;
  readonly extinctionPrecoceTotale: boolean;
  readonly criteres: readonly VerdictCritereCalibration[];
  readonly candidatValide: boolean;
  readonly motifInvalidation: string | null;
};

function resumesParCondition(
  resumes: readonly ResumeRunEvolution[],
  condition: "A" | "B" | "C" | "D",
): ResumeRunEvolution[] {
  return resumes.filter((r) => r.condition === condition);
}

function meanRatio(
  resumes: readonly ResumeRunEvolution[],
  numerateur: (r: ResumeRunEvolution) => number,
): number {
  if (resumes.length === 0) {
    return 0;
  }
  let somme = 0;
  for (const r of resumes) {
    const den = r.cyclesMaximum > 0 ? r.cyclesMaximum : 1;
    somme += numerateur(r) / den;
  }
  return somme / resumes.length;
}

export function evaluerCandidatCalibrationV02(options: {
  readonly identifiantCandidat: string;
  readonly manifeste: ManifesteBatchEvolution;
  readonly resumes: readonly ResumeRunEvolution[];
  readonly repertoireBatch: string;
  readonly trajectoires?: ReadonlyMap<
    string,
    readonly PointTrajectoireEvolution[]
  >;
  readonly diagnostic?: ResumeDiagnosticExposition;
  readonly controleNegatifBcIdentique: boolean;
  readonly parametresModifiesParRapportPrecedent?: string;
  readonly raisonModification?: string;
}): ResumeCalibrationV02 {
  const resumes = options.resumes;
  const bcd = resumes.filter(
    (r) => r.condition === "B" || r.condition === "C" || r.condition === "D",
  );
  const runsD = resumesParCondition(resumes, "D");

  const runsPrevus = options.manifeste.runs.length;
  const runsTermines = options.manifeste.runs.filter(
    (r) => r.statut === "termine",
  ).length;
  const runsEchoues = options.manifeste.runs.filter(
    (r) => r.statut === "echoue",
  ).length;

  let diagnostic = options.diagnostic;
  if (diagnostic === undefined) {
    const chemin = join(
      options.repertoireBatch,
      "diagnostic-exposition",
      "resume-diagnostic-expression.json",
    );
    if (existsSync(chemin)) {
      diagnostic = JSON.parse(
        readFileSync(chemin, "utf8"),
      ) as ResumeDiagnosticExposition;
    }
  }

  const evenementsBcd =
    diagnostic !== undefined &&
    (diagnostic.evenementsDecisionnelsParCondition.B ?? 0) > 0 &&
    (diagnostic.evenementsDecisionnelsParCondition.C ?? 0) > 0 &&
    (diagnostic.evenementsDecisionnelsParCondition.D ?? 0) > 0;

  const criteres: VerdictCritereCalibration[] = [];

  // A — intégrité
  const aOk =
    runsEchoues === 0 &&
    runsTermines === runsPrevus &&
    options.controleNegatifBcIdentique &&
    evenementsBcd;
  criteres.push({
    identifiant: "A_INTEGRITE",
    atteint: aOk,
    detail: aOk
      ? "runs OK, B/C identiques, événements décisionnels B/C/D"
      : `echec=${String(runsEchoues)} bc=${String(options.controleNegatifBcIdentique)} decisionnels=${String(evenementsBcd)}`,
  });

  // B — couverture
  const bOk = diagnostic?.criteresCouverture.couvertureGlobaleAtteinte === true;
  criteres.push({
    identifiant: "B_COUVERTURE_PHENOTYPIQUE",
    atteint: bOk,
    detail: bOk
      ? "4/4 gènes couverture atteinte"
      : "couverture phénotypique insuffisante ou diagnostic absent",
  });

  // C — générations
  const gens = bcd.map((r) => r.generationMaximale);
  const genMediane = gens.length > 0 ? medianeNombres(gens) : null;
  const naissancesPresentesParCondition = {
    B: resumesParCondition(resumes, "B").every((r) => r.naissancesCumulees > 0),
    C: resumesParCondition(resumes, "C").every((r) => r.naissancesCumulees > 0),
    D: runsD.every((r) => r.naissancesCumulees > 0),
  } as const;
  const cOk =
    genMediane !== null &&
    genMediane >= SEUILS_CALIBRATION_V02.generationMedianeBCDMin &&
    naissancesPresentesParCondition.B &&
    naissancesPresentesParCondition.C &&
    naissancesPresentesParCondition.D &&
    resumesParCondition(resumes, "B").length >=
      SEUILS_CALIBRATION_V02.seedsAvecNaissanceMinParConditionBcd &&
    resumesParCondition(resumes, "C").length >=
      SEUILS_CALIBRATION_V02.seedsAvecNaissanceMinParConditionBcd &&
    runsD.length >= SEUILS_CALIBRATION_V02.seedsAvecNaissanceMinParConditionBcd;
  criteres.push({
    identifiant: "C_PORTEE_MULTI_GENERATION",
    atteint: cOk,
    detail: `medianeGen=${String(genMediane)} naissances B/C/D=${String(naissancesPresentesParCondition.B)}/${String(naissancesPresentesParCondition.C)}/${String(naissancesPresentesParCondition.D)}`,
  });

  // D — descendance différentielle
  const seedsDescendanceDifferentielleParCondition: Record<
    "B" | "C" | "D",
    number
  > = { B: 0, C: 0, D: 0 };
  for (const cond of ["B", "C", "D"] as const) {
    for (const r of resumesParCondition(resumes, cond)) {
      let points =
        options.trajectoires?.get(r.identifiantRun) ??
        undefined;
      if (points === undefined) {
        const chemin = join(
          options.repertoireBatch,
          "runs",
          r.identifiantRun,
          "trajectoire.jsonl",
        );
        if (existsSync(chemin)) {
          points = chargerTrajectoireFichier(chemin);
        }
      }
      if (points === undefined || points.length === 0) {
        continue;
      }
      const dernier = points[points.length - 1]!;
      if (descendanceDifferentiellePresente(dernier.lignees)) {
        seedsDescendanceDifferentielleParCondition[cond] += 1;
      }
    }
  }
  const dOk = (["B", "C", "D"] as const).every(
    (c) =>
      seedsDescendanceDifferentielleParCondition[c] >=
      SEUILS_CALIBRATION_V02.seedsDescendanceDifferentielleMinParCondition,
  );
  criteres.push({
    identifiant: "D_DESCENDANCE_DIFFERENTIELLE",
    atteint: dOk,
    detail: `seeds différentielles B/C/D=${String(seedsDescendanceDifferentielleParCondition.B)}/${String(seedsDescendanceDifferentielleParCondition.C)}/${String(seedsDescendanceDifferentielleParCondition.D)}`,
  });

  // E — mutations D
  const runsDAvecMutation = runsD.filter((r) => r.mutationsCumulees > 0).length;
  const eOk =
    runsDAvecMutation >= SEUILS_CALIBRATION_V02.runsDAvecMutationMin;
  criteres.push({
    identifiant: "E_MUTATIONS_PRESENTES",
    atteint: eOk,
    detail: `runs D avec mutation=${String(runsDAvecMutation)}/${String(runsD.length)}`,
  });

  // F — expression cognitive D
  const exprRuns = diagnostic?.expressionParRun ?? [];
  const runsDExpressionCognitive = exprRuns.filter(
    (e) => e.condition === "D" && e.expressionCognitive,
  ).length;
  const fOk =
    runsDExpressionCognitive >=
    SEUILS_CALIBRATION_V02.runsDExpressionCognitiveMin;
  criteres.push({
    identifiant: "F_EXPRESSION_COGNITIVE",
    atteint: fOk,
    detail: `runs D expression cognitive=${String(runsDExpressionCognitive)}`,
  });

  // G — comportement / économie D
  const runsDExpressionComportementOuEco = exprRuns.filter(
    (e) =>
      e.condition === "D" &&
      (e.expressionComportementale || e.consequenceEconomiqueImmediate),
  ).length;
  const gOk =
    runsDExpressionComportementOuEco >=
    SEUILS_CALIBRATION_V02.runsDExpressionComportementOuEcoMin;
  criteres.push({
    identifiant: "G_TRAVERSEE_COMPORTEMENT_ECO",
    atteint: gOk,
    detail: `runs D comportement/éco=${String(runsDExpressionComportementOuEco)}`,
  });

  // Garde-fous (B/C/D)
  const fractionRunsContraintsParGardeFou =
    bcd.length === 0
      ? 0
      : bcd.filter((r) => r.runContraintParGardeFou).length / bcd.length;
  const fractionCyclesPopulationMaxAtteinte = meanRatio(
    bcd,
    (r) => r.cyclesPopulationMaximaleAtteinte,
  );
  const fractionCyclesPlafondNaissancesAtteint = meanRatio(
    bcd,
    (r) => r.cyclesPlafondNaissancesAtteint,
  );
  const gardeFousOk =
    fractionRunsContraintsParGardeFou <
      SEUILS_CALIBRATION_V02.fractionRunsContraintsParGardeFouMax &&
    fractionCyclesPopulationMaxAtteinte <
      SEUILS_CALIBRATION_V02.fractionCyclesPopulationMaxAtteinteMax &&
    fractionCyclesPlafondNaissancesAtteint <
      SEUILS_CALIBRATION_V02.fractionCyclesPlafondNaissancesAtteintMax;
  criteres.push({
    identifiant: "GARDE_FOUS",
    atteint: gardeFousOk,
    detail: `contraints=${fractionRunsContraintsParGardeFou.toFixed(3)} popMax=${fractionCyclesPopulationMaxAtteinte.toFixed(3)} plafondNaiss=${fractionCyclesPlafondNaissancesAtteint.toFixed(3)}`,
  });

  // Extinction précoce totale
  const extinctionPrecoceTotale =
    bcd.length > 0 &&
    bcd.every(
      (r) =>
        r.eteinte &&
        r.generationMaximale <
          SEUILS_CALIBRATION_V02.generationMinAvantExtinctionTotale,
    );
  criteres.push({
    identifiant: "EXTINCTION_PRECOCE_TOTALE",
    atteint: !extinctionPrecoceTotale,
    detail: extinctionPrecoceTotale
      ? "100 % B/C/D éteints avant génération 2"
      : "pas d'extinction précoce totale",
  });

  const echecs = criteres.filter((c) => !c.atteint);
  const candidatValide = echecs.length === 0;
  const motifInvalidation = candidatValide
    ? null
    : echecs.map((e) => e.identifiant).join(", ");

  return {
    version: VERSION_CRITERES_CALIBRATION_V02,
    identifiantCandidat: options.identifiantCandidat,
    identifiantBatch: options.manifeste.identifiantBatch,
    identifiantProtocole: options.manifeste.identifiantProtocole,
    parametresModifiesParRapportPrecedent:
      options.parametresModifiesParRapportPrecedent ?? "aucun (premier candidat)",
    raisonModification:
      options.raisonModification ??
      "premier candidat — paramètres hérités environnement-exposition-v02-e2",
    runsPrevus,
    runsTermines,
    runsEchoues,
    controleNegatifBcIdentique: options.controleNegatifBcIdentique,
    generationMaximaleMedianeBCD: genMediane,
    naissancesPresentesParCondition,
    seedsDescendanceDifferentielleParCondition,
    runsDAvecMutation,
    runsDExpressionCognitive,
    runsDExpressionComportementOuEco,
    couverturePhenotypiqueAtteinte: bOk,
    fractionRunsContraintsParGardeFou,
    fractionCyclesPopulationMaxAtteinte,
    fractionCyclesPlafondNaissancesAtteint,
    extinctionPrecoceTotale,
    criteres,
    candidatValide,
    motifInvalidation,
  };
}

export function rendreRapportCalibrationV02(
  resume: ResumeCalibrationV02,
): string {
  const lignes: string[] = [
    `# Rapport calibration ${resume.identifiantCandidat}`,
    "",
    `- Protocole : ${resume.identifiantProtocole}`,
    `- Batch : ${resume.identifiantBatch}`,
    `- Paramètres modifiés : ${resume.parametresModifiesParRapportPrecedent}`,
    `- Raison : ${resume.raisonModification}`,
    "",
    `## Intégrité`,
    "",
    `- Runs : ${String(resume.runsTermines)}/${String(resume.runsPrevus)} (échoués ${String(resume.runsEchoues)})`,
    `- B/C : ${resume.controleNegatifBcIdentique ? "identiques" : "DIFFÉRENTS"}`,
    "",
    `## Métriques instrumentales`,
    "",
    `- génération médiane BCD : ${String(resume.generationMaximaleMedianeBCD)}`,
    `- naissances 5/5 B/C/D : ${JSON.stringify(resume.naissancesPresentesParCondition)}`,
    `- descendance différentielle seeds : ${JSON.stringify(resume.seedsDescendanceDifferentielleParCondition)}`,
    `- runs D mutation : ${String(resume.runsDAvecMutation)}`,
    `- runs D expression cognitive : ${String(resume.runsDExpressionCognitive)}`,
    `- runs D comportement/éco : ${String(resume.runsDExpressionComportementOuEco)}`,
    `- couverture phénotypique : ${resume.couverturePhenotypiqueAtteinte ? "OK" : "NON"}`,
    `- garde-fous contraints/popMax/plafond : ${resume.fractionRunsContraintsParGardeFou.toFixed(3)} / ${resume.fractionCyclesPopulationMaxAtteinte.toFixed(3)} / ${resume.fractionCyclesPlafondNaissancesAtteint.toFixed(3)}`,
    `- extinction précoce totale : ${resume.extinctionPrecoceTotale ? "oui" : "non"}`,
    "",
    `## Critères`,
    "",
  ];
  for (const c of resume.criteres) {
    lignes.push(
      `- ${c.identifiant} : ${c.atteint ? "atteint" : "NON"} — ${c.detail}`,
    );
  }
  lignes.push(
    "",
    `## Verdict`,
    "",
    resume.candidatValide
      ? "SATISFAISANT → STOP CALIBRATION"
      : `REJETE → ${resume.motifInvalidation ?? "?"}`,
    "",
    "Aucune métrique D−C n'a été utilisée pour ce verdict.",
    "",
  );
  return lignes.join("\n");
}

export function ecrireArtefactsCalibrationV02(options: {
  readonly repertoireBatch: string;
  readonly resume: ResumeCalibrationV02;
}): void {
  const dir = join(options.repertoireBatch, "calibration");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "resume-calibration.json"),
    JSON.stringify(options.resume, null, 2),
    "utf8",
  );
  writeFileSync(
    join(dir, "rapport-calibration.md"),
    rendreRapportCalibrationV02(options.resume),
    "utf8",
  );
}

export function estProtocoleCalibrationV02(
  identifiantProtocole: string,
): boolean {
  return identifiantProtocole.startsWith("evolution-calibration-v02-");
}

export function extraireIdentifiantCandidatCalibration(
  identifiantProtocole: string,
): string {
  const m = /evolution-calibration-v02-(.+)$/.exec(identifiantProtocole);
  return m?.[1] ?? identifiantProtocole;
}

export type { IdentifiantCritereCalibrationV02 };
export { IDENTIFIANTS_CRITERES_CALIBRATION_V02 };
