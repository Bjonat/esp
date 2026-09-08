/**
 * CLI calibration évolution — un candidat (surcharge whitelistée).
 *
 * Usage :
 *   pnpm calibration:evolution -- \\
 *     --protocole experiences/protocoles/evolution-pilote-v01.json \\
 *     --etape 1 \\
 *     --surcharge '{"cyclesMaximum":12,"populationMaximale":16}' \\
 *     [--identifiant cal-001] [--hypothese "..."]
 *
 * Ne lance PAS la grille complète — un candidat à la fois.
 * Résultats sous experiences/resultats/calibration/ (gitignored).
 * Fournisseur simulé uniquement — aucun OpenAI.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { evaluerControleNegatifBatch } from "./controle-negatif.js";
import { empreinteProtocole } from "./protocole-evolution.js";
import type { ProtocoleExperienceEvolutionV01Json } from "./protocole-evolution.js";
import {
  construireProtocoleCandidatCalibration,
  type EtapeCalibration,
  type SurchargeCalibration,
} from "./parametres-calibration-autorises.js";
import {
  appendreJournalCalibration,
  type DecisionCalibration,
} from "./journal-calibration.js";
import { evaluerCandidatCalibration } from "./evaluer-candidat-calibration.js";
import { FournisseurMetaCodeGit } from "./meta-code.js";
import { executerCampagneEvolution } from "./runner-campagne.js";
import { chargerTrajectoireFichier } from "./rapports.js";
import type { PointTrajectoireEvolution } from "./trajectoire.js";

export type ArgumentsCliCalibration = {
  readonly cheminProtocole: string;
  readonly etape: EtapeCalibration;
  readonly surcharge: SurchargeCalibration;
  readonly concurrence: number;
  readonly repertoireResultats: string;
  readonly identifiantCalibration: string;
  readonly hypotheseOperationnelle: string;
  readonly cheminJournal: string;
};

function parserEtape(brut: string | undefined): EtapeCalibration {
  const n = Number(brut);
  if (n !== 1 && n !== 2 && n !== 3) {
    throw new Error("--etape doit être 1, 2 ou 3");
  }
  return n;
}

export function parserArgumentsCliCalibration(
  argv: readonly string[],
): ArgumentsCliCalibration {
  let cheminProtocole: string | undefined;
  let etapeBrut: string | undefined;
  let surchargeBrut = "{}";
  let concurrence = 2;
  let repertoireResultats = "experiences/resultats/calibration";
  let identifiantCalibration = `cal-${Date.now().toString(10)}`;
  let hypotheseOperationnelle = "candidat calibration manuel";
  let cheminJournal = "experiences/resultats/calibration/journal-calibration.jsonl";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--protocole") {
      cheminProtocole = argv[++i];
    } else if (arg === "--etape") {
      etapeBrut = argv[++i];
    } else if (arg === "--surcharge") {
      surchargeBrut = argv[++i] ?? "{}";
    } else if (arg === "--concurrency" || arg === "--concurrence") {
      concurrence = Number(argv[++i]);
    } else if (arg === "--repertoire-resultats") {
      repertoireResultats = argv[++i]!;
    } else if (arg === "--identifiant") {
      identifiantCalibration = argv[++i]!;
    } else if (arg === "--hypothese") {
      hypotheseOperationnelle = argv[++i]!;
    } else if (arg === "--journal") {
      cheminJournal = argv[++i]!;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: calibration:evolution --protocole <path> --etape 1|2|3 --surcharge '<json>' [--concurrency 2]\n",
      );
      process.exit(0);
    }
  }

  if (cheminProtocole === undefined || cheminProtocole.trim() === "") {
    throw new Error("--protocole <path> requis");
  }
  if (!Number.isInteger(concurrence) || concurrence < 1) {
    throw new Error("--concurrency doit être un entier >= 1");
  }

  let surcharge: SurchargeCalibration;
  try {
    surcharge = JSON.parse(surchargeBrut) as SurchargeCalibration;
  } catch {
    throw new Error("--surcharge doit être un JSON objet valide");
  }
  if (typeof surcharge !== "object" || surcharge === null || Array.isArray(surcharge)) {
    throw new Error("--surcharge doit être un objet JSON");
  }

  return {
    cheminProtocole,
    etape: parserEtape(etapeBrut),
    surcharge,
    concurrence,
    repertoireResultats,
    identifiantCalibration,
    hypotheseOperationnelle,
    cheminJournal,
  };
}

export async function mainCalibration(
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const args = parserArgumentsCliCalibration(argv);
  const brut = JSON.parse(
    readFileSync(resolve(args.cheminProtocole), "utf8"),
  ) as ProtocoleExperienceEvolutionV01Json;

  const protocole = construireProtocoleCandidatCalibration(
    brut,
    args.surcharge,
    args.etape,
  );

  const repertoireResultats = resolve(args.repertoireResultats);
  mkdirSync(repertoireResultats, { recursive: true });

  const debut = Date.now();
  const resultat = await executerCampagneEvolution({
    protocole: {
      ...protocole,
      repertoireResultatsRelatif: repertoireResultats,
    },
    concurrence: args.concurrence,
    fournisseurMetaCode: new FournisseurMetaCodeGit(),
    repertoireResultats,
  });
  const dureeMsTotale = Date.now() - debut;

  const trajectoires = new Map<string, readonly PointTrajectoireEvolution[]>();
  for (const resume of resultat.resumes) {
    const chemin = join(
      resultat.repertoireBatch,
      "runs",
      resume.identifiantRun,
      "trajectoire.jsonl",
    );
    if (existsSync(chemin)) {
      trajectoires.set(resume.identifiantRun, chargerTrajectoireFichier(chemin));
    }
  }
  const controle = evaluerControleNegatifBatch({
    resumes: resultat.resumes,
    trajectoires,
  });

  const evaluation = evaluerCandidatCalibration({
    resumes: resultat.resumes,
    controleNegatifOk: controle.ok,
    dureeMsTotale,
    etape: args.etape,
  });

  const cheminResume = join(
    resultat.repertoireBatch,
    "resume-calibration.json",
  );
  writeFileSync(
    cheminResume,
    `${JSON.stringify(evaluation.vue, null, 2)}\n`,
    "utf8",
  );

  const decision: DecisionCalibration = evaluation.decision;
  appendreJournalCalibration(resolve(args.cheminJournal), {
    identifiantCalibration: args.identifiantCalibration,
    etape: args.etape,
    parametresChanges: args.surcharge,
    hypotheseOperationnelle: args.hypotheseOperationnelle,
    criteresExamines: Object.keys(evaluation.vue.criteresSatisfaits),
    resultatCriteres: evaluation.vue.criteresSatisfaits,
    decision,
    dureeMs: dureeMsTotale,
    empreinteProtocoleCandidat: empreinteProtocole(protocole),
  });

  process.stdout.write(
    JSON.stringify(
      {
        identifiantCalibration: args.identifiantCalibration,
        identifiantBatch: resultat.manifeste.identifiantBatch,
        repertoireBatch: resultat.repertoireBatch,
        cheminResumeCalibration: cheminResume,
        decision: evaluation.decision,
        motif: evaluation.motif ?? null,
        candidatValide: evaluation.vue.candidatValide,
        empreinteProtocole: empreinteProtocole(protocole),
      },
      null,
      2,
    ) + "\n",
  );
}

const estEntreePrincipale =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli-calibration.ts") ||
    process.argv[1].endsWith("cli-calibration.js"));

if (estEntreePrincipale) {
  mainCalibration().catch((erreur: unknown) => {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
