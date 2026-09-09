/**
 * Runner de campagne expérimentale évolution multi-génération.
 * Isolation des runs ; parallélisme sans effet causal ; reprise de batch.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { identifiantRun } from "./conditions.js";
import { evaluerControleNegatifBatch } from "./controle-negatif.js";
import { executerRun, nettoyerRunPartiel } from "./executer-run.js";
import {
  ajouterMarqueur,
  construireManifesteBatch,
  ecrireManifeste,
  fabriquerIdentifiantBatch,
  lireManifeste,
  mettreAJourStatutRun,
  type EntreeRunManifeste,
  type ManifesteBatchEvolution,
} from "./manifeste-batch.js";
import type { FournisseurMetaCode, MetaCode } from "./meta-code.js";
import { FournisseurMetaCodeIndisponible } from "./meta-code.js";
import {
  ProtocoleEvolutionInvalideErreur,
} from "./protocole-evolution.js";
import {
  empreinteProtocoleCampagne,
  preparerCampagneEvolution,
  type ProtocoleCampagneEvolution,
} from "./protocole-versionne.js";
import { chargerTrajectoireFichier, ecrireRapportsBatch } from "./rapports.js";
import type { ResumeRunEvolution } from "./resume-run.js";
import type { PointTrajectoireEvolution } from "./trajectoire.js";
import {
  genererDiagnosticExpositionPhenotypique,
  peutGenererDiagnosticExposition,
} from "./diagnostic-exposition-phenotypique-v02.js";
import {
  ecrireArtefactsCalibrationV02,
  estProtocoleCalibrationV02,
  evaluerCandidatCalibrationV02,
  extraireIdentifiantCandidatCalibration,
} from "./evaluer-candidat-calibration-v02.js";

export type OptionsRunnerCampagne = {
  readonly protocole: ProtocoleCampagneEvolution;
  readonly repertoireResultats?: string;
  readonly concurrence?: number;
  readonly fournisseurMetaCode?: FournisseurMetaCode;
  readonly dateLancement?: string;
  readonly identifiantBatch?: string;
};

export type ResultatCampagneEvolution = {
  readonly manifeste: ManifesteBatchEvolution;
  readonly repertoireBatch: string;
  readonly resumes: readonly ResumeRunEvolution[];
};

async function executerAvecConcurrence<T>(
  taches: readonly (() => Promise<T>)[],
  concurrence: number,
): Promise<T[]> {
  const resultats: T[] = new Array(taches.length);
  let curseur = 0;
  const travailleurs = Array.from(
    { length: Math.max(1, Math.min(concurrence, taches.length || 1)) },
    async () => {
      while (true) {
        const i = curseur;
        curseur += 1;
        if (i >= taches.length) {
          return;
        }
        resultats[i] = await taches[i]!();
      }
    },
  );
  if (taches.length === 0) {
    return [];
  }
  await Promise.all(travailleurs);
  return resultats;
}

function runTermineValide(repertoireRun: string): {
  valide: boolean;
  resume?: ResumeRunEvolution;
  empreinteExecutionRun?: string;
  empreinteResultatScientifique?: string;
  empreinteRun?: string;
} {
  const cheminResume = join(repertoireRun, "resume.json");
  const cheminStatut = join(repertoireRun, "statut.json");
  const cheminTraj = join(repertoireRun, "trajectoire.jsonl");
  if (
    !existsSync(cheminResume) ||
    !existsSync(cheminStatut) ||
    !existsSync(cheminTraj)
  ) {
    return { valide: false };
  }
  try {
    const statut = JSON.parse(readFileSync(cheminStatut, "utf8")) as {
      statut?: string;
      empreinteExecutionRun?: string;
      empreinteResultatScientifique?: string;
      empreinteRun?: string;
    };
    const resume = JSON.parse(
      readFileSync(cheminResume, "utf8"),
    ) as ResumeRunEvolution;
    if (statut.statut !== "termine" || resume.statut !== "termine") {
      return { valide: false };
    }
    const empExec =
      resume.empreinteExecutionRun ?? resume.empreinteRun ?? "";
    const empSci = resume.empreinteResultatScientifique ?? "";
    if (typeof empExec !== "string" || empExec.length === 0) {
      return { valide: false };
    }
    if (typeof empSci !== "string" || empSci.length === 0) {
      return { valide: false };
    }
    if (!empExec.startsWith("sha256:") || !empSci.startsWith("sha256:")) {
      return { valide: false };
    }
    const statutExec = statut.empreinteExecutionRun ?? statut.empreinteRun;
    if (statutExec !== undefined && statutExec !== empExec) {
      return { valide: false };
    }
    if (
      statut.empreinteResultatScientifique !== undefined &&
      statut.empreinteResultatScientifique !== empSci
    ) {
      return { valide: false };
    }
    return {
      valide: true,
      resume: {
        ...resume,
        empreinteExecutionRun: empExec,
        empreinteResultatScientifique: empSci,
        empreinteRun: empExec,
      },
      empreinteExecutionRun: empExec,
      empreinteResultatScientifique: empSci,
      empreinteRun: empExec,
    };
  } catch {
    return { valide: false };
  }
}

/**
 * Lance ou reprend une campagne complète.
 */
export async function executerCampagneEvolution(
  options: OptionsRunnerCampagne,
): Promise<ResultatCampagneEvolution> {
  const protocole = options.protocole;
  preparerCampagneEvolution(protocole);
  const concurrence = options.concurrence ?? 1;
  if (!Number.isInteger(concurrence) || concurrence < 1) {
    throw new ProtocoleEvolutionInvalideErreur(
      "concurrence doit être un entier >= 1",
    );
  }

  const fournisseurMeta =
    options.fournisseurMetaCode ?? new FournisseurMetaCodeIndisponible();
  const metaCode: MetaCode = await Promise.resolve(
    fournisseurMeta.obtenirMetaCode(),
  );

  if (
    protocole.mode === "evaluation" &&
    metaCode.workingTreeDirty === true &&
    protocole.exigerArbrePropre
  ) {
    throw new ProtocoleEvolutionInvalideErreur(
      "évaluation refuse un arbre Git sale (exigerArbrePropre)",
    );
  }

  const dateLancement =
    options.dateLancement ??
    protocole.dateLancementFixe ??
    new Date().toISOString();

  const racineResultats = resolve(
    options.repertoireResultats ?? protocole.repertoireResultatsRelatif,
  );
  mkdirSync(racineResultats, { recursive: true });

  const identifiantBatch =
    options.identifiantBatch ??
    fabriquerIdentifiantBatch(protocole, { horodatage: dateLancement });
  const repertoireBatch = join(racineResultats, identifiantBatch);
  mkdirSync(repertoireBatch, { recursive: true });
  mkdirSync(join(repertoireBatch, "runs"), { recursive: true });

  writeFileSync(
    join(repertoireBatch, "protocole.json"),
    JSON.stringify(
      {
        ...protocole,
        empreinteProtocole: empreinteProtocoleCampagne(protocole),
      },
      null,
      2,
    ),
    "utf8",
  );

  let manifeste =
    lireManifeste(repertoireBatch) ??
    construireManifesteBatch({
      protocole,
      metaCode,
      dateLancement,
      identifiantBatch,
    });

  if (manifeste.empreinteProtocole !== empreinteProtocoleCampagne(protocole)) {
    throw new ProtocoleEvolutionInvalideErreur(
      "empreinteProtocole du manifeste incompatible avec le protocole chargé",
    );
  }

  if (
    protocole.mode === "evaluation" &&
    metaCode.workingTreeDirty === true &&
    !manifeste.marqueurs.includes("NON_CANONIQUE_CODE_MODIFIE")
  ) {
    manifeste = ajouterMarqueur(manifeste, "NON_CANONIQUE_CODE_MODIFIE");
  }

  ecrireManifeste(repertoireBatch, manifeste);

  /** Sérialise les écritures manifeste sous concurrence. */
  let fileManifeste: Promise<void> = Promise.resolve();
  const majManifeste = (
    fn: (m: ManifesteBatchEvolution) => ManifesteBatchEvolution,
  ): Promise<void> => {
    fileManifeste = fileManifeste.then(() => {
      manifeste = fn(manifeste);
      ecrireManifeste(repertoireBatch, manifeste);
    });
    return fileManifeste;
  };

  const taches = manifeste.runs.map((entree) => async () => {
    const repertoireRun = join(repertoireBatch, "runs", entree.identifiantRun);
    const existant = runTermineValide(repertoireRun);
    if (existant.valide && existant.resume !== undefined) {
      const majTerminee: Partial<EntreeRunManifeste> = { statut: "termine" };
      if (existant.empreinteExecutionRun !== undefined) {
        majTerminee.empreinteExecutionRun = existant.empreinteExecutionRun;
        majTerminee.empreinteRun = existant.empreinteExecutionRun;
      }
      if (existant.empreinteResultatScientifique !== undefined) {
        majTerminee.empreinteResultatScientifique =
          existant.empreinteResultatScientifique;
      }
      await majManifeste((m) =>
        mettreAJourStatutRun(m, entree.identifiantRun, majTerminee),
      );
      return {
        resume: existant.resume,
        points: chargerTrajectoireFichier(
          join(repertoireRun, "trajectoire.jsonl"),
        ),
        saute: true as const,
      };
    }

    // Incomplet → supprimer et recommencer (jamais fusionner un partiel).
    nettoyerRunPartiel(repertoireRun);

    await majManifeste((m) =>
      mettreAJourStatutRun(m, entree.identifiantRun, { statut: "en_cours" }),
    );

    try {
      const resultat = await executerRun({
        protocole,
        condition: entree.condition,
        seed: entree.seed,
        repertoireRun,
        identifiantBatch,
        metaCode,
        dateLancement,
      });
      await majManifeste((m) =>
        mettreAJourStatutRun(m, entree.identifiantRun, {
          statut: "termine",
          empreinteExecutionRun: resultat.empreinteExecutionRun,
          empreinteResultatScientifique: resultat.empreinteResultatScientifique,
          empreinteRun: resultat.empreinteExecutionRun,
        }),
      );
      return {
        resume: resultat.resume,
        points: resultat.points,
        saute: false as const,
      };
    } catch (erreur) {
      const message =
        erreur instanceof Error ? erreur.message : String(erreur);
      await majManifeste((m) =>
        mettreAJourStatutRun(m, entree.identifiantRun, {
          statut: "echoue",
          messageErreur: message,
        }),
      );
      throw erreur;
    }
  });

  const resultatsRuns = await executerAvecConcurrence(taches, concurrence);

  const resumes: ResumeRunEvolution[] = [];
  const trajectoires = new Map<string, readonly PointTrajectoireEvolution[]>();
  for (const r of resultatsRuns) {
    resumes.push(r.resume);
    trajectoires.set(r.resume.identifiantRun, r.points);
  }

  // Contrôle négatif B vs C
  const controle = evaluerControleNegatifBatch({ resumes, trajectoires });
  if (!controle.ok) {
    manifeste = ajouterMarqueur(manifeste, "CONTROLE_NEGATIF_ECHOUE");
    writeFileSync(
      join(repertoireBatch, "controle-negatif.json"),
      JSON.stringify(controle, null, 2),
      "utf8",
    );
  } else {
    writeFileSync(
      join(repertoireBatch, "controle-negatif.json"),
      JSON.stringify(controle, null, 2),
      "utf8",
    );
  }

  ecrireManifeste(repertoireBatch, manifeste);
  ecrireRapportsBatch({
    repertoireBatch,
    manifeste,
    resumes,
    trajectoires,
    controleNegatifOk: controle.ok,
  });

  if (peutGenererDiagnosticExposition(protocole)) {
    genererDiagnosticExpositionPhenotypique({
      repertoireBatch,
      manifeste,
      resumes,
      controleNegatifBcIdentique: controle.ok,
    });
  }

  if (estProtocoleCalibrationV02(protocole.identifiantProtocole)) {
    const resumeCalibration = evaluerCandidatCalibrationV02({
      identifiantCandidat: extraireIdentifiantCandidatCalibration(
        protocole.identifiantProtocole,
      ),
      manifeste,
      resumes,
      repertoireBatch,
      trajectoires,
      controleNegatifBcIdentique: controle.ok,
    });
    ecrireArtefactsCalibrationV02({
      repertoireBatch,
      resume: resumeCalibration,
    });
  }

  return { manifeste, repertoireBatch, resumes };
}

export { identifiantRun };
