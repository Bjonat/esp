import { DatabaseSync } from "node:sqlite";
import type { TypeEvenementEconomique } from "@esp/protocole";
import { estTypeEvenementEconomique } from "@esp/protocole";
import type {
  EntreeEvenement,
  Evenement,
  RegistreEvenements,
} from "./types.js";
import { figerProfondement, normaliserEntreeEvenement } from "./types.js";

type LigneEvenement = {
  identifiant: string;
  version_schema: number;
  type: string;
  identifiant_experience: string;
  identifiant_agent: string | null;
  numero_cycle: number;
  sequence: number;
  charge_utile: string;
  date_enregistrement: string | null;
  ordre_insertion: number;
};

/**
 * Registre SQLite local append-only.
 * Attribue une séquence monotone par expérience (persistée).
 */
export class RegistreEvenementsSqlite implements RegistreEvenements {
  private readonly base: DatabaseSync;
  private ferme = false;

  constructor(cheminBase: string) {
    this.base = new DatabaseSync(cheminBase);
    this.base.exec(`
      CREATE TABLE IF NOT EXISTS evenements (
        ordre_insertion INTEGER PRIMARY KEY AUTOINCREMENT,
        identifiant TEXT NOT NULL UNIQUE,
        version_schema INTEGER NOT NULL,
        type TEXT NOT NULL,
        identifiant_experience TEXT NOT NULL,
        identifiant_agent TEXT,
        numero_cycle INTEGER NOT NULL,
        sequence INTEGER NOT NULL,
        charge_utile TEXT NOT NULL,
        date_enregistrement TEXT,
        UNIQUE (identifiant_experience, sequence)
      );
      CREATE INDEX IF NOT EXISTS idx_evenements_agent
        ON evenements (identifiant_agent, ordre_insertion);
      CREATE INDEX IF NOT EXISTS idx_evenements_experience
        ON evenements (identifiant_experience, ordre_insertion);
      CREATE INDEX IF NOT EXISTS idx_evenements_cycle
        ON evenements (identifiant_experience, numero_cycle, ordre_insertion);
    `);
  }

  consulterProchaineSequence(identifiantExperience: string): number {
    this.assertOuvert();
    const ligne = this.base
      .prepare(
        `SELECT MAX(sequence) AS max_sequence
         FROM evenements
         WHERE identifiant_experience = ?`,
      )
      .get(identifiantExperience) as { max_sequence: number | bigint | null };

    if (ligne.max_sequence === null) {
      return 1;
    }
    return Number(ligne.max_sequence) + 1;
  }

  ajouter(entree: EntreeEvenement): Evenement {
    this.assertOuvert();
    const sequence = this.consulterProchaineSequence(
      entree.identifiantExperience,
    );
    const evenement = normaliserEntreeEvenement(entree, sequence);

    try {
      this.base
        .prepare(
          `INSERT INTO evenements (
            identifiant,
            version_schema,
            type,
            identifiant_experience,
            identifiant_agent,
            numero_cycle,
            sequence,
            charge_utile,
            date_enregistrement
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          evenement.identifiant,
          evenement.versionSchema,
          evenement.type,
          evenement.identifiantExperience,
          evenement.identifiantAgent ?? null,
          evenement.numeroCycle,
          evenement.sequence,
          JSON.stringify(evenement.chargeUtile),
          evenement.dateEnregistrement ?? null,
        );
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      if (message.includes("UNIQUE constraint failed")) {
        if (message.includes("identifiant_experience")) {
          throw new Error(
            `Séquence déjà attribuée pour l'expérience ${entree.identifiantExperience} : ${String(sequence)}`,
          );
        }
        throw new Error(
          `Événement déjà présent dans le registre : ${entree.identifiant}`,
        );
      }
      throw erreur;
    }

    return evenement;
  }

  lister(): readonly Evenement[] {
    this.assertOuvert();
    const lignes = this.base
      .prepare(
        `SELECT * FROM evenements ORDER BY ordre_insertion ASC`,
      )
      .all() as LigneEvenement[];
    return lignes.map(ligneVersEvenement);
  }

  listerParAgent(identifiantAgent: string): readonly Evenement[] {
    this.assertOuvert();
    const lignes = this.base
      .prepare(
        `SELECT * FROM evenements
         WHERE identifiant_agent = ?
         ORDER BY ordre_insertion ASC`,
      )
      .all(identifiantAgent) as LigneEvenement[];
    return lignes.map(ligneVersEvenement);
  }

  listerParExperience(identifiantExperience: string): readonly Evenement[] {
    this.assertOuvert();
    const lignes = this.base
      .prepare(
        `SELECT * FROM evenements
         WHERE identifiant_experience = ?
         ORDER BY sequence ASC`,
      )
      .all(identifiantExperience) as LigneEvenement[];
    return lignes.map(ligneVersEvenement);
  }

  listerParCycle(
    identifiantExperience: string,
    numeroCycle: number,
  ): readonly Evenement[] {
    this.assertOuvert();
    const lignes = this.base
      .prepare(
        `SELECT * FROM evenements
         WHERE identifiant_experience = ? AND numero_cycle = ?
         ORDER BY sequence ASC`,
      )
      .all(identifiantExperience, numeroCycle) as LigneEvenement[];
    return lignes.map(ligneVersEvenement);
  }

  taille(): number {
    this.assertOuvert();
    const ligne = this.base
      .prepare(`SELECT COUNT(*) AS total FROM evenements`)
      .get() as { total: number | bigint };
    return Number(ligne.total);
  }

  fermer(): void {
    if (!this.ferme) {
      this.base.close();
      this.ferme = true;
    }
  }

  private assertOuvert(): void {
    if (this.ferme) {
      throw new Error("Registre SQLite fermé");
    }
  }
}

function ligneVersEvenement(ligne: LigneEvenement): Evenement {
  if (!estTypeEvenementEconomique(ligne.type)) {
    throw new Error(`Type d'événement SQLite inconnu : ${ligne.type}`);
  }

  const chargeUtile = figerProfondement(
    JSON.parse(ligne.charge_utile) as Record<string, unknown>,
  );

  return figerProfondement({
    identifiant: ligne.identifiant,
    versionSchema: ligne.version_schema,
    type: ligne.type as TypeEvenementEconomique,
    identifiantExperience: ligne.identifiant_experience,
    numeroCycle: ligne.numero_cycle,
    sequence: ligne.sequence,
    chargeUtile,
    ...(ligne.identifiant_agent !== null
      ? { identifiantAgent: ligne.identifiant_agent }
      : {}),
    ...(ligne.date_enregistrement !== null
      ? { dateEnregistrement: ligne.date_enregistrement }
      : {}),
  });
}

export function creerRegistreEvenementsSqlite(
  cheminBase: string,
): RegistreEvenementsSqlite {
  return new RegistreEvenementsSqlite(cheminBase);
}
