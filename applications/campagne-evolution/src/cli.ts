/**
 * CLI campagne évolution — fournisseur simulé uniquement.
 *
 * Usage :
 *   pnpm experience:evolution -- --protocole experiences/protocoles/evolution-pilote-v01.json
 *   pnpm experience:evolution -- --protocole ... --concurrency 2 --repertoire-resultats /tmp/out
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FournisseurMetaCodeGit } from "./meta-code.js";
import { chargerProtocoleCampagneEvolutionDepuisObjet } from "./protocole-versionne.js";
import { executerCampagneEvolution } from "./runner-campagne.js";

export type ArgumentsCliEvolution = {
  readonly cheminProtocole: string;
  readonly concurrence: number;
  readonly repertoireResultats?: string;
};

export function parserArgumentsCli(
  argv: readonly string[],
): ArgumentsCliEvolution {
  let cheminProtocole: string | undefined;
  let concurrence = 1;
  let repertoireResultats: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--protocole") {
      cheminProtocole = argv[++i];
    } else if (arg === "--concurrency" || arg === "--concurrence") {
      concurrence = Number(argv[++i]);
    } else if (arg === "--repertoire-resultats") {
      repertoireResultats = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: experience:evolution --protocole <path> [--concurrency N] [--repertoire-resultats path]\n",
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

  return {
    cheminProtocole,
    concurrence,
    ...(repertoireResultats !== undefined ? { repertoireResultats } : {}),
  };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const args = parserArgumentsCli(argv);
  const brut = JSON.parse(
    readFileSync(resolve(args.cheminProtocole), "utf8"),
  ) as unknown;
  const protocole = chargerProtocoleCampagneEvolutionDepuisObjet(brut);

  const resultat = await executerCampagneEvolution({
    protocole,
    concurrence: args.concurrence,
    fournisseurMetaCode: new FournisseurMetaCodeGit(),
    ...(args.repertoireResultats !== undefined
      ? { repertoireResultats: resolve(args.repertoireResultats) }
      : {}),
  });

  process.stdout.write(
    JSON.stringify(
      {
        identifiantBatch: resultat.manifeste.identifiantBatch,
        repertoireBatch: resultat.repertoireBatch,
        marqueurs: resultat.manifeste.marqueurs,
        nombreRuns: resultat.resumes.length,
        versionProtocole: protocole.version,
      },
      null,
      2,
    ) + "\n",
  );
}

const estEntreePrincipale =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("cli.ts") ||
    process.argv[1].endsWith("cli.js") ||
    process.argv[1].includes("campagne-evolution"));

if (estEntreePrincipale) {
  main().catch((erreur: unknown) => {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
