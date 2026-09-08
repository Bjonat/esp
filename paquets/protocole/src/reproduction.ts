/**
 * Reproduction mécanique ESP v0.1 — naissance financée par le parent.
 *
 * Invariants :
 * - NAISSANCE ≠ CRÉATION DE VALEUR (dotation = transfert interne)
 * - coût reproduction distinct de la dotation
 * - aucune sélection par fitness
 * - aucune dette automatique
 * - identité enfant ≠ identité parent
 */

import {
  calculerValeurEconomiqueNette,
  clonerEtatEconomique,
  creerEtatEconomiqueInitial,
  figerEtatEconomique,
  type EtatEconomiqueAgent,
} from "./etat-economique.js";
import { estEtatMort } from "./etat-survie.js";
import {
  VERSION_SCHEMA_EVENEMENT,
  ecrireMontantChargeUtile,
  type ChargeAgentCree,
  type EntreeEvenementEconomique,
} from "./evenements-economiques.js";
import type { EntreeEvenementEsp } from "./evenements-esp.js";
import type {
  EntreeEvenementReproduction,
  MotifRefusReproduction,
} from "./evenements-reproduction.js";
import {
  copierConfigurationHeritable,
  serialiserConfigurationHeritable,
  type ConfigurationHeritableAgent,
} from "./configuration-heritable.js";
import { preparerTransfertInterne } from "./cycle-economique.js";
import { ajusterHighWaterMarkTransfert } from "./high-water-mark.js";
import { assertMicroUsdcNonNegatif } from "./monnaie.js";
import type { ParametresReproductionExperience } from "./parametres-reproduction.js";
import type { TresorerieProprietaire } from "./tresorerie-proprietaire.js";
import { enregistrerCoutReproductionEncaisse } from "./tresorerie-proprietaire.js";

export function fabriquerIdentifiantReproduction(options: {
  readonly identifiantExperience: string;
  readonly identifiantParent: string;
  readonly numeroEnfant: number;
}): string {
  const n = String(options.numeroEnfant).padStart(3, "0");
  return `repro:${options.identifiantExperience}:${options.identifiantParent}:e${n}`;
}

export function fabriquerIdentifiantEnfant(options: {
  readonly identifiantParent: string;
  readonly numeroEnfant: number;
}): string {
  const n = String(options.numeroEnfant).padStart(3, "0");
  return `${options.identifiantParent}-e${n}`;
}

export type AnalyseReproduction = {
  readonly identifiantReproduction: string;
  readonly terminee: boolean;
  readonly refusee: boolean;
  readonly autorisee: boolean;
  readonly identifiantEnfant: string | null;
  readonly motifRefus: MotifRefusReproduction | null;
};

export function analyserReproduction(options: {
  readonly identifiantReproduction: string;
  readonly evenements: readonly {
    readonly type: string;
    readonly chargeUtile: Readonly<Record<string, unknown>>;
  }[];
}): AnalyseReproduction {
  const id = options.identifiantReproduction;
  let terminee = false;
  let refusee = false;
  let autorisee = false;
  let identifiantEnfant: string | null = null;
  let motifRefus: MotifRefusReproduction | null = null;

  for (const evenement of options.evenements) {
    const charge = evenement.chargeUtile;
    if (charge.identifiantReproduction !== id) {
      continue;
    }
    if (evenement.type === "REPRODUCTION_TERMINEE") {
      terminee = true;
      if (typeof charge.identifiantEnfant === "string") {
        identifiantEnfant = charge.identifiantEnfant;
      }
    }
    if (evenement.type === "REPRODUCTION_REFUSEE") {
      refusee = true;
      if (typeof charge.motif === "string") {
        motifRefus = charge.motif as MotifRefusReproduction;
      }
    }
    if (evenement.type === "REPRODUCTION_AUTORISEE") {
      autorisee = true;
      if (typeof charge.identifiantEnfant === "string") {
        identifiantEnfant = charge.identifiantEnfant;
      }
    }
  }

  return {
    identifiantReproduction: id,
    terminee,
    refusee,
    autorisee,
    identifiantEnfant,
    motifRefus,
  };
}

export type ContexteAutorisationReproduction = {
  readonly parametres: ParametresReproductionExperience;
  readonly etatParent: EtatEconomiqueAgent;
  readonly populationTotale: number;
  readonly nombreEnfantsParent: number;
  readonly reproductionsDejaCeCycle: number;
  readonly cycleDerniereNaissanceParent: number | null;
  readonly numeroCycle: number;
};

export function evaluerAutorisationReproduction(
  contexte: ContexteAutorisationReproduction,
): { readonly autorisee: true } | {
  readonly autorisee: false;
  readonly motif: MotifRefusReproduction;
} {
  const { parametres, etatParent } = contexte;
  if (!parametres.active) {
    return { autorisee: false, motif: "reproduction_desactivee" };
  }
  if (estEtatMort(etatParent.etatSurvie)) {
    return { autorisee: false, motif: "agent_mort" };
  }
  if (contexte.populationTotale + 1 > parametres.populationMaximale) {
    return { autorisee: false, motif: "population_maximale" };
  }
  if (contexte.nombreEnfantsParent >= parametres.nombreMaxEnfantsParAgent) {
    return { autorisee: false, motif: "nombre_enfants_max" };
  }
  if (
    contexte.reproductionsDejaCeCycle >=
    parametres.nombreMaxReproductionsParCycle
  ) {
    return { autorisee: false, motif: "reproductions_cycle_max" };
  }
  if (
    parametres.cooldownCycles > 0 &&
    contexte.cycleDerniereNaissanceParent !== null &&
    contexte.numeroCycle - contexte.cycleDerniereNaissanceParent <
      parametres.cooldownCycles
  ) {
    return { autorisee: false, motif: "cooldown" };
  }

  const besoin =
    parametres.dotationEnfantMicroUsdc + parametres.coutReproductionMicroUsdc;
  if (etatParent.capitalLiquide < besoin) {
    return { autorisee: false, motif: "capital_insuffisant" };
  }

  const venApres = calculerValeurEconomiqueNette(etatParent) - besoin;
  if (venApres < parametres.reserveMinimaleParentMicroUsdc) {
    return { autorisee: false, motif: "reserve_minimale" };
  }

  return { autorisee: true };
}

export type OptionsPreparationReproduction = {
  readonly identifiantExperience: string;
  readonly identifiantParent: string;
  readonly identifiantEnfant: string;
  readonly identifiantReproduction: string;
  readonly numeroCycle: number;
  readonly dateNaissance: string;
  readonly indexPopulationEnfant: number;
  readonly numeroGenerationParent: number;
  readonly identifiantLignee: string;
  readonly configurationHeritableParent: ConfigurationHeritableAgent;
  readonly etatParent: EtatEconomiqueAgent;
  readonly tresorerie: TresorerieProprietaire;
  readonly parametres: ParametresReproductionExperience;
  readonly populationTotale: number;
  readonly nombreEnfantsParent: number;
  readonly reproductionsDejaCeCycle: number;
  readonly cycleDerniereNaissanceParent: number | null;
  readonly prefixeIdentifiant?: string;
  readonly dateEnregistrement?: string;
  readonly evenementsExistants?: readonly {
    readonly type: string;
    readonly chargeUtile: Readonly<Record<string, unknown>>;
  }[];
};

export type ResultatPreparationReproduction =
  | {
      readonly statut: "deja_terminee";
      readonly analyse: AnalyseReproduction;
      readonly evenements: readonly EntreeEvenementEsp[];
    }
  | {
      readonly statut: "refusee";
      readonly motif: MotifRefusReproduction;
      readonly evenements: readonly EntreeEvenementEsp[];
      readonly etatParent: EtatEconomiqueAgent;
      readonly tresorerie: TresorerieProprietaire;
    }
  | {
      readonly statut: "autorisee";
      readonly evenements: readonly EntreeEvenementEsp[];
      readonly etatParent: EtatEconomiqueAgent;
      readonly etatEnfant: EtatEconomiqueAgent;
      readonly tresorerie: TresorerieProprietaire;
      readonly configurationHeritableEnfant: ConfigurationHeritableAgent;
      readonly identifiantEnfant: string;
      readonly identifiantLignee: string;
      readonly numeroGeneration: number;
    };

/**
 * Prépare le lot atomique de reproduction (événements purs).
 * N'écrit ni keystore ni registre.
 */
export function preparerReproduction(
  options: OptionsPreparationReproduction,
): ResultatPreparationReproduction {
  const analyse = analyserReproduction({
    identifiantReproduction: options.identifiantReproduction,
    evenements: options.evenementsExistants ?? [],
  });

  if (analyse.terminee) {
    return {
      statut: "deja_terminee",
      analyse,
      evenements: [],
    };
  }

  const prefixe = options.prefixeIdentifiant ?? "";
  const dateOpts =
    options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {};

  const demande: EntreeEvenementReproduction = {
    identifiant: `${prefixe}REPRODUCTION_DEMANDEE-${options.identifiantReproduction}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "REPRODUCTION_DEMANDEE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantParent,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      identifiantReproduction: options.identifiantReproduction,
      identifiantParent: options.identifiantParent,
      dotationEnfantMicroUsdc: ecrireMontantChargeUtile(
        options.parametres.dotationEnfantMicroUsdc,
      ),
      coutReproductionMicroUsdc: ecrireMontantChargeUtile(
        options.parametres.coutReproductionMicroUsdc,
      ),
    },
    ...dateOpts,
  };

  const autorisation = evaluerAutorisationReproduction({
    parametres: options.parametres,
    etatParent: options.etatParent,
    populationTotale: options.populationTotale,
    nombreEnfantsParent: options.nombreEnfantsParent,
    reproductionsDejaCeCycle: options.reproductionsDejaCeCycle,
    cycleDerniereNaissanceParent: options.cycleDerniereNaissanceParent,
    numeroCycle: options.numeroCycle,
  });

  if (!autorisation.autorisee) {
    const refus: EntreeEvenementReproduction = {
      identifiant: `${prefixe}REPRODUCTION_REFUSEE-${options.identifiantReproduction}`,
      versionSchema: VERSION_SCHEMA_EVENEMENT,
      type: "REPRODUCTION_REFUSEE",
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantParent,
      numeroCycle: options.numeroCycle,
      chargeUtile: {
        identifiantReproduction: options.identifiantReproduction,
        identifiantParent: options.identifiantParent,
        motif: autorisation.motif,
      },
      ...dateOpts,
    };
    return {
      statut: "refusee",
      motif: autorisation.motif,
      evenements: [demande, refus],
      etatParent: options.etatParent,
      tresorerie: options.tresorerie,
    };
  }

  const dotation = options.parametres.dotationEnfantMicroUsdc;
  const cout = options.parametres.coutReproductionMicroUsdc;
  assertMicroUsdcNonNegatif(dotation, "dotation");
  assertMicroUsdcNonNegatif(cout, "coutReproduction");

  const numeroGeneration = options.numeroGenerationParent + 1;
  const configurationHeritableEnfant = copierConfigurationHeritable(
    options.configurationHeritableParent,
  );

  const autoriseeEvt: EntreeEvenementReproduction = {
    identifiant: `${prefixe}REPRODUCTION_AUTORISEE-${options.identifiantReproduction}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "REPRODUCTION_AUTORISEE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantParent,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      identifiantReproduction: options.identifiantReproduction,
      identifiantParent: options.identifiantParent,
      identifiantEnfant: options.identifiantEnfant,
      dotationEnfantMicroUsdc: ecrireMontantChargeUtile(dotation),
      coutReproductionMicroUsdc: ecrireMontantChargeUtile(cout),
    },
    ...dateOpts,
  };

  const chargeNaissance: ChargeAgentCree = {
    generation: numeroGeneration,
    indexPopulation: options.indexPopulationEnfant,
    dateNaissance: options.dateNaissance,
    identifiantParent: options.identifiantParent,
    identifiantLignee: options.identifiantLignee,
    configurationHeritable: serialiserConfigurationHeritable(
      configurationHeritableEnfant,
    ),
    identifiantReproduction: options.identifiantReproduction,
  };

  const agentCree: EntreeEvenementEconomique = {
    identifiant: `${prefixe}AGENT_CREE-${options.identifiantEnfant}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "AGENT_CREE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantEnfant,
    numeroCycle: options.numeroCycle,
    chargeUtile: chargeNaissance,
    ...dateOpts,
  };

  const identifiantTransfert = `dotation:${options.identifiantReproduction}`;
  const transfert = preparerTransfertInterne({
    identifiantExperience: options.identifiantExperience,
    identifiantAgentSource: options.identifiantParent,
    identifiantAgentDestinataire: options.identifiantEnfant,
    montant: dotation,
    identifiantTransfert,
    numeroCycle: options.numeroCycle,
    prefixeIdentifiant: prefixe,
    ...dateOpts,
  });

  const transfertsAnnotes = transfert.evenements.map((e) => ({
    ...e,
    chargeUtile: {
      ...e.chargeUtile,
      identifiantReproduction: options.identifiantReproduction,
      motif: "dotation_naissance",
    },
  }));

  const evenementsCout: EntreeEvenementEconomique[] = [];
  let tresorerie = options.tresorerie;
  const etatParentBrouillon = clonerEtatEconomique(options.etatParent);

  if (cout > 0n) {
    evenementsCout.push({
      identifiant: `${prefixe}COUT_REPRODUCTION_PAYE-${options.identifiantReproduction}`,
      versionSchema: VERSION_SCHEMA_EVENEMENT,
      type: "COUT_REPRODUCTION_PAYE",
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantParent,
      numeroCycle: options.numeroCycle,
      chargeUtile: {
        montantMicroUsdc: ecrireMontantChargeUtile(cout),
        identifiantReproduction: options.identifiantReproduction,
      },
      ...dateOpts,
    });
    etatParentBrouillon.capitalLiquide -= cout;
    tresorerie = enregistrerCoutReproductionEncaisse(tresorerie, cout);
  }

  etatParentBrouillon.capitalLiquide -= dotation;
  etatParentBrouillon.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
    etatParentBrouillon.highWaterMarkProprietaire,
    dotation,
    "sortie",
  );

  const etatEnfant = creerEtatEconomiqueInitial({
    identifiantAgent: options.identifiantEnfant,
    capitalLiquide: dotation,
    etatSurvie: "sain",
  });

  const terminee: EntreeEvenementReproduction = {
    identifiant: `${prefixe}REPRODUCTION_TERMINEE-${options.identifiantReproduction}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "REPRODUCTION_TERMINEE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantParent,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      identifiantReproduction: options.identifiantReproduction,
      identifiantParent: options.identifiantParent,
      identifiantEnfant: options.identifiantEnfant,
    },
    ...dateOpts,
  };

  return {
    statut: "autorisee",
    evenements: [
      demande,
      autoriseeEvt,
      agentCree,
      ...transfertsAnnotes,
      ...evenementsCout,
      terminee,
    ],
    etatParent: figerEtatEconomique(etatParentBrouillon),
    etatEnfant,
    tresorerie,
    configurationHeritableEnfant,
    identifiantEnfant: options.identifiantEnfant,
    identifiantLignee: options.identifiantLignee,
    numeroGeneration,
  };
}
