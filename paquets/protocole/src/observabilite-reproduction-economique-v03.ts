/**
 * Observabilité scientifique — reproduction économique v0.3 (v03-C).
 *
 * Projections pures depuis le registre. Aucune entrée décisionnelle.
 * Aucun score, rang, percentile, ni « meilleur agent ».
 */

import { lireMontantChargeUtile } from "./evenements-economiques.js";
import type {
  ArretFenetreParentReproductionEconomiqueV03,
  ChargeReproductionEconomiqueV03CyclePlanifiee,
  MotifArretFenetreReproductionEconomiqueV03,
  ObservabiliteParentReproductionEconomiqueV03,
  ObservabiliteTentativeReproductionEconomiqueV03,
} from "./evenements-reproduction-economique-v03.js";
import { CLES_OBSERVABILITE_CHARGE_V03 } from "./evenements-reproduction-economique-v03.js";
import { MECANISME_REPRODUCTION_ECONOMIQUE_V03 } from "./mecanisme-reproduction-autonome.js";
import type { MicroUsdc } from "./monnaie.js";
import { parserMicroUsdc } from "./monnaie.js";

export const VERSION_OBSERVABILITE_REPRODUCTION_ECONOMIQUE_V03 =
  "observabilite-reproduction-economique-v03" as const;

export type EvenementPourObservabiliteV03 = {
  readonly type: string;
  readonly identifiant: string;
  readonly identifiantAgent?: string;
  readonly numeroCycle: number;
  readonly sequence: number;
  readonly chargeUtile?: Readonly<Record<string, unknown>>;
};

/**
 * Whitelist explicite — événements inclus dans
 * `resultatEconomiqueHorsReproductionV03`.
 *
 * Comptabilité d'**engagement** (pas un flux de trésorerie) :
 * le coût économique naît au moment où l'obligation devient due.
 *
 * `LOYER_INFRASTRUCTURE_DU` / `REDEVANCE_PROPRIETAIRE_DUE` portent toujours
 * `montantMicroUsdc` dans le moteur (`cycle-economique.ts`).
 */
export const EVENEMENTS_INCLUS_RESULTAT_HORS_REPRODUCTION_V03 = [
  "REVENU_ACTIVITE",
  "PERTE_ACTIVITE",
  "DEPENSE_COMPUTE",
  "DEPENSE_DONNEES",
  "FRAIS_EXECUTION",
  "LOYER_INFRASTRUCTURE_DU",
  "REDEVANCE_PROPRIETAIRE_DUE",
] as const;

/**
 * Événements explicitement exclus — règlements, capitalisation, reproduction,
 * transferts internes. Compter DUE + PAYE/DETTE_REGLEE produirait un double
 * comptage ; compter seulement PAYE/DETTE_REGLEE biaiserait la fenêtre E.
 */
export const EVENEMENTS_EXCLUS_RESULTAT_HORS_REPRODUCTION_V03 = [
  "LOYER_INFRASTRUCTURE_PAYE",
  "REDEVANCE_PROPRIETAIRE_PAYEE",
  "DETTE_CREEE",
  "DETTE_REGLEE",
  "CAPITAL_INITIAL_ATTRIBUE",
  "TRANSFERT_INTERNE",
  "COUT_REPRODUCTION_PAYE",
  "DEPENSE_INFRASTRUCTURE_PROPRIETAIRE",
  "AGENT_CREE",
  "CYCLE_DEMARRE",
  "CYCLE_TERMINE",
] as const;

/**
 * Convention de plage : inclusive des deux bornes.
 * `[cycleDebut, cycleFin]` — un événement au cycle `c` est inclus ssi
 * `cycleDebut ≤ c ≤ cycleFin`.
 */
export type FenetreCyclesObservabiliteV03 = {
  readonly cycleDebut: number;
  readonly cycleFin: number;
};

export type RatioEntierObservabiliteV03 = {
  readonly numerateur: number | bigint;
  readonly denominateur: number | bigint;
};

/**
 * Agrégat cycle — décomptes en `number`, sommes de capacités en `bigint`.
 * Aucun score synthétique.
 */
export type ObservabiliteReproductionEconomiqueV03Cycle = {
  readonly version: typeof VERSION_OBSERVABILITE_REPRODUCTION_ECONOMIQUE_V03;
  readonly numeroCycle: number;
  readonly nombreParentsCandidats: number;
  readonly fenetresOuvertes: number;
  readonly fenetresFermeesParMotif: Readonly<Record<string, number>>;
  /** Somme des capacités économiques brutes de tous les candidats (bigint). */
  readonly capaciteEconomiqueTheoriqueTotale: bigint;
  /** Somme des capacités après limite enfants de tous les candidats (bigint). */
  readonly capaciteApresLimiteEnfantsTotale: bigint;
  /**
   * Σ capaciteTheorique des parents structurellement éligibles hors garde-fous
   * de sécurité (actif, vivant, état, pas né ce cycle, cooldown). Inclut ceux
   * ensuite tronqués par max-enfants / population / plafond cycle.
   */
  readonly capaciteEconomiqueTheoriqueEligible: bigint;
  /**
   * Σ max(0, capaciteTheorique − capaciteBorneeParEnfants) sur les parents
   * éligibles — y compris troncature partielle à fenêtre ouverte.
   */
  readonly capaciteBloqueeParPlafondParent: bigint;
  /** capaciteEconomiqueTheoriqueEligible − capaciteBloqueeParPlafondParent */
  readonly capaciteDisponibleApresPlafondParent: bigint;
  /**
   * max(0, capaciteDisponibleApresPlafondParent − tentativesPlanifiees)
   * — troncature par plafonds globaux / round-robin / plan.
   */
  readonly capaciteBloqueeParPlafondsGlobaux: bigint;
  readonly tentativesPlanifiees: number;
  /** Tentatives avec modeEvaluation === "evaluee". */
  readonly tentativesReellementEvaluees: number;
  readonly tentativesAutorisees: number;
  readonly tentativesRefusees: number;
  readonly naissancesRealisees: number;
  readonly refusParMotif: Readonly<Record<string, number>>;
  readonly refusEvaluesParMotif: Readonly<Record<string, number>>;
  readonly refusPropagationParMotif: Readonly<Record<string, number>>;
  readonly placesGlobalesPlanifiees: number;
  /**
   * Alias historique = placesGlobalesNonUtilisees
   * (placesGlobalesPlanifiees − naissancesRealisees).
   */
  readonly placesPlanifieesNonUtilisees: number;
  /** placesGlobalesPlanifiees − naissancesRealisees */
  readonly placesGlobalesNonUtilisees: number;
  /** max(0, placesGlobalesPlanifiees − tentativesPlanifiees) */
  readonly placesNonDemandeesParLePlan: number;
  /** tentativesPlanifiees − naissancesRealisees */
  readonly tentativesPlanifieesNonRealisees: number;
  /**
   * Dénominateur recommandé du futur critère de pression des garde-fous :
   * alias de `capaciteEconomiqueTheoriqueEligible`.
   */
  readonly opportunitesEconomiquementFinancables: bigint;
  /**
   * capaciteBloqueeParPlafondParent + capaciteBloqueeParPlafondsGlobaux
   * (sans double comptage d'une même opportunité).
   */
  readonly opportunitesBloqueesParGardeFous: bigint;
  readonly fermeturesNombreEnfantsMax: number;
  readonly fermeturesPopulationMaximale: number;
  readonly fermeturesReproductionsCycleMax: number;
  readonly arretsFenetreParParent: readonly ArretFenetreParentReproductionEconomiqueV03[];
  readonly parents: readonly ObservabiliteParentReproductionEconomiqueV03[];
};

/**
 * Parent structurellement éligible hors garde-fous de sécurité
 * (max-enfants / population / plafond cycle mesurés à part).
 */
export function estParentEligibleStructurelHorsGardeFousV03(
  fenetre: ObservabiliteParentReproductionEconomiqueV03["fenetre"],
): boolean {
  if (fenetre.ouverte) {
    return true;
  }
  return (
    fenetre.motif === "nombre_enfants_max" ||
    fenetre.motif === "population_maximale" ||
    fenetre.motif === "reproductions_cycle_max"
  );
}

function lireBigintDecimal(valeur: unknown, repli: bigint = 0n): bigint {
  if (typeof valeur === "string" && /^-?\d+$/.test(valeur)) {
    return BigInt(valeur);
  }
  if (typeof valeur === "bigint") {
    return valeur;
  }
  if (typeof valeur === "number" && Number.isInteger(valeur)) {
    return BigInt(valeur);
  }
  return repli;
}

function lireMontantSafe(
  charge: Readonly<Record<string, unknown>> | undefined,
  cle: string,
): MicroUsdc {
  if (charge === undefined || charge[cle] === undefined) {
    return 0n;
  }
  try {
    return lireMontantChargeUtile(charge as Record<string, unknown>, cle);
  } catch {
    return 0n;
  }
}

function parserPlanDepuisCharge(
  charge: Readonly<Record<string, unknown>>,
): ChargeReproductionEconomiqueV03CyclePlanifiee | undefined {
  if (
    charge.versionMecanisme !== MECANISME_REPRODUCTION_ECONOMIQUE_V03 ||
    typeof charge.numeroCycle !== "number" ||
    typeof charge.versionPolitique !== "string" ||
    typeof charge.populationAuSnapshot !== "number" ||
    typeof charge.reproductionsDejaAuSnapshot !== "number" ||
    typeof charge.placesGlobalesPlanifiees !== "number" ||
    !Array.isArray(charge.identifiantsParentsOrdonnes) ||
    !Array.isArray(charge.parents) ||
    !Array.isArray(charge.tentatives)
  ) {
    return undefined;
  }
  const base: ChargeReproductionEconomiqueV03CyclePlanifiee = {
    versionMecanisme: MECANISME_REPRODUCTION_ECONOMIQUE_V03,
    numeroCycle: charge.numeroCycle,
    versionPolitique: charge.versionPolitique,
    populationAuSnapshot: charge.populationAuSnapshot,
    reproductionsDejaAuSnapshot: charge.reproductionsDejaAuSnapshot,
    placesGlobalesPlanifiees: charge.placesGlobalesPlanifiees,
    identifiantsParentsOrdonnes: charge.identifiantsParentsOrdonnes as string[],
    parents:
      charge.parents as ChargeReproductionEconomiqueV03CyclePlanifiee["parents"],
    tentatives:
      charge.tentatives as ChargeReproductionEconomiqueV03CyclePlanifiee["tentatives"],
  };
  if (Array.isArray(charge.observabiliteParents)) {
    return {
      ...base,
      observabiliteParents:
        charge.observabiliteParents as ObservabiliteParentReproductionEconomiqueV03[],
    };
  }
  return base;
}

function incrementer(
  compteur: Record<string, number>,
  cle: string,
  delta = 1,
): void {
  compteur[cle] = (compteur[cle] ?? 0) + delta;
}

/**
 * Projection pure d'observabilité reproductive pour un cycle.
 */
export function projeterObservabiliteReproductionEconomiqueV03(options: {
  readonly evenements: readonly EvenementPourObservabiliteV03[];
  readonly numeroCycle: number;
}): ObservabiliteReproductionEconomiqueV03Cycle | null {
  const { numeroCycle } = options;
  const ordonnes = [...options.evenements].sort(
    (a, b) => a.sequence - b.sequence,
  );

  let plan: ChargeReproductionEconomiqueV03CyclePlanifiee | undefined;
  let chargeTerminee: Readonly<Record<string, unknown>> | undefined;

  for (const e of ordonnes) {
    if (e.numeroCycle !== numeroCycle) {
      continue;
    }
    if (e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE") {
      plan = parserPlanDepuisCharge(e.chargeUtile ?? {});
    }
    if (e.type === "REPRODUCTION_ECONOMIQUE_V03_CYCLE_TERMINEE") {
      chargeTerminee = e.chargeUtile;
    }
  }

  if (plan === undefined) {
    return null;
  }

  const parents = plan.observabiliteParents ?? [];
  const fenetresFermeesParMotif: Record<string, number> = {};
  let fenetresOuvertes = 0;
  let capaciteEconomiqueTheoriqueTotale = 0n;
  let capaciteApresLimiteEnfantsTotale = 0n;
  let capaciteEconomiqueTheoriqueEligible = 0n;
  let capaciteBloqueeParPlafondParent = 0n;
  let capaciteDisponibleApresPlafondParent = 0n;
  let fermeturesNombreEnfantsMax = 0;
  let fermeturesPopulationMaximale = 0;
  let fermeturesReproductionsCycleMax = 0;

  for (const p of parents) {
    const capa = lireBigintDecimal(p.capaciteTheorique);
    const borne = lireBigintDecimal(p.capaciteBorneeParEnfants);
    capaciteEconomiqueTheoriqueTotale += capa;
    capaciteApresLimiteEnfantsTotale += borne;
    if (p.fenetre.ouverte) {
      fenetresOuvertes += 1;
    } else {
      incrementer(fenetresFermeesParMotif, p.fenetre.motif);
      if (p.fenetre.motif === "nombre_enfants_max") {
        fermeturesNombreEnfantsMax += 1;
      } else if (p.fenetre.motif === "population_maximale") {
        fermeturesPopulationMaximale += 1;
      } else if (p.fenetre.motif === "reproductions_cycle_max") {
        fermeturesReproductionsCycleMax += 1;
      }
    }

    if (estParentEligibleStructurelHorsGardeFousV03(p.fenetre)) {
      capaciteEconomiqueTheoriqueEligible += capa;
      const bloqueParent = capa > borne ? capa - borne : 0n;
      capaciteBloqueeParPlafondParent += bloqueParent;
      capaciteDisponibleApresPlafondParent += borne;
    }
  }

  const tentativesPlanifiees = plan.tentatives.length;
  const placesGlobalesPlanifiees = plan.placesGlobalesPlanifiees;

  const deltaGlobal =
    capaciteDisponibleApresPlafondParent - BigInt(tentativesPlanifiees);
  const capaciteBloqueeParPlafondsGlobaux =
    deltaGlobal > 0n ? deltaGlobal : 0n;

  const opportunitesBloqueesParGardeFous =
    capaciteBloqueeParPlafondParent + capaciteBloqueeParPlafondsGlobaux;
  const opportunitesEconomiquementFinancables =
    capaciteEconomiqueTheoriqueEligible;

  const obsParReproduction = new Map<
    string,
    ObservabiliteTentativeReproductionEconomiqueV03
  >();
  const naissances = new Set<string>();
  const refus = new Map<string, string>();

  for (const e of ordonnes) {
    if (e.numeroCycle !== numeroCycle) {
      continue;
    }
    const charge = e.chargeUtile ?? {};
    const obs = charge.observabiliteTentativeV03;
    if (
      obs !== undefined &&
      typeof obs === "object" &&
      !Array.isArray(obs) &&
      typeof (obs as ObservabiliteTentativeReproductionEconomiqueV03)
        .identifiantReproduction === "string"
    ) {
      const o = obs as ObservabiliteTentativeReproductionEconomiqueV03;
      obsParReproduction.set(o.identifiantReproduction, o);
    }
    if (e.type === "REPRODUCTION_TERMINEE") {
      const id = charge.identifiantReproduction;
      if (typeof id === "string") {
        naissances.add(id);
      }
    }
    if (e.type === "REPRODUCTION_REFUSEE") {
      const id = charge.identifiantReproduction;
      const motif = charge.motif;
      if (typeof id === "string" && typeof motif === "string") {
        refus.set(id, motif);
      }
    }
  }

  let tentativesReellementEvaluees = 0;
  let tentativesAutorisees = 0;
  let tentativesRefusees = 0;
  const refusParMotif: Record<string, number> = {};
  const refusEvaluesParMotif: Record<string, number> = {};
  const refusPropagationParMotif: Record<string, number> = {};

  for (const t of plan.tentatives) {
    const obs = obsParReproduction.get(t.identifiantReproduction);
    const estNaissance = naissances.has(t.identifiantReproduction);
    const motifRefus = refus.get(t.identifiantReproduction);

    if (obs !== undefined) {
      if (obs.modeEvaluation === "evaluee") {
        tentativesReellementEvaluees += 1;
      }
      if (obs.autorisation.autorisee) {
        tentativesAutorisees += 1;
      } else {
        tentativesRefusees += 1;
        incrementer(refusParMotif, obs.autorisation.motif);
        if (obs.modeEvaluation === "evaluee") {
          incrementer(refusEvaluesParMotif, obs.autorisation.motif);
        } else {
          incrementer(refusPropagationParMotif, obs.autorisation.motif);
        }
      }
    } else if (estNaissance) {
      tentativesReellementEvaluees += 1;
      tentativesAutorisees += 1;
    } else if (motifRefus !== undefined) {
      tentativesReellementEvaluees += 1;
      tentativesRefusees += 1;
      incrementer(refusParMotif, motifRefus);
      incrementer(refusEvaluesParMotif, motifRefus);
    }
  }

  const naissancesRealisees =
    typeof chargeTerminee?.naissancesEffectuees === "number"
      ? chargeTerminee.naissancesEffectuees
      : naissances.size;

  const placesGlobalesNonUtilisees =
    typeof chargeTerminee?.placesPlanifieesNonUtilisees === "number"
      ? chargeTerminee.placesPlanifieesNonUtilisees
      : placesGlobalesPlanifiees - naissancesRealisees;
  const placesPlanifieesNonUtilisees = placesGlobalesNonUtilisees;
  const placesNonDemandeesParLePlan = Math.max(
    0,
    placesGlobalesPlanifiees - tentativesPlanifiees,
  );
  const tentativesPlanifieesNonRealisees =
    tentativesPlanifiees - naissancesRealisees;

  const arretsFenetreParParent = Array.isArray(
    chargeTerminee?.arretsFenetreParParent,
  )
    ? (chargeTerminee.arretsFenetreParParent as ArretFenetreParentReproductionEconomiqueV03[])
    : [];

  const depuisTermineeEvalues = chargeTerminee?.refusEvaluesParMotif;
  if (
    depuisTermineeEvalues !== undefined &&
    typeof depuisTermineeEvalues === "object" &&
    !Array.isArray(depuisTermineeEvalues)
  ) {
    for (const [k, v] of Object.entries(
      depuisTermineeEvalues as Record<string, number>,
    )) {
      if (typeof v === "number") {
        refusEvaluesParMotif[k] = v;
      }
    }
  }
  const depuisTermineeProp = chargeTerminee?.refusPropagationParMotif;
  if (
    depuisTermineeProp !== undefined &&
    typeof depuisTermineeProp === "object" &&
    !Array.isArray(depuisTermineeProp)
  ) {
    for (const [k, v] of Object.entries(
      depuisTermineeProp as Record<string, number>,
    )) {
      if (typeof v === "number") {
        refusPropagationParMotif[k] = v;
      }
    }
  }

  return {
    version: VERSION_OBSERVABILITE_REPRODUCTION_ECONOMIQUE_V03,
    numeroCycle,
    nombreParentsCandidats: parents.length,
    fenetresOuvertes,
    fenetresFermeesParMotif,
    capaciteEconomiqueTheoriqueTotale,
    capaciteApresLimiteEnfantsTotale,
    capaciteEconomiqueTheoriqueEligible,
    capaciteBloqueeParPlafondParent,
    capaciteDisponibleApresPlafondParent,
    capaciteBloqueeParPlafondsGlobaux,
    tentativesPlanifiees,
    tentativesReellementEvaluees,
    tentativesAutorisees,
    tentativesRefusees,
    naissancesRealisees,
    refusParMotif,
    refusEvaluesParMotif,
    refusPropagationParMotif,
    placesGlobalesPlanifiees,
    placesPlanifieesNonUtilisees,
    placesGlobalesNonUtilisees,
    placesNonDemandeesParLePlan,
    tentativesPlanifieesNonRealisees,
    opportunitesEconomiquementFinancables,
    opportunitesBloqueesParGardeFous,
    fermeturesNombreEnfantsMax,
    fermeturesPopulationMaximale,
    fermeturesReproductionsCycleMax,
    arretsFenetreParParent,
    parents,
  };
}

/**
 * Résultat économique hors reproduction sur une plage de cycles inclusive.
 *
 * Unité : `MicroUsdc` signé (bigint).
 * Pure / déterministe / reconstructible depuis le registre.
 *
 * Métrique d'**engagement** : loyers et redevances au moment DU (naissance
 * de la charge), jamais au paiement / règlement de dette.
 */
export function calculerResultatEconomiqueHorsReproductionV03(options: {
  readonly identifiantAgent: string;
  readonly evenements: readonly EvenementPourObservabiliteV03[];
  readonly fenetre: FenetreCyclesObservabiliteV03;
}): MicroUsdc {
  const { identifiantAgent, fenetre } = options;
  if (
    !Number.isInteger(fenetre.cycleDebut) ||
    !Number.isInteger(fenetre.cycleFin) ||
    fenetre.cycleDebut < 0 ||
    fenetre.cycleFin < fenetre.cycleDebut
  ) {
    throw new Error(
      `Fenêtre cycles invalide : [${String(fenetre.cycleDebut)}, ${String(fenetre.cycleFin)}]`,
    );
  }

  let total: MicroUsdc = 0n;
  const ordonnes = [...options.evenements].sort(
    (a, b) => a.sequence - b.sequence,
  );

  for (const e of ordonnes) {
    if (e.identifiantAgent !== identifiantAgent) {
      continue;
    }
    if (
      e.numeroCycle < fenetre.cycleDebut ||
      e.numeroCycle > fenetre.cycleFin
    ) {
      continue;
    }
    const charge = e.chargeUtile ?? {};
    switch (e.type) {
      case "REVENU_ACTIVITE": {
        total += lireMontantSafe(charge, "montantMicroUsdc");
        break;
      }
      case "PERTE_ACTIVITE":
      case "DEPENSE_COMPUTE":
      case "DEPENSE_DONNEES":
      case "FRAIS_EXECUTION":
      case "LOYER_INFRASTRUCTURE_DU":
      case "REDEVANCE_PROPRIETAIRE_DUE": {
        total -= lireMontantSafe(charge, "montantMicroUsdc");
        break;
      }
      default:
        // PAYE, DETTE_*, TRANSFERT_INTERNE, COUT_REPRODUCTION_PAYE exclus.
        break;
    }
  }

  return total;
}

/** Alias documentaire du livrable H4. */
export const resultatEconomiqueHorsReproductionV03 =
  calculerResultatEconomiqueHorsReproductionV03;

/**
 * Retire les champs d'observabilité v03-C d'une charge pour comparaison
 * de trajectoire causale (non-interférence v03-B / v03-C).
 */
export function retirerChampsObservabiliteV03(
  charge: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const copie: Record<string, unknown> = { ...charge };
  for (const cle of CLES_OBSERVABILITE_CHARGE_V03) {
    delete copie[cle];
  }
  return copie;
}

/**
 * Empreinte causale comparable : types + charges sans observabilité v03-C.
 */
export function empreinteTrajectoireCausaleSansObservabiliteV03(
  evenements: readonly EvenementPourObservabiliteV03[],
): string {
  const parties: string[] = [];
  const ordonnes = [...evenements].sort((a, b) => a.sequence - b.sequence);
  for (const e of ordonnes) {
    const charge = retirerChampsObservabiliteV03(e.chargeUtile ?? {});
    parties.push(
      JSON.stringify({
        type: e.type,
        identifiant: e.identifiant,
        identifiantAgent: e.identifiantAgent ?? null,
        numeroCycle: e.numeroCycle,
        chargeUtile: charge,
      }),
    );
  }
  return parties.join("\n");
}

const CLES_ANTI_FITNESS_INTERDITES = [
  "fitnessScore",
  "rank",
  "rang",
  "percentile",
  "meilleurAgent",
  "scoreGlobal",
  "fitnessGlobale",
  "scoreReproductif",
] as const;

/**
 * Audit anti-fitness : aucune clé de score / rang dans une structure.
 */
export function assertAucuneCleAntiFitnessV03(
  valeur: unknown,
  chemin = "$",
): void {
  if (valeur === null || typeof valeur !== "object") {
    return;
  }
  if (Array.isArray(valeur)) {
    for (let i = 0; i < valeur.length; i += 1) {
      assertAucuneCleAntiFitnessV03(valeur[i], `${chemin}[${String(i)}]`);
    }
    return;
  }
  for (const [cle, enfant] of Object.entries(
    valeur as Record<string, unknown>,
  )) {
    if ((CLES_ANTI_FITNESS_INTERDITES as readonly string[]).includes(cle)) {
      throw new Error(
        `Clé anti-fitness interdite dans observabilité v03 : ${chemin}.${cle}`,
      );
    }
    assertAucuneCleAntiFitnessV03(enfant, `${chemin}.${cle}`);
  }
}

export function parserCapaciteTheoriqueObservabilite(valeur: string): bigint {
  return parserMicroUsdc(valeur);
}

export type { MotifArretFenetreReproductionEconomiqueV03 };
