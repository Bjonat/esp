import type {
  ChoixCognitifAgent,
  EtatEconomiqueAgent,
  EtatSurvie,
  MicroUsdc,
  ObservationOpportunite,
} from "@esp/protocole";
import { calculerValeurEconomiqueNette } from "@esp/protocole";

/**
 * ============================================================================
 * POLITIQUE DE BUDGET COGNITIF AGENT v0.1
 * ============================================================================
 * Hors protocole économique fondamental.
 * Décide SANS LLM s'il faut payer une inférence (évite la récursion).
 * VALEURS INJECTÉES — non canoniques.
 */

export type ComportementSansInference = "attendre" | "agir_si_favorable";

export type ConfigurationPolitiqueBudgetCognitif = {
  readonly identifiant: "politique-budget-cognitif-agent";
  readonly version: string;
  /** Enjeu minimum (max gain/perte) pour autoriser une inférence. */
  readonly seuilEnjeuPourInferenceMicroUsdc: MicroUsdc;
  /** Part max de la VEN autorisée pour le compute ce cycle (bps). */
  readonly partMaxVenParCycleBps: number;
  /** Plafond absolu de dépense cognitive par cycle. */
  readonly plafondCognitifMicroUsdc: MicroUsdc;
  readonly modeleLogique: string;
  readonly comportementSansInference: ComportementSansInference;
  /**
   * Si true, refuse l'inférence lorsque l'état de survie est critique/dormant.
   */
  readonly refuserSiCritiqueOuDormant: boolean;
};

export type ConfigurationPolitiqueBudgetCognitifJson = {
  readonly identifiant: "politique-budget-cognitif-agent";
  readonly version: string;
  readonly seuilEnjeuPourInferenceMicroUsdc: string;
  readonly partMaxVenParCycleBps: number;
  readonly plafondCognitifMicroUsdc: string;
  readonly modeleLogique: string;
  readonly comportementSansInference: ComportementSansInference;
  readonly refuserSiCritiqueOuDormant?: boolean;
};

export type EntreePolitiqueBudgetCognitif = {
  readonly etatEconomique: EtatEconomiqueAgent;
  readonly runway: number;
  readonly observation: ObservationOpportunite;
  readonly configuration: ConfigurationPolitiqueBudgetCognitif;
  /** Plafond Xway expérience (si actif) — borné avec la politique. */
  readonly plafondXwayMicroUsdc?: MicroUsdc;
};

/**
 * Calcule l'enjeu observable de l'opportunité (max des montants en jeu).
 */
export function calculerEnjeuOpportunite(
  observation: ObservationOpportunite,
): MicroUsdc {
  const gain = observation.gainSiSuccesMicroUsdc;
  const perte = observation.perteSiEchecMicroUsdc;
  return gain > perte ? gain : perte;
}

function etatCritiqueOuDormant(etat: EtatSurvie): boolean {
  return etat === "critique" || etat === "dormant" || etat === "mort";
}

/**
 * Décide s'il faut appeler l'IA — déterministe, sans récursion LLM.
 */
export function deciderBudgetCognitif(
  entree: EntreePolitiqueBudgetCognitif,
): ChoixCognitifAgent {
  const { configuration, observation, etatEconomique } = entree;
  const ven = calculerValeurEconomiqueNette(etatEconomique);
  const enjeu = calculerEnjeuOpportunite(observation);

  if (configuration.refuserSiCritiqueOuDormant && etatCritiqueOuDormant(etatEconomique.etatSurvie)) {
    return {
      utiliserInference: false,
      modeleLogique: null,
      limiteDepenseAutoriseeMicroUsdc: 0n,
      motif: `survie_${etatEconomique.etatSurvie}_sans_inference`,
    };
  }

  if (enjeu < configuration.seuilEnjeuPourInferenceMicroUsdc) {
    return {
      utiliserInference: false,
      modeleLogique: null,
      limiteDepenseAutoriseeMicroUsdc: 0n,
      motif: "enjeu_sous_seuil",
    };
  }

  const venPositive = ven > 0n ? ven : 0n;
  const partVen =
    (venPositive * BigInt(configuration.partMaxVenParCycleBps)) / 10_000n;
  let limite = partVen;
  if (limite > configuration.plafondCognitifMicroUsdc) {
    limite = configuration.plafondCognitifMicroUsdc;
  }
  if (
    entree.plafondXwayMicroUsdc !== undefined &&
    limite > entree.plafondXwayMicroUsdc
  ) {
    limite = entree.plafondXwayMicroUsdc;
  }
  if (limite > venPositive) {
    limite = venPositive;
  }

  if (limite <= 0n) {
    return {
      utiliserInference: false,
      modeleLogique: null,
      limiteDepenseAutoriseeMicroUsdc: 0n,
      motif: "budget_cognitif_nul",
    };
  }

  return {
    utiliserInference: true,
    modeleLogique: configuration.modeleLogique,
    limiteDepenseAutoriseeMicroUsdc: limite,
    motif: "enjeu_autorise_inference",
  };
}

/**
 * Décision locale sans inférence — aucun coût cognitif.
 */
export function deciderSansInference(options: {
  readonly observation: ObservationOpportunite;
  readonly comportement: ComportementSansInference;
}): { action: "attendre" | "agir"; resume: string; confianceBps: number } {
  if (options.comportement === "attendre") {
    return {
      action: "attendre",
      resume: "Décision locale sans inférence : attendre",
      confianceBps: 10_000,
    };
  }

  // agir_si_favorable : EV approximative déterministe en entiers
  // EV ~ gain * p - perte * (1-p) - frais (en micro-USDC, p en bps)
  const p = BigInt(options.observation.probabiliteSuccesBps);
  const gain = options.observation.gainSiSuccesMicroUsdc;
  const perte = options.observation.perteSiEchecMicroUsdc;
  const frais = options.observation.fraisActionMicroUsdc;
  const esperance =
    (gain * p - perte * (10_000n - p)) / 10_000n - frais;

  if (esperance > 0n) {
    return {
      action: "agir",
      resume: "Décision locale sans inférence : agir (EV positive)",
      confianceBps: Number(p > 10_000n ? 10_000n : p),
    };
  }
  return {
    action: "attendre",
    resume: "Décision locale sans inférence : attendre (EV non positive)",
    confianceBps: 10_000 - options.observation.probabiliteSuccesBps,
  };
}

export function parserConfigurationPolitiqueBudgetCognitif(
  brut: ConfigurationPolitiqueBudgetCognitifJson,
): ConfigurationPolitiqueBudgetCognitif {
  if (brut.identifiant !== "politique-budget-cognitif-agent") {
    throw new Error(`Politique cognitive inconnue : ${brut.identifiant}`);
  }
  if (
    !Number.isInteger(brut.partMaxVenParCycleBps) ||
    brut.partMaxVenParCycleBps < 0 ||
    brut.partMaxVenParCycleBps > 10_000
  ) {
    throw new Error("partMaxVenParCycleBps invalide");
  }
  if (
    brut.comportementSansInference !== "attendre" &&
    brut.comportementSansInference !== "agir_si_favorable"
  ) {
    throw new Error("comportementSansInference invalide");
  }
  return {
    identifiant: brut.identifiant,
    version: brut.version,
    seuilEnjeuPourInferenceMicroUsdc: BigInt(
      brut.seuilEnjeuPourInferenceMicroUsdc,
    ),
    partMaxVenParCycleBps: brut.partMaxVenParCycleBps,
    plafondCognitifMicroUsdc: BigInt(brut.plafondCognitifMicroUsdc),
    modeleLogique: brut.modeleLogique,
    comportementSansInference: brut.comportementSansInference,
    refuserSiCritiqueOuDormant: brut.refuserSiCritiqueOuDormant ?? true,
  };
}

export function serialiserConfigurationPolitiqueBudgetCognitif(
  configuration: ConfigurationPolitiqueBudgetCognitif,
): ConfigurationPolitiqueBudgetCognitifJson {
  return {
    identifiant: configuration.identifiant,
    version: configuration.version,
    seuilEnjeuPourInferenceMicroUsdc:
      configuration.seuilEnjeuPourInferenceMicroUsdc.toString(10),
    partMaxVenParCycleBps: configuration.partMaxVenParCycleBps,
    plafondCognitifMicroUsdc:
      configuration.plafondCognitifMicroUsdc.toString(10),
    modeleLogique: configuration.modeleLogique,
    comportementSansInference: configuration.comportementSansInference,
    refuserSiCritiqueOuDormant: configuration.refuserSiCritiqueOuDormant,
  };
}
