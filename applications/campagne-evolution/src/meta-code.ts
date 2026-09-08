/**
 * Métadonnées de code (SHA Git) isolées derrière une interface.
 * Les tests n'exigent pas Git installé.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type MetaCode = {
  readonly gitSha: string | null;
  readonly workingTreeDirty: boolean | null;
  readonly source: "git" | "indisponible" | "injecte";
};

export interface FournisseurMetaCode {
  obtenirMetaCode(): Promise<MetaCode> | MetaCode;
}

export class FournisseurMetaCodeIndisponible implements FournisseurMetaCode {
  obtenirMetaCode(): MetaCode {
    return {
      gitSha: null,
      workingTreeDirty: null,
      source: "indisponible",
    };
  }
}

export class FournisseurMetaCodeInjecte implements FournisseurMetaCode {
  constructor(private readonly meta: MetaCode) {}

  obtenirMetaCode(): MetaCode {
    return {
      gitSha: this.meta.gitSha,
      workingTreeDirty: this.meta.workingTreeDirty,
      source: "injecte",
    };
  }
}

/**
 * Tente `git rev-parse` / `git status` — ne lève jamais.
 * En cas d'échec → source indisponible.
 */
export class FournisseurMetaCodeGit implements FournisseurMetaCode {
  constructor(private readonly repertoireTravail?: string) {}

  async obtenirMetaCode(): Promise<MetaCode> {
    try {
      const opts = {
        cwd: this.repertoireTravail,
        timeout: 5_000,
        maxBuffer: 64 * 1024,
      };
      const { stdout: shaBrut } = await execFileAsync(
        "git",
        ["rev-parse", "HEAD"],
        opts,
      );
      const gitSha = shaBrut.trim() || null;
      const { stdout: statut } = await execFileAsync(
        "git",
        ["status", "--porcelain"],
        opts,
      );
      const workingTreeDirty = statut.trim().length > 0;
      return {
        gitSha,
        workingTreeDirty,
        source: "git",
      };
    } catch {
      return {
        gitSha: null,
        workingTreeDirty: null,
        source: "indisponible",
      };
    }
  }
}
