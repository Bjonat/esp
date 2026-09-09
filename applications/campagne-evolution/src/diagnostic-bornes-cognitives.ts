/**
 * Classification des bornes cognitives actives (dry-run, sans effets de bord).
 */

import type { ChoixCognitifAgent, EtatEconomiqueAgent, MicroUsdc, ObservationOpportunite } from "@esp/protocole";
import { calculerValeurEconomiqueNette } from "@esp/protocole";
import type { ConfigurationPolitiqueBudgetCognitif } from "@esp/moteur-agent";
import { calculerEnjeuOpportunite } from "@esp/moteur-agent";

export type IdentifiantBorneCognitive =
  | "part_ven"
  | "plafond_cognitif"
  | "plafond_xway"
  | "ven"
  | "aucune";

export type ClassificationBornesCognitives = {
  readonly enjeuMicroUsdc: string;
  readonly venPositiveMicroUsdc: string;
  readonly partVenMicroUsdc: string;
  readonly plafondCognitifMicroUsdc: string;
  readonly plafondXwayMicroUsdc: string | null;
  readonly limiteFinaleMicroUsdc: string;
  readonly utiliserInference: boolean;
  readonly motif: string;
  /** Borne unique, ou "egalite" si plusieurs co-limitantes. */
  readonly borneDominante: IdentifiantBorneCognitive | "egalite";
  readonly bornesCoLimitantes: readonly IdentifiantBorneCognitive[];
};

/**
 * Reproduit la logique de `deciderBudgetCognitif` pour identifier la/les borne(s).
 */
export function classifierBornesCognitives(options: {
  readonly etatEconomique: EtatEconomiqueAgent;
  readonly observation: ObservationOpportunite;
  readonly configuration: ConfigurationPolitiqueBudgetCognitif;
  readonly plafondXwayMicroUsdc?: MicroUsdc;
  readonly choix?: ChoixCognitifAgent;
}): ClassificationBornesCognitives {
  const ven = calculerValeurEconomiqueNette(options.etatEconomique);
  const venPositive = ven > 0n ? ven : 0n;
  const enjeu = calculerEnjeuOpportunite(options.observation);
  const partVen =
    (venPositive * BigInt(options.configuration.partMaxVenParCycleBps)) /
    10_000n;
  const plafond = options.configuration.plafondCognitifMicroUsdc;
  const xway = options.plafondXwayMicroUsdc;

  const candidats: { id: IdentifiantBorneCognitive; valeur: bigint }[] = [
    { id: "part_ven", valeur: partVen },
    { id: "plafond_cognitif", valeur: plafond },
    { id: "ven", valeur: venPositive },
  ];
  if (xway !== undefined) {
    candidats.push({ id: "plafond_xway", valeur: xway });
  }

  let limite = candidats[0]!.valeur;
  for (const c of candidats) {
    if (c.valeur < limite) {
      limite = c.valeur;
    }
  }

  const coLimitantes = candidats
    .filter((c) => c.valeur === limite)
    .map((c) => c.id);

  let borneDominante: IdentifiantBorneCognitive | "egalite";
  if (limite <= 0n) {
    borneDominante = "aucune";
  } else if (coLimitantes.length > 1) {
    borneDominante = "egalite";
  } else {
    borneDominante = coLimitantes[0] ?? "aucune";
  }

  const choix = options.choix;
  return {
    enjeuMicroUsdc: enjeu.toString(10),
    venPositiveMicroUsdc: venPositive.toString(10),
    partVenMicroUsdc: partVen.toString(10),
    plafondCognitifMicroUsdc: plafond.toString(10),
    plafondXwayMicroUsdc: xway !== undefined ? xway.toString(10) : null,
    limiteFinaleMicroUsdc: (choix?.limiteDepenseAutoriseeMicroUsdc ?? limite).toString(
      10,
    ),
    utiliserInference: choix?.utiliserInference ?? limite > 0n,
    motif: choix?.motif ?? (limite <= 0n ? "budget_cognitif_nul" : "enjeu_autorise_inference"),
    borneDominante: choix !== undefined && !choix.utiliserInference
      ? choix.motif.includes("seuil") || choix.motif.includes("survie")
        ? "aucune"
        : borneDominante
      : borneDominante,
    bornesCoLimitantes:
      borneDominante === "aucune"
        ? (["aucune"] as const)
        : borneDominante === "egalite"
          ? coLimitantes
          : [borneDominante],
  };
}
