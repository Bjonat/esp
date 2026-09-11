/**
 * Contrôle positif mécaniste : ressources → capacité reproductive v0.3.
 *
 * Couche formule (v03-A) + références d'intégration contrôleur (v03-B) :
 *   franchissement d'un multiple de coutNaissance
 *     → changement de capaciteTheorique
 *     → nombre réel de naissances différent (prouvé au contrôleur)
 *
 * Aucun score, rang, fitness, bonus génétique.
 * Indépendant du choix E0/E1/E2.
 */

import {
  calculerCapaciteReproductiveTheoriqueV03,
  calculerCoutEconomiqueNaissanceV03,
  calculerSurplusReproductifV03,
  type MicroUsdc,
} from "@esp/protocole";

export const VERSION_CONTROLE_POSITIF_REPRODUCTION_V03 =
  "controle-positif-reproduction-v03" as const;

/** Paramètres locaux explicitement diagnostiques — non figés pour calibration. */
export const PARAMETRES_DIAGNOSTIC_REPRODUCTION_V03 = {
  dotationEnfantMicroUsdc: 800_000n,
  coutReproductionMicroUsdc: 200_000n,
  reserveMinimaleParentMicroUsdc: 400_000n,
} as const;

/**
 * Preuves d'intégration contrôleur déjà présentes (v03-B) —
 * ne pas dupliquer les fixtures lourdes ici.
 */
export const REFERENCES_INTEGRATION_REPRODUCTION_V03_B = [
  "applications/controleur/tests/reproduction-economique-v03.test.ts — B — capacité 0 → aucune naissance",
  "applications/controleur/tests/reproduction-economique-v03.test.ts — C — capacité 1 → une naissance",
  "applications/controleur/tests/reproduction-economique-v03.test.ts — D/E — capacité 3 → trois naissances + consommation VEN",
  "applications/controleur/tests/reproduction-economique-v03.test.ts — F — frontière : plan 3, 3e refusée si capital juste après 2",
] as const;

export type PointControleCapaciteV03 = {
  readonly libelle: string;
  readonly facteurCoutNaissance: number;
  readonly venMicroUsdc: string;
  readonly surplusMicroUsdc: string;
  readonly capaciteTheorique: string;
};

export type ResultatControlePositifReproductionV03 = {
  readonly version: typeof VERSION_CONTROLE_POSITIF_REPRODUCTION_V03;
  readonly coutNaissanceMicroUsdc: string;
  readonly reserveMinimaleParentMicroUsdc: string;
  readonly points: readonly PointControleCapaciteV03[];
  readonly franchissement0vers1: boolean;
  readonly franchissement1vers2: boolean;
  readonly ok: boolean;
  readonly detail: string;
  readonly preuveFormule: "calculerCapaciteReproductiveTheoriqueV03";
  readonly preuveIntegrationControleur: {
    readonly chaine:
      "ressources → capaciteTheorique → naissances réelles (reproduction-economique-v03)";
    readonly referencesTests: typeof REFERENCES_INTEGRATION_REPRODUCTION_V03_B;
  };
};

function venPourFacteur(options: {
  readonly facteur: number;
  readonly coutNaissance: MicroUsdc;
  readonly reserve: MicroUsdc;
}): MicroUsdc {
  // surplus = facteur * cout  ⇒  VEN = reserve + facteur * cout
  // facteur peut être fractionnaire (0.9, 1.1, …) — conversion exacte via 10.
  const numerateur = BigInt(Math.round(options.facteur * 10));
  const surplus = (options.coutNaissance * numerateur) / 10n;
  return options.reserve + surplus;
}

function projetPoint(options: {
  readonly libelle: string;
  readonly facteur: number;
  readonly coutNaissance: MicroUsdc;
  readonly reserve: MicroUsdc;
}): PointControleCapaciteV03 {
  const ven = venPourFacteur({
    facteur: options.facteur,
    coutNaissance: options.coutNaissance,
    reserve: options.reserve,
  });
  const surplus = calculerSurplusReproductifV03({
    venMicroUsdc: ven,
    reserveMinimaleParentMicroUsdc: options.reserve,
  });
  const capacite = calculerCapaciteReproductiveTheoriqueV03({
    surplusReproductifMicroUsdc: surplus,
    coutNaissanceMicroUsdc: options.coutNaissance,
  });
  return {
    libelle: options.libelle,
    facteurCoutNaissance: options.facteur,
    venMicroUsdc: ven.toString(10),
    surplusMicroUsdc: surplus.toString(10),
    capaciteTheorique: capacite.toString(10),
  };
}

/**
 * Contrôle mécaniste 0↔1 et 1↔2 autour des multiples de coutNaissance.
 * La formule est locale ; le couplage → naissances réelles est attesté
 * par les tests contrôleur v03-B référencés.
 */
export function executerControlePositifReproductionV03(): ResultatControlePositifReproductionV03 {
  const coutNaissance = calculerCoutEconomiqueNaissanceV03({
    dotationEnfantMicroUsdc:
      PARAMETRES_DIAGNOSTIC_REPRODUCTION_V03.dotationEnfantMicroUsdc,
    coutReproductionMicroUsdc:
      PARAMETRES_DIAGNOSTIC_REPRODUCTION_V03.coutReproductionMicroUsdc,
  });
  const reserve =
    PARAMETRES_DIAGNOSTIC_REPRODUCTION_V03.reserveMinimaleParentMicroUsdc;

  const points = [
    projetPoint({
      libelle: "sous_seuil_0.9",
      facteur: 0.9,
      coutNaissance,
      reserve,
    }),
    projetPoint({
      libelle: "sur_seuil_1.1",
      facteur: 1.1,
      coutNaissance,
      reserve,
    }),
    projetPoint({
      libelle: "sous_deux_1.9",
      facteur: 1.9,
      coutNaissance,
      reserve,
    }),
    projetPoint({
      libelle: "sur_deux_2.1",
      facteur: 2.1,
      coutNaissance,
      reserve,
    }),
  ] as const;

  const c09 = BigInt(points[0].capaciteTheorique);
  const c11 = BigInt(points[1].capaciteTheorique);
  const c19 = BigInt(points[2].capaciteTheorique);
  const c21 = BigInt(points[3].capaciteTheorique);

  const franchissement0vers1 = c09 === 0n && c11 === 1n;
  const franchissement1vers2 = c19 === 1n && c21 === 2n;
  const ok = franchissement0vers1 && franchissement1vers2;

  return {
    version: VERSION_CONTROLE_POSITIF_REPRODUCTION_V03,
    coutNaissanceMicroUsdc: coutNaissance.toString(10),
    reserveMinimaleParentMicroUsdc: reserve.toString(10),
    points,
    franchissement0vers1,
    franchissement1vers2,
    ok,
    detail: ok
      ? "franchissements 0→1 et 1→2 (formule) ; naissances réelles attestées par tests contrôleur v03-B B/C/D/E/F"
      : `échec mécaniste : 0→1=${String(franchissement0vers1)} 1→2=${String(franchissement1vers2)}`,
    preuveFormule: "calculerCapaciteReproductiveTheoriqueV03",
    preuveIntegrationControleur: {
      chaine:
        "ressources → capaciteTheorique → naissances réelles (reproduction-economique-v03)",
      referencesTests: REFERENCES_INTEGRATION_REPRODUCTION_V03_B,
    },
  };
}
