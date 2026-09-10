/**
 * Manifeste de batch figé — plan des runs et états de reprise.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { listerRunsPlanifies, identifiantRun } from "./conditions.js";
import {
  FORMATS_EMPREINTES_CAMPAGNE,
  type FormatsEmpreintesCampagne,
} from "./empreinte.js";
import type { MetaCode } from "./meta-code.js";
import type { ConditionEvolution } from "./protocole-evolution.js";
import {
  empreinteProtocoleCampagne,
  type ProtocoleCampagneEvolution,
} from "./protocole-versionne.js";

export type StatutRunManifeste =
  | "planifie"
  | "en_cours"
  | "termine"
  | "echoue";

export type EntreeRunManifeste = {
  readonly identifiantRun: string;
  readonly condition: ConditionEvolution;
  readonly seed: number;
  statut: StatutRunManifeste;
  empreinteExecutionRun?: string;
  empreinteResultatScientifique?: string;
  /** @deprecated alias empreinteExecutionRun */
  empreinteRun?: string;
  messageErreur?: string;
};

export type MarqueurBatch =
  | "OK"
  | "NON_CANONIQUE_CODE_MODIFIE"
  | "CONTROLE_NEGATIF_ECHOUE"
  | "NON_CANONIQUE_CODE_MODIFIE_ET_CONTROLE_NEGATIF_ECHOUE";

export type ManifesteBatchEvolution = {
  readonly version: "manifeste-batch-evolution-v01";
  readonly identifiantBatch: string;
  readonly identifiantProtocole: string;
  readonly empreinteProtocole: string;
  readonly formatsEmpreintes: FormatsEmpreintesCampagne;
  readonly mode: "diagnostic" | "calibration" | "evaluation";
  readonly dateLancement: string;
  readonly metaCode: MetaCode;
  readonly marqueurs: MarqueurBatch[];
  readonly runs: EntreeRunManifeste[];
};

export function fabriquerIdentifiantBatch(
  protocole: ProtocoleCampagneEvolution,
  options?: { readonly horodatage?: string },
): string {
  const emp = empreinteProtocoleCampagne(protocole);
  const hex = emp.startsWith("sha256:") ? emp.slice("sha256:".length) : emp;
  const date =
    protocole.dateLancementFixe ??
    options?.horodatage ??
    new Date().toISOString().replace(/[:.]/g, "-");
  return `${protocole.identifiantProtocole}-${hex.slice(0, 12)}-${protocole.mode}-${date}`;
}

export function construireManifesteBatch(options: {
  readonly protocole: ProtocoleCampagneEvolution;
  readonly metaCode: MetaCode;
  readonly dateLancement: string;
  readonly identifiantBatch?: string;
}): ManifesteBatchEvolution {
  const emp = empreinteProtocoleCampagne(options.protocole);
  const identifiantBatch =
    options.identifiantBatch ??
    fabriquerIdentifiantBatch(options.protocole, {
      horodatage: options.dateLancement,
    });

  const marqueurs: MarqueurBatch[] = [];
  if (
    options.protocole.mode === "evaluation" &&
    options.metaCode.workingTreeDirty === true
  ) {
    marqueurs.push("NON_CANONIQUE_CODE_MODIFIE");
  }

  const runs: EntreeRunManifeste[] = listerRunsPlanifies(options.protocole).map(
    (r) => ({
      identifiantRun: r.identifiantRun,
      condition: r.condition,
      seed: r.seed,
      statut: "planifie" as const,
    }),
  );

  return {
    version: "manifeste-batch-evolution-v01",
    identifiantBatch,
    identifiantProtocole: options.protocole.identifiantProtocole,
    empreinteProtocole: emp,
    formatsEmpreintes: FORMATS_EMPREINTES_CAMPAGNE,
    mode: options.protocole.mode,
    dateLancement: options.dateLancement,
    metaCode: options.metaCode,
    marqueurs,
    runs,
  };
}

export function cheminManifeste(repertoireBatch: string): string {
  return join(repertoireBatch, "manifeste.json");
}

export function ecrireManifeste(
  repertoireBatch: string,
  manifeste: ManifesteBatchEvolution,
): void {
  mkdirSync(repertoireBatch, { recursive: true });
  writeFileSync(
    cheminManifeste(repertoireBatch),
    JSON.stringify(manifeste, null, 2),
    "utf8",
  );
}

export function lireManifeste(
  repertoireBatch: string,
): ManifesteBatchEvolution | null {
  const chemin = cheminManifeste(repertoireBatch);
  if (!existsSync(chemin)) {
    return null;
  }
  return JSON.parse(readFileSync(chemin, "utf8")) as ManifesteBatchEvolution;
}

export function mettreAJourStatutRun(
  manifeste: ManifesteBatchEvolution,
  identifiant: string,
  maj: Partial<EntreeRunManifeste>,
): ManifesteBatchEvolution {
  return {
    ...manifeste,
    runs: manifeste.runs.map((r) =>
      r.identifiantRun === identifiant ? { ...r, ...maj } : r,
    ),
  };
}

export function ajouterMarqueur(
  manifeste: ManifesteBatchEvolution,
  marqueur: MarqueurBatch,
): ManifesteBatchEvolution {
  if (manifeste.marqueurs.includes(marqueur)) {
    return manifeste;
  }
  return {
    ...manifeste,
    marqueurs: [...manifeste.marqueurs, marqueur],
  };
}

export { identifiantRun };
