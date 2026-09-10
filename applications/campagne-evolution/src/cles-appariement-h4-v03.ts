/**
 * Clés d'appariement C/D futur (H4) — extraction / structuration uniquement.
 *
 * Ce module PRÉPARE des données appariables. Il n'effectue PAS l'analyse H4.
 *
 * INTERDIT ici :
 * - classer les mutations ;
 * - sélectionner un variant « prometteur » ;
 * - calculer un score H4 ;
 * - déclarer un avantage adaptatif ;
 * - choisir une direction de mutation ;
 * - filtrer selon performance positive ;
 * - conclure sur D/C.
 */

import type { EvenementEsp } from "@esp/protocole";

export type CleAppariementH4AgentV03 = {
  readonly seed: number;
  readonly identifiantAgent: string;
  readonly identifiantParent: string | null;
  readonly cycleNaissance: number | null;
  readonly generation: number;
  readonly empreinteGenotype: string | null;
  readonly empreinteGenotypeParent: string | null;
  readonly mutations: readonly {
    readonly cycleMutation: number;
    readonly charge: Readonly<Record<string, unknown>>;
  }[];
  readonly enfantsDirects: readonly string[];
  /** Compteur descriptif reconstructible — pas un score. */
  readonly descendantsCumules: number;
};

/** @deprecated alias → CleAppariementH4AgentV03 */
export type EntreeMatchingH4AgentV03 = CleAppariementH4AgentV03;

/**
 * Extrait depuis le registre les clés nécessaires au futur appariement H4.
 * Aucune sélection, aucun ranking, aucun verdict.
 */
export function extraireClesAppariementH4V03(options: {
  readonly seed: number;
  readonly evenements: readonly EvenementEsp[];
  readonly agents: readonly {
    readonly identifiant: string;
    readonly identifiantParent?: string | null;
    readonly cycleNaissance?: number | null;
    readonly generation: number;
    readonly empreinteConfiguration?: string | null;
    readonly identifiantsEnfants?: readonly string[];
  }[];
}): readonly CleAppariementH4AgentV03[] {
  const mutationsParEnfant = new Map<
    string,
    { cycleMutation: number; charge: Record<string, unknown> }[]
  >();

  for (const e of options.evenements) {
    if (e.type !== "MUTATION_APPLIQUEE") {
      continue;
    }
    const charge = (e.chargeUtile ?? {}) as Record<string, unknown>;
    const enfant =
      typeof charge.identifiantEnfant === "string"
        ? charge.identifiantEnfant
        : e.identifiantAgent;
    if (enfant === undefined || enfant === null) {
      continue;
    }
    const liste = mutationsParEnfant.get(enfant) ?? [];
    liste.push({
      cycleMutation: e.numeroCycle,
      charge: { ...charge },
    });
    mutationsParEnfant.set(enfant, liste);
  }

  const parentParEnfant = new Map<string, string>();
  const empreinteParAgent = new Map<string, string>();
  for (const a of options.agents) {
    if (a.empreinteConfiguration !== undefined && a.empreinteConfiguration !== null) {
      empreinteParAgent.set(a.identifiant, a.empreinteConfiguration);
    }
  }
  for (const e of options.evenements) {
    if (e.type !== "AGENT_CREE") {
      continue;
    }
    const charge = e.chargeUtile ?? {};
    const id =
      typeof charge.identifiantAgent === "string"
        ? charge.identifiantAgent
        : e.identifiantAgent;
    const parent =
      typeof charge.identifiantParent === "string"
        ? charge.identifiantParent
        : null;
    if (id !== undefined && parent !== null) {
      parentParEnfant.set(id, parent);
    }
  }

  const enfantsDe = new Map<string, string[]>();
  for (const a of options.agents) {
    const parent =
      a.identifiantParent ?? parentParEnfant.get(a.identifiant) ?? null;
    if (parent !== null) {
      const liste = enfantsDe.get(parent) ?? [];
      liste.push(a.identifiant);
      enfantsDe.set(parent, liste);
    }
    if (a.identifiantsEnfants !== undefined) {
      for (const enf of a.identifiantsEnfants) {
        const liste = enfantsDe.get(a.identifiant) ?? [];
        if (!liste.includes(enf)) {
          liste.push(enf);
        }
        enfantsDe.set(a.identifiant, liste);
      }
    }
  }

  function compterDescendants(racine: string): number {
    const vus = new Set<string>();
    const pile = [...(enfantsDe.get(racine) ?? [])];
    while (pile.length > 0) {
      const id = pile.pop()!;
      if (vus.has(id)) {
        continue;
      }
      vus.add(id);
      for (const e of enfantsDe.get(id) ?? []) {
        pile.push(e);
      }
    }
    return vus.size;
  }

  return options.agents.map((a) => {
    const parent =
      a.identifiantParent ?? parentParEnfant.get(a.identifiant) ?? null;
    return {
      seed: options.seed,
      identifiantAgent: a.identifiant,
      identifiantParent: parent,
      cycleNaissance: a.cycleNaissance ?? null,
      generation: a.generation,
      empreinteGenotype: a.empreinteConfiguration ?? null,
      empreinteGenotypeParent:
        parent !== null ? (empreinteParAgent.get(parent) ?? null) : null,
      mutations: mutationsParEnfant.get(a.identifiant) ?? [],
      enfantsDirects: enfantsDe.get(a.identifiant) ?? [],
      descendantsCumules: compterDescendants(a.identifiant),
    };
  });
}

/** @deprecated alias → extraireClesAppariementH4V03 */
export const extraireEntreesMatchingH4V03 = extraireClesAppariementH4V03;
