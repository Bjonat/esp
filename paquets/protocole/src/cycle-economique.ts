import type { EtatEconomiqueAgent } from "./etat-economique.js";
import {
  calculerValeurEconomiqueNette,
  clonerEtatEconomique,
  creerEtatEconomiqueInitial,
  figerEtatEconomique,
} from "./etat-economique.js";
import type {
  EntreeEvenementEconomique,
  EvenementEconomique,
} from "./evenements-economiques.js";
import type { ChargeAgentCree } from "./evenements-economiques.js";
import {
  VERSION_SCHEMA_EVENEMENT,
  ecrireMontantChargeUtile,
  lireMontantChargeUtile,
} from "./evenements-economiques.js";
import { ajusterHighWaterMarkTransfert } from "./high-water-mark.js";
import type { MicroUsdc } from "./monnaie.js";
import { assertMicroUsdcNonNegatif } from "./monnaie.js";
import type { ParametresEconomiquesExperience } from "./parametres-economiques.js";
import { validerParametresEconomiques } from "./parametres-economiques.js";
import { calculerRedevanceProprietaire } from "./redevance.js";
import { calculerSurvieApresCycle } from "./runway.js";
import { transitionnerEtatSurvie } from "./etat-survie.js";
import type { TresorerieProprietaire } from "./tresorerie-proprietaire.js";
import {
  enregistrerLoyerEncaisse,
  enregistrerRedevanceEncaissee,
} from "./tresorerie-proprietaire.js";

/**
 * Résultat d'activité simulé pour un cycle — aucune IA, aucun marché.
 */
export interface ResultatActiviteCycle {
  readonly revenuActivite: MicroUsdc;
  readonly perteActivite: MicroUsdc;
  readonly depenseCompute: MicroUsdc;
  readonly depenseDonnees: MicroUsdc;
  readonly fraisExecution: MicroUsdc;
}

export type OptionsCycleEconomique = {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  parametres: ParametresEconomiquesExperience;
  etat: EtatEconomiqueAgent;
  tresorerie: TresorerieProprietaire;
  activite: ResultatActiviteCycle;
  /** Préfixe des identifiants d'événements (tests / contrôleur). */
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
};

export type ResultatCycleEconomique = {
  readonly etat: EtatEconomiqueAgent;
  readonly tresorerie: TresorerieProprietaire;
  readonly evenements: readonly EntreeEvenementEconomique[];
  readonly runway: number;
  readonly valeurEconomiqueNette: MicroUsdc;
};

export type MotifDette =
  | "loyer_infrastructure"
  | "redevance_proprietaire"
  | "autre";

export class AgentMortInactifErreur extends Error {
  constructor(identifiantAgent: string) {
    super(
      `L'agent ${identifiantAgent} est mort et ne peut plus exécuter de cycle économique.`,
    );
    this.name = "AgentMortInactifErreur";
  }
}

export class CycleEconomiqueInvalideErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CycleEconomiqueInvalideErreur";
  }
}

type ContexteEcriture = {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  /** Compteur local d'unicité d'identifiant — distinct de la séquence registre. */
  indiceLocal: number;
  prefixeIdentifiant: string;
  dateEnregistrement?: string;
  evenements: EntreeEvenementEconomique[];
};

function pousserEvenement(
  contexte: ContexteEcriture,
  type: EntreeEvenementEconomique["type"],
  chargeUtile: Record<string, unknown> = {},
  options?: { sansAgent?: boolean },
): void {
  const entree: EntreeEvenementEconomique = {
    identifiant: `${contexte.prefixeIdentifiant}${type}-${contexte.numeroCycle}-${contexte.indiceLocal}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type,
    identifiantExperience: contexte.identifiantExperience,
    numeroCycle: contexte.numeroCycle,
    chargeUtile,
    ...(options?.sansAgent
      ? {}
      : { identifiantAgent: contexte.identifiantAgent }),
    ...(contexte.dateEnregistrement !== undefined
      ? { dateEnregistrement: contexte.dateEnregistrement }
      : {}),
  };
  contexte.evenements.push(entree);
  contexte.indiceLocal += 1;
}

function assertMontantsActiviteNonNegatifs(activite: ResultatActiviteCycle): void {
  assertMicroUsdcNonNegatif(activite.revenuActivite, "revenuActivite");
  assertMicroUsdcNonNegatif(activite.perteActivite, "perteActivite");
  assertMicroUsdcNonNegatif(activite.depenseCompute, "depenseCompute");
  assertMicroUsdcNonNegatif(activite.depenseDonnees, "depenseDonnees");
  assertMicroUsdcNonNegatif(activite.fraisExecution, "fraisExecution");
}

function loyerEstDu(
  numeroCycle: number,
  periodeLoyerEnCycles: number,
): boolean {
  return numeroCycle > 0 && numeroCycle % periodeLoyerEnCycles === 0;
}

/**
 * Exécute un cycle économique déterministe.
 *
 * La séquence globale des événements est attribuée par le registre à l'enregistrement,
 * pas par le moteur.
 */
export function executerCycleEconomique(
  options: OptionsCycleEconomique,
): ResultatCycleEconomique {
  validerParametresEconomiques(options.parametres);

  if (options.etat.etatSurvie === "mort") {
    throw new AgentMortInactifErreur(options.identifiantAgent);
  }
  if (options.numeroCycle < 1) {
    throw new CycleEconomiqueInvalideErreur("numeroCycle doit être >= 1");
  }
  if (options.etat.identifiantAgent !== options.identifiantAgent) {
    throw new CycleEconomiqueInvalideErreur(
      "identifiantAgent incohérent avec l'état économique",
    );
  }
  assertMontantsActiviteNonNegatifs(options.activite);

  const etat = clonerEtatEconomique(options.etat);
  let tresorerie = options.tresorerie;
  const contexte: ContexteEcriture = {
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantAgent,
    numeroCycle: options.numeroCycle,
    indiceLocal: 1,
    prefixeIdentifiant: options.prefixeIdentifiant ?? "",
    evenements: [],
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };

  pousserEvenement(contexte, "CYCLE_DEMARRE");

  if (options.activite.revenuActivite > 0n) {
    etat.capitalLiquide += options.activite.revenuActivite;
    etat.totalRevenusActivite += options.activite.revenuActivite;
    pousserEvenement(contexte, "REVENU_ACTIVITE", {
      montantMicroUsdc: ecrireMontantChargeUtile(options.activite.revenuActivite),
    });
  }
  if (options.activite.perteActivite > 0n) {
    etat.capitalLiquide -= options.activite.perteActivite;
    etat.totalPertesActivite += options.activite.perteActivite;
    pousserEvenement(contexte, "PERTE_ACTIVITE", {
      montantMicroUsdc: ecrireMontantChargeUtile(options.activite.perteActivite),
    });
  }

  if (options.activite.depenseCompute > 0n) {
    etat.capitalLiquide -= options.activite.depenseCompute;
    etat.totalDepensesCompute += options.activite.depenseCompute;
    pousserEvenement(contexte, "DEPENSE_COMPUTE", {
      montantMicroUsdc: ecrireMontantChargeUtile(options.activite.depenseCompute),
    });
  }
  if (options.activite.depenseDonnees > 0n) {
    etat.capitalLiquide -= options.activite.depenseDonnees;
    etat.totalDepensesDonnees += options.activite.depenseDonnees;
    pousserEvenement(contexte, "DEPENSE_DONNEES", {
      montantMicroUsdc: ecrireMontantChargeUtile(options.activite.depenseDonnees),
    });
  }
  if (options.activite.fraisExecution > 0n) {
    etat.capitalLiquide -= options.activite.fraisExecution;
    etat.totalFraisExecution += options.activite.fraisExecution;
    pousserEvenement(contexte, "FRAIS_EXECUTION", {
      montantMicroUsdc: ecrireMontantChargeUtile(options.activite.fraisExecution),
    });
  }

  const parametres = options.parametres;
  if (loyerEstDu(options.numeroCycle, parametres.periodeLoyerEnCycles)) {
    const loyer = parametres.loyerInfrastructureMicroUsdc;
    pousserEvenement(contexte, "LOYER_INFRASTRUCTURE_DU", {
      montantMicroUsdc: ecrireMontantChargeUtile(loyer),
    });
    if (loyer > 0n) {
      if (etat.capitalLiquide >= loyer) {
        etat.capitalLiquide -= loyer;
        etat.totalLoyersPayes += loyer;
        tresorerie = enregistrerLoyerEncaisse(tresorerie, loyer);
        pousserEvenement(contexte, "LOYER_INFRASTRUCTURE_PAYE", {
          montantMicroUsdc: ecrireMontantChargeUtile(loyer),
        });
      } else {
        etat.obligationsDues += loyer;
        pousserEvenement(contexte, "DETTE_CREEE", {
          motif: "loyer_infrastructure",
          montantMicroUsdc: ecrireMontantChargeUtile(loyer),
        });
      }
    }
  }

  const calculRedevance = calculerRedevanceProprietaire(
    etat,
    parametres.tauxRedevanceProprietairePointsDeBase,
  );
  etat.highWaterMarkProprietaire = calculRedevance.highWaterMarkApres;

  if (calculRedevance.montantRedevance > 0n) {
    pousserEvenement(contexte, "REDEVANCE_PROPRIETAIRE_DUE", {
      montantMicroUsdc: ecrireMontantChargeUtile(calculRedevance.montantRedevance),
      profitTaxableMicroUsdc: ecrireMontantChargeUtile(calculRedevance.profitTaxable),
      highWaterMarkAvantMicroUsdc: ecrireMontantChargeUtile(
        calculRedevance.highWaterMarkAvant,
      ),
      highWaterMarkApresMicroUsdc: ecrireMontantChargeUtile(
        calculRedevance.highWaterMarkApres,
      ),
    });

    if (etat.capitalLiquide >= calculRedevance.montantRedevance) {
      etat.capitalLiquide -= calculRedevance.montantRedevance;
      etat.totalRedevancesProprietairePayees += calculRedevance.montantRedevance;
      tresorerie = enregistrerRedevanceEncaissee(
        tresorerie,
        calculRedevance.montantRedevance,
      );
      pousserEvenement(contexte, "REDEVANCE_PROPRIETAIRE_PAYEE", {
        montantMicroUsdc: ecrireMontantChargeUtile(calculRedevance.montantRedevance),
        profitTaxableMicroUsdc: ecrireMontantChargeUtile(
          calculRedevance.profitTaxable,
        ),
        highWaterMarkAvantMicroUsdc: ecrireMontantChargeUtile(
          calculRedevance.highWaterMarkAvant,
        ),
        highWaterMarkApresMicroUsdc: ecrireMontantChargeUtile(
          calculRedevance.highWaterMarkApres,
        ),
      });
    } else {
      etat.obligationsDues += calculRedevance.montantRedevance;
      pousserEvenement(contexte, "DETTE_CREEE", {
        motif: "redevance_proprietaire",
        montantMicroUsdc: ecrireMontantChargeUtile(calculRedevance.montantRedevance),
      });
    }
  }

  const survie = calculerSurvieApresCycle(etat, parametres);
  const etatAvantSurvie = etat.etatSurvie;
  const nouvelEtatSurvie = transitionnerEtatSurvie(
    etatAvantSurvie,
    survie.etatSurvie,
  );

  if (nouvelEtatSurvie !== etatAvantSurvie) {
    pousserEvenement(contexte, "ETAT_SURVIE_MODIFIE", {
      depuis: etatAvantSurvie,
      vers: nouvelEtatSurvie,
    });
    if (nouvelEtatSurvie === "dormant") {
      pousserEvenement(contexte, "AGENT_DORMANT", {
        cyclesDormanceConsecutifs: survie.cyclesDormanceConsecutifs,
      });
    }
    if (nouvelEtatSurvie === "mort") {
      pousserEvenement(contexte, "AGENT_MORT", {
        cyclesDormanceConsecutifs: survie.cyclesDormanceConsecutifs,
      });
    }
  }

  etat.etatSurvie = nouvelEtatSurvie;
  etat.cyclesDormanceConsecutifs = survie.cyclesDormanceConsecutifs;
  etat.dernierNumeroCycle = options.numeroCycle;

  pousserEvenement(contexte, "CYCLE_TERMINE", {
    runway: survie.runway,
    valeurEconomiqueNetteMicroUsdc: ecrireMontantChargeUtile(
      calculerValeurEconomiqueNette(etat),
    ),
    highWaterMarkProprietaireMicroUsdc: ecrireMontantChargeUtile(
      etat.highWaterMarkProprietaire,
    ),
    cyclesDormanceConsecutifs: etat.cyclesDormanceConsecutifs,
    etatSurvie: etat.etatSurvie,
  });

  return {
    etat: figerEtatEconomique(etat),
    tresorerie,
    evenements: contexte.evenements,
    runway: survie.runway,
    valeurEconomiqueNette: calculerValeurEconomiqueNette(etat),
  };
}

export type OptionsAttributionCapital = {
  identifiantExperience: string;
  identifiantAgent: string;
  montant: MicroUsdc;
  numeroCycle?: number;
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
  etatSurvieInitial?: EtatEconomiqueAgent["etatSurvie"];
  /**
   * Identité de naissance — payload canonique AGENT_CREE.
   * Valeurs par défaut : génération 0, index 0, date dérivée.
   */
  naissance?: {
    generation?: number;
    indexPopulation?: number;
    dateNaissance?: string;
    identifiantParent?: string;
  };
};

/**
 * Crée l'état initial et les événements de naissance / capital.
 * La naissance et l'attribution de capital ne créent pas de revenu (ESP-ECO-009).
 */
export function attribuerCapitalInitial(
  options: OptionsAttributionCapital,
): {
  etat: EtatEconomiqueAgent;
  evenements: EntreeEvenementEconomique[];
} {
  assertMicroUsdcNonNegatif(options.montant, "capital initial");
  const numeroCycle = options.numeroCycle ?? 0;
  const prefixe = options.prefixeIdentifiant ?? "";
  const generation = options.naissance?.generation ?? 0;
  const indexPopulation = options.naissance?.indexPopulation ?? 0;
  const dateNaissance =
    options.naissance?.dateNaissance ??
    options.dateEnregistrement ??
    `cycle:${String(numeroCycle)}`;

  if (!Number.isInteger(generation) || generation < 0) {
    throw new CycleEconomiqueInvalideErreur(
      "AGENT_CREE : generation doit être un entier >= 0",
    );
  }
  if (!Number.isInteger(indexPopulation) || indexPopulation < 0) {
    throw new CycleEconomiqueInvalideErreur(
      "AGENT_CREE : indexPopulation doit être un entier >= 0",
    );
  }

  const chargeAgentCree: ChargeAgentCree = {
    generation,
    indexPopulation,
    dateNaissance,
    ...(options.naissance?.identifiantParent !== undefined
      ? { identifiantParent: options.naissance.identifiantParent }
      : {}),
  };

  const evenements: EntreeEvenementEconomique[] = [
    {
      identifiant: `${prefixe}AGENT_CREE-${options.identifiantAgent}`,
      versionSchema: VERSION_SCHEMA_EVENEMENT,
      type: "AGENT_CREE",
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantAgent,
      numeroCycle,
      chargeUtile: chargeAgentCree,
      ...(options.dateEnregistrement !== undefined
        ? { dateEnregistrement: options.dateEnregistrement }
        : {}),
    },
    {
      identifiant: `${prefixe}CAPITAL_INITIAL_ATTRIBUE-${options.identifiantAgent}`,
      versionSchema: VERSION_SCHEMA_EVENEMENT,
      type: "CAPITAL_INITIAL_ATTRIBUE",
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.identifiantAgent,
      numeroCycle,
      chargeUtile: {
        montantMicroUsdc: ecrireMontantChargeUtile(options.montant),
      },
      ...(options.dateEnregistrement !== undefined
        ? { dateEnregistrement: options.dateEnregistrement }
        : {}),
    },
  ];

  const etat = creerEtatEconomiqueInitial({
    identifiantAgent: options.identifiantAgent,
    capitalLiquide: options.montant,
    etatSurvie: options.etatSurvieInitial ?? "sain",
  });

  return { etat, evenements };
}

/**
 * Transfert interne entre deux agents — ne crée pas de valeur (ESP-ECO-007).
 * La séquence est attribuée à l'enregistrement dans le registre.
 */
export function preparerTransfertInterne(options: {
  identifiantExperience: string;
  identifiantAgentSource: string;
  identifiantAgentDestinataire: string;
  montant: MicroUsdc;
  identifiantTransfert: string;
  numeroCycle: number;
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
}): {
  evenements: EntreeEvenementEconomique[];
} {
  assertMicroUsdcNonNegatif(options.montant, "transfert interne");
  if (options.identifiantAgentSource === options.identifiantAgentDestinataire) {
    throw new CycleEconomiqueInvalideErreur(
      "transfert interne : source et destinataire identiques",
    );
  }

  const prefixe = options.prefixeIdentifiant ?? "";
  const montantChaine = ecrireMontantChargeUtile(options.montant);
  const chargeBase = {
    identifiantAgentSource: options.identifiantAgentSource,
    identifiantAgentDestinataire: options.identifiantAgentDestinataire,
    montantMicroUsdc: montantChaine,
    identifiantTransfert: options.identifiantTransfert,
  };

  return {
    evenements: [
      {
        identifiant: `${prefixe}TRANSFERT_INTERNE-sortie-${options.identifiantTransfert}`,
        versionSchema: VERSION_SCHEMA_EVENEMENT,
        type: "TRANSFERT_INTERNE",
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.identifiantAgentSource,
        numeroCycle: options.numeroCycle,
        chargeUtile: { ...chargeBase, sens: "sortie" },
        ...(options.dateEnregistrement !== undefined
          ? { dateEnregistrement: options.dateEnregistrement }
          : {}),
      },
      {
        identifiant: `${prefixe}TRANSFERT_INTERNE-entree-${options.identifiantTransfert}`,
        versionSchema: VERSION_SCHEMA_EVENEMENT,
        type: "TRANSFERT_INTERNE",
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.identifiantAgentDestinataire,
        numeroCycle: options.numeroCycle,
        chargeUtile: { ...chargeBase, sens: "entree" },
        ...(options.dateEnregistrement !== undefined
          ? { dateEnregistrement: options.dateEnregistrement }
          : {}),
      },
    ],
  };
}

export function appliquerTransfertSurEtat(
  etat: EtatEconomiqueAgent,
  evenement: Pick<EvenementEconomique, "type" | "chargeUtile">,
): EtatEconomiqueAgent {
  if (evenement.type !== "TRANSFERT_INTERNE") {
    throw new CycleEconomiqueInvalideErreur(
      "appliquerTransfertSurEtat attend TRANSFERT_INTERNE",
    );
  }
  const sens = evenement.chargeUtile.sens;
  const montant = lireMontantChargeUtile(evenement.chargeUtile, "montantMicroUsdc");
  const clone = clonerEtatEconomique(etat);
  if (sens === "sortie") {
    clone.capitalLiquide -= montant;
    clone.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
      clone.highWaterMarkProprietaire,
      montant,
      "sortie",
    );
  } else if (sens === "entree") {
    clone.capitalLiquide += montant;
    clone.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
      clone.highWaterMarkProprietaire,
      montant,
      "entree",
    );
  } else {
    throw new CycleEconomiqueInvalideErreur(
      `sens de transfert invalide : ${String(sens)}`,
    );
  }
  return figerEtatEconomique(clone);
}

export type OptionsReglementDette = {
  identifiantExperience: string;
  identifiantAgent: string;
  numeroCycle: number;
  montant: MicroUsdc;
  motif: MotifDette;
  etat: EtatEconomiqueAgent;
  tresorerie: TresorerieProprietaire;
  prefixeIdentifiant?: string;
  dateEnregistrement?: string;
};

export type ResultatReglementDette = {
  readonly etat: EtatEconomiqueAgent;
  readonly tresorerie: TresorerieProprietaire;
  readonly evenements: readonly EntreeEvenementEconomique[];
  readonly valeurEconomiqueNette: MicroUsdc;
};

/**
 * Règle une obligation existante sans créer de perte économique nouvelle.
 * VEN avant == VEN après : capital et obligations diminuent du même montant.
 * La trésorerie propriétaire n'est créditée qu'au paiement réel.
 */
export function reglerDette(options: OptionsReglementDette): ResultatReglementDette {
  assertMicroUsdcNonNegatif(options.montant, "règlement de dette");
  if (options.montant === 0n) {
    throw new CycleEconomiqueInvalideErreur("montant de règlement nul interdit");
  }
  if (options.etat.identifiantAgent !== options.identifiantAgent) {
    throw new CycleEconomiqueInvalideErreur(
      "identifiantAgent incohérent avec l'état économique",
    );
  }
  if (options.montant > options.etat.obligationsDues) {
    throw new CycleEconomiqueInvalideErreur(
      "règlement supérieur aux obligations dues",
    );
  }
  if (options.montant > options.etat.capitalLiquide) {
    throw new CycleEconomiqueInvalideErreur(
      "capital liquide insuffisant pour régler la dette",
    );
  }

  const etat = clonerEtatEconomique(options.etat);
  let tresorerie = options.tresorerie;
  const venAvant = calculerValeurEconomiqueNette(etat);

  etat.capitalLiquide -= options.montant;
  etat.obligationsDues -= options.montant;

  if (options.motif === "loyer_infrastructure") {
    etat.totalLoyersPayes += options.montant;
    tresorerie = enregistrerLoyerEncaisse(tresorerie, options.montant);
  } else if (options.motif === "redevance_proprietaire") {
    etat.totalRedevancesProprietairePayees += options.montant;
    tresorerie = enregistrerRedevanceEncaissee(tresorerie, options.montant);
  }

  const venApres = calculerValeurEconomiqueNette(etat);
  if (venApres !== venAvant) {
    throw new CycleEconomiqueInvalideErreur(
      "invariant VEN brisé lors du règlement de dette",
    );
  }

  const prefixe = options.prefixeIdentifiant ?? "";
  const evenement: EntreeEvenementEconomique = {
    identifiant: `${prefixe}DETTE_REGLEE-${options.identifiantAgent}-${options.numeroCycle}-${ecrireMontantChargeUtile(options.montant)}`,
    versionSchema: VERSION_SCHEMA_EVENEMENT,
    type: "DETTE_REGLEE",
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.identifiantAgent,
    numeroCycle: options.numeroCycle,
    chargeUtile: {
      motif: options.motif,
      montantMicroUsdc: ecrireMontantChargeUtile(options.montant),
    },
    ...(options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {}),
  };

  return {
    etat: figerEtatEconomique(etat),
    tresorerie,
    evenements: [evenement],
    valeurEconomiqueNette: venApres,
  };
}
