import type { MicroUsdc } from "./monnaie.js";
import { assertMicroUsdcNonNegatif, parserMicroUsdc } from "./monnaie.js";
import { ecrireMontantChargeUtile } from "./evenements-economiques.js";

/**
 * Origine métier d'un débit DEPENSE_COMPUTE.
 * Métadonnée causale — ne crée pas de second débit.
 */
export const ORIGINES_DEPENSE_COMPUTE = [
  "xway_inference",
  "simulation_developpement",
  "autre_compute",
] as const;

export type OrigineDepenseCompute =
  (typeof ORIGINES_DEPENSE_COMPUTE)[number];

/** Attribution causale d'une consommation Xway vers un débit économique. */
export type AttributionDepenseComputeXway = {
  readonly identifiantDemande: string;
  readonly montantMicroUsdc: string;
};

/**
 * Charge utile DEPENSE_COMPUTE étendue.
 * Les champs provenance sont optionnels : absents = événement legacy.
 */
export type ChargeDepenseCompute = {
  readonly montantMicroUsdc: string;
  readonly origine?: OrigineDepenseCompute;
  readonly attributionsXway?: readonly AttributionDepenseComputeXway[];
};

export class ProvenanceDepenseComputeErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvenanceDepenseComputeErreur";
  }
}

export function estOrigineDepenseCompute(
  valeur: unknown,
): valeur is OrigineDepenseCompute {
  return (
    typeof valeur === "string" &&
    (ORIGINES_DEPENSE_COMPUTE as readonly string[]).includes(valeur)
  );
}

/**
 * Construit la charge utile d'un DEPENSE_COMPUTE avec provenance.
 * Invariant : si attributionsXway présentes, somme === montant.
 */
export function construireChargeDepenseCompute(options: {
  readonly montantMicroUsdc: MicroUsdc;
  readonly origine: OrigineDepenseCompute;
  readonly attributionsXway?: readonly {
    readonly identifiantDemande: string;
    readonly montantMicroUsdc: MicroUsdc;
  }[];
}): ChargeDepenseCompute {
  assertMicroUsdcNonNegatif(options.montantMicroUsdc, "montantMicroUsdc");

  if (options.origine === "xway_inference") {
    const attributions = options.attributionsXway ?? [];
    if (attributions.length === 0) {
      throw new ProvenanceDepenseComputeErreur(
        "origine xway_inference exige au moins une attribution",
      );
    }
    const vues = new Set<string>();
    let somme = 0n;
    const serialisees: AttributionDepenseComputeXway[] = [];
    for (const a of attributions) {
      if (a.identifiantDemande.trim().length === 0) {
        throw new ProvenanceDepenseComputeErreur(
          "identifiantDemande d'attribution vide",
        );
      }
      if (vues.has(a.identifiantDemande)) {
        throw new ProvenanceDepenseComputeErreur(
          `identifiantDemande dupliqué dans le même débit : ${a.identifiantDemande}`,
        );
      }
      vues.add(a.identifiantDemande);
      assertMicroUsdcNonNegatif(a.montantMicroUsdc, "montant attribution");
      if (a.montantMicroUsdc <= 0n) {
        throw new ProvenanceDepenseComputeErreur(
          `attribution nulle interdite pour ${a.identifiantDemande}`,
        );
      }
      somme += a.montantMicroUsdc;
      serialisees.push({
        identifiantDemande: a.identifiantDemande,
        montantMicroUsdc: ecrireMontantChargeUtile(a.montantMicroUsdc),
      });
    }
    if (somme !== options.montantMicroUsdc) {
      throw new ProvenanceDepenseComputeErreur(
        `somme(attributions)=${somme.toString(10)} ≠ montant DEPENSE_COMPUTE=${options.montantMicroUsdc.toString(10)}`,
      );
    }
    return {
      montantMicroUsdc: ecrireMontantChargeUtile(options.montantMicroUsdc),
      origine: "xway_inference",
      attributionsXway: serialisees,
    };
  }

  if (
    options.attributionsXway !== undefined &&
    options.attributionsXway.length > 0
  ) {
    throw new ProvenanceDepenseComputeErreur(
      `attributionsXway interdites pour origine=${options.origine}`,
    );
  }

  return {
    montantMicroUsdc: ecrireMontantChargeUtile(options.montantMicroUsdc),
    origine: options.origine,
  };
}

/** Lit les attributions Xway d'une charge (vide si legacy / non-xway). */
export function lireAttributionsXwayDepuisCharge(
  chargeUtile: Readonly<Record<string, unknown>> | undefined,
): readonly AttributionDepenseComputeXway[] {
  if (chargeUtile === undefined) {
    return [];
  }
  const origine = chargeUtile.origine;
  if (origine !== "xway_inference") {
    return [];
  }
  const brut = chargeUtile.attributionsXway;
  if (!Array.isArray(brut)) {
    return [];
  }
  const resultat: AttributionDepenseComputeXway[] = [];
  for (const item of brut) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const objet = item as Record<string, unknown>;
    if (
      typeof objet.identifiantDemande !== "string" ||
      typeof objet.montantMicroUsdc !== "string"
    ) {
      continue;
    }
    resultat.push({
      identifiantDemande: objet.identifiantDemande,
      montantMicroUsdc: objet.montantMicroUsdc,
    });
  }
  return resultat;
}

export type AttributionHistoriqueXway = {
  readonly identifiantDemande: string;
  readonly montantMicroUsdc: MicroUsdc;
  readonly identifiantEvenementDepense: string;
  readonly numeroCycle: number;
};

/**
 * Collecte toutes les attributions Xway historiques d'une expérience.
 * Les DEPENSE_COMPUTE legacy (sans provenance) ne produisent aucune attribution.
 */
export function collecterAttributionsXwayHistoriques(
  evenements: readonly {
    readonly identifiant: string;
    readonly type: string;
    readonly numeroCycle: number;
    readonly chargeUtile?: Readonly<Record<string, unknown>>;
  }[],
): readonly AttributionHistoriqueXway[] {
  const resultat: AttributionHistoriqueXway[] = [];
  for (const evenement of evenements) {
    if (evenement.type !== "DEPENSE_COMPUTE") {
      continue;
    }
    for (const attribution of lireAttributionsXwayDepuisCharge(
      evenement.chargeUtile,
    )) {
      resultat.push({
        identifiantDemande: attribution.identifiantDemande,
        montantMicroUsdc: parserMicroUsdc(attribution.montantMicroUsdc),
        identifiantEvenementDepense: evenement.identifiant,
        numeroCycle: evenement.numeroCycle,
      });
    }
  }
  return resultat;
}

export function trouverAttributionsPourDemande(
  evenements: readonly {
    readonly identifiant: string;
    readonly type: string;
    readonly numeroCycle: number;
    readonly chargeUtile?: Readonly<Record<string, unknown>>;
  }[],
  identifiantDemande: string,
): readonly AttributionHistoriqueXway[] {
  return collecterAttributionsXwayHistoriques(evenements).filter(
    (a) => a.identifiantDemande === identifiantDemande,
  );
}

/**
 * Refuse toute réattribution d'un identifiantDemande déjà présent
 * dans l'historique économique de l'expérience.
 */
export function assertDemandesXwayNonDejaAttribuees(
  evenements: readonly {
    readonly identifiant: string;
    readonly type: string;
    readonly numeroCycle: number;
    readonly chargeUtile?: Readonly<Record<string, unknown>>;
  }[],
  attributions: readonly {
    readonly identifiantDemande: string;
  }[],
): void {
  for (const attribution of attributions) {
    const existantes = trouverAttributionsPourDemande(
      evenements,
      attribution.identifiantDemande,
    );
    if (existantes.length > 0) {
      throw new ProvenanceDepenseComputeErreur(
        `identifiantDemande déjà attribué économiquement : ${attribution.identifiantDemande}`,
      );
    }
  }
}
