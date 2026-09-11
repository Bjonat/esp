/**
 * CLI — diagnostic d'exposition évolution v0.3 (v03-E).
 *
 *   pnpm diagnostic:exposition-v03
 *   pnpm diagnostic:exposition-v03 -- --repertoire experiences/diagnostics
 */

import { resolve } from "node:path";
import {
  ecrireArtefactDiagnosticExpositionV03,
  executerDiagnosticExpositionV03,
} from "./diagnostic-exposition-v03.js";
import { resumeSensibiliteParGenePourRapport } from "./rapport-diagnostic-exposition-v03.js";

export function parserArgumentsCliDiagnosticExpositionV03(
  argv: readonly string[],
): { readonly repertoire: string } {
  let repertoire = "experiences/diagnostics";
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repertoire" || a === "--repertoire-sortie") {
      const v = argv[++i];
      if (v === undefined) {
        throw new Error("--repertoire requiert un chemin");
      }
      repertoire = v;
    }
  }
  return { repertoire: resolve(repertoire) };
}

export function mainDiagnosticExpositionV03(
  argv: readonly string[] = process.argv.slice(2),
): void {
  const args = parserArgumentsCliDiagnosticExpositionV03(argv);
  const rapport = executerDiagnosticExpositionV03({
    repertoireSortie: args.repertoire,
  });
  const chemin = ecrireArtefactDiagnosticExpositionV03({
    rapport,
    repertoireSortie: args.repertoire,
  });

  const resumeGenes =
    rapport.candidatRetenu === null
      ? null
      : resumeSensibiliteParGenePourRapport(
          rapport.resultatsCandidats.find(
            (r) => r.identifiantCandidat === rapport.candidatRetenu,
          )?.agregatsParGene ?? [],
        );

  process.stdout.write(
    JSON.stringify(
      {
        verdict: rapport.verdictGlobal,
        candidatRetenu: rapport.candidatRetenu,
        candidatsExecutes: rapport.candidatsExecutes,
        empreinte: rapport.empreinteSha256,
        artefact: chemin,
        genes: resumeGenes,
        controlePositif: {
          ok: rapport.controlePositifReproduction.ok,
          franchissement0vers1:
            rapport.controlePositifReproduction.franchissement0vers1,
          franchissement1vers2:
            rapport.controlePositifReproduction.franchissement1vers2,
        },
        controleNegatifBc: rapport.controleNegatifBc,
      },
      null,
      2,
    ) + "\n",
  );

  if (rapport.verdictGlobal !== "EXPOSITION_SUFFISANTE") {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli-diagnostic-exposition-v03.ts") ||
    process.argv[1].endsWith("cli-diagnostic-exposition-v03.js"))
) {
  try {
    mainDiagnosticExpositionV03();
  } catch (erreur: unknown) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
