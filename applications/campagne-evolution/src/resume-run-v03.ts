/**
 * Résumé de run v0.3 — étend le résumé v0.1/v0.2 sans score/fitness.
 */

import type { ResumeRunEvolution } from "./resume-run.js";
import type { AgregatsObservabiliteReproductionV03Resume } from "./empreinte-v03.js";
import type { CleAppariementH4AgentV03 } from "./cles-appariement-h4-v03.js";
import type { AvertissementH4EvolutionV03 } from "./hypotheses-evolution-v03.js";

export type ResumeRunEvolutionV03 = ResumeRunEvolution & {
  readonly versionResume: "resume-run-evolution-v03";
  readonly identifiantEnvironnementExposition: string;
  readonly versionEnvironnementExposition: string;
  readonly etatRun: "complet" | "incomplet";
  readonly activiteEconomiqueHorsReproductionPopulationMicroUsdc: string;
  readonly resultatsEconomiquesHorsReproductionParAgent: readonly {
    readonly identifiantAgent: string;
    readonly resultatEconomiqueHorsReproductionMicroUsdc: string;
    readonly cycleDebut: number;
    readonly cycleFin: number;
  }[];
  readonly observabiliteReproductionEconomique: AgregatsObservabiliteReproductionV03Resume | null;
  /** Clés d'appariement — pas d'analyse H4 / pas de gagnant. */
  readonly matchingH4: readonly CleAppariementH4AgentV03[];
  readonly avertissementH4: AvertissementH4EvolutionV03;
  /** Empreinte scientifique v03 (B ≡ C si taux=0). */
  readonly empreinteResultatScientifiqueV03: string;
};

export function estResumeRunEvolutionV03(
  resume: ResumeRunEvolution,
): resume is ResumeRunEvolutionV03 {
  return (
    "versionResume" in resume &&
    (resume as ResumeRunEvolutionV03).versionResume === "resume-run-evolution-v03"
  );
}
