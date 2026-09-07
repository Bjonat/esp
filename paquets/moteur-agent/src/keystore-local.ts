import {
  accessSync,
  chmodSync,
  constants,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  IdentiteEspErreur,
  extraireClePubliqueDepuisPkcs8,
} from "./identite-ed25519.js";

/**
 * Stockage local des clés privées d'identité ESP.
 *
 * - hors registre / SQLite / API / dashboard ;
 * - permissions 0700 (répertoire) / 0600 (fichier) ;
 * - NON chiffré en v0.1 développement — insuffisant pour Live.
 *
 * Chemin par défaut : data/developpement/identites/
 */
export const CHEMIN_KEYSTORE_IDENTITES_DEFAUT =
  "data/developpement/identites";

export type ClePriveeStockee = {
  readonly identifiantExperience: string;
  readonly identifiantAgent: string;
  readonly clePriveePkcs8Der: Buffer;
  readonly clePubliqueBase64Url: string;
  readonly empreinteClePublique: string;
};

export class KeystoreIdentitesLocal {
  readonly repertoireRacine: string;

  constructor(repertoireRacine: string = CHEMIN_KEYSTORE_IDENTITES_DEFAUT) {
    this.repertoireRacine = repertoireRacine;
  }

  cheminFichier(
    identifiantExperience: string,
    identifiantAgent: string,
  ): string {
    return join(
      this.repertoireRacine,
      sanitiserSegment(identifiantExperience),
      `${sanitiserSegment(identifiantAgent)}.ed25519.pkcs8`,
    );
  }

  assurerRepertoireExperience(identifiantExperience: string): void {
    const chemin = join(
      this.repertoireRacine,
      sanitiserSegment(identifiantExperience),
    );
    mkdirSync(chemin, { recursive: true, mode: 0o700 });
    try {
      chmodSync(this.repertoireRacine, 0o700);
    } catch {
      // plateformes / FS sans chmod (ex. certains mounts) — best effort
    }
    try {
      chmodSync(chemin, 0o700);
    } catch {
      // best effort
    }
  }

  enregistrerClePrivee(options: {
    readonly identifiantExperience: string;
    readonly identifiantAgent: string;
    readonly clePriveePkcs8Der: Buffer;
  }): ClePriveeStockee {
    this.assurerRepertoireExperience(options.identifiantExperience);
    const chemin = this.cheminFichier(
      options.identifiantExperience,
      options.identifiantAgent,
    );
    if (existeFichier(chemin)) {
      throw new IdentiteEspErreur(
        `Clé privée déjà présente pour ${options.identifiantAgent} — pas d'écrasement silencieux`,
      );
    }
    writeFileSync(chemin, options.clePriveePkcs8Der, { mode: 0o600 });
    try {
      chmodSync(chemin, 0o600);
    } catch {
      // best effort
    }
    const publique = extraireClePubliqueDepuisPkcs8(options.clePriveePkcs8Der);
    return {
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantAgent,
      clePriveePkcs8Der: options.clePriveePkcs8Der,
      clePubliqueBase64Url: publique.clePubliqueBase64Url,
      empreinteClePublique: publique.empreinteClePublique,
    };
  }

  /**
   * Charge la clé privée. Retourne null si absente — JAMAIS de régénération.
   */
  chargerClePrivee(options: {
    readonly identifiantExperience: string;
    readonly identifiantAgent: string;
  }): ClePriveeStockee | null {
    const chemin = this.cheminFichier(
      options.identifiantExperience,
      options.identifiantAgent,
    );
    if (!existeFichier(chemin)) {
      return null;
    }
    const clePriveePkcs8Der = readFileSync(chemin);
    const publique = extraireClePubliqueDepuisPkcs8(clePriveePkcs8Der);
    return {
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantAgent,
      clePriveePkcs8Der,
      clePubliqueBase64Url: publique.clePubliqueBase64Url,
      empreinteClePublique: publique.empreinteClePublique,
    };
  }

  existeClePrivee(options: {
    readonly identifiantExperience: string;
    readonly identifiantAgent: string;
  }): boolean {
    return existeFichier(
      this.cheminFichier(
        options.identifiantExperience,
        options.identifiantAgent,
      ),
    );
  }

  /**
   * Lit le mode fichier si la plateforme le permet (sinon null).
   */
  lireModeFichier(options: {
    readonly identifiantExperience: string;
    readonly identifiantAgent: string;
  }): number | null {
    const chemin = this.cheminFichier(
      options.identifiantExperience,
      options.identifiantAgent,
    );
    try {
      return statSync(chemin).mode & 0o777;
    } catch {
      return null;
    }
  }

  lireModeRepertoireExperience(identifiantExperience: string): number | null {
    const chemin = join(
      this.repertoireRacine,
      sanitiserSegment(identifiantExperience),
    );
    try {
      return statSync(chemin).mode & 0o777;
    } catch {
      return null;
    }
  }
}

function existeFichier(chemin: string): boolean {
  try {
    accessSync(chemin, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function sanitiserSegment(valeur: string): string {
  const nettoye = valeur.replaceAll(/[^a-zA-Z0-9._-]/gu, "_");
  if (nettoye.length === 0) {
    throw new IdentiteEspErreur("Segment de chemin d'identité vide");
  }
  return nettoye;
}

/** Exposé pour tests de permissions sur le parent. */
export function assurerPermissionsRepertoireParent(cheminFichier: string): void {
  mkdirSync(dirname(cheminFichier), { recursive: true, mode: 0o700 });
}
