import type {
  BrouillonEtatEconomique,
  EtatEconomiqueAgent,
} from "./etat-economique.js";
import {
  creerEtatEconomiqueInitial,
  figerEtatEconomique,
} from "./etat-economique.js";
import type { EvenementEconomique } from "./evenements-economiques.js";
import { lireMontantChargeUtile } from "./evenements-economiques.js";
import type { EtatSurvie } from "./etat-survie.js";
import { transitionnerEtatSurvie } from "./etat-survie.js";
import { ajusterHighWaterMarkTransfert } from "./high-water-mark.js";

/**
 * Reconstruit l'état économique d'un agent exclusivement depuis ses événements.
 * Ordre : sequence croissante (vérité expérimentale).
 */
export function reconstruireEtatEconomique(
  evenements: readonly EvenementEconomique[],
  identifiantAgent: string,
): EtatEconomiqueAgent {
  const ordonnes = [...evenements]
    .filter((evenement) => evenement.identifiantAgent === identifiantAgent)
    .sort((a, b) => {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return a.numeroCycle - b.numeroCycle;
    });

  const brouillon: BrouillonEtatEconomique = {
    ...creerEtatEconomiqueInitial({
      identifiantAgent,
      capitalLiquide: 0n,
    }),
    highWaterMarkProprietaire: 0n,
  };

  for (const evenement of ordonnes) {
    appliquerEvenement(brouillon, evenement);
  }

  return figerEtatEconomique(brouillon);
}

function appliquerEvenement(
  brouillon: BrouillonEtatEconomique,
  evenement: EvenementEconomique,
): void {
  switch (evenement.type) {
    case "AGENT_CREE":
      break;
    case "CAPITAL_INITIAL_ATTRIBUE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide += montant;
      if (montant > brouillon.highWaterMarkProprietaire) {
        brouillon.highWaterMarkProprietaire = montant;
      }
      break;
    }
    case "REVENU_ACTIVITE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide += montant;
      brouillon.totalRevenusActivite += montant;
      break;
    }
    case "PERTE_ACTIVITE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide -= montant;
      brouillon.totalPertesActivite += montant;
      break;
    }
    case "DEPENSE_COMPUTE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide -= montant;
      brouillon.totalDepensesCompute += montant;
      break;
    }
    case "DEPENSE_DONNEES": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide -= montant;
      brouillon.totalDepensesDonnees += montant;
      break;
    }
    case "FRAIS_EXECUTION": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide -= montant;
      brouillon.totalFraisExecution += montant;
      break;
    }
    case "LOYER_INFRASTRUCTURE_PAYE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide -= montant;
      brouillon.totalLoyersPayes += montant;
      break;
    }
    case "REDEVANCE_PROPRIETAIRE_DUE": {
      const hwmApres = lireMontantChargeUtile(
        evenement.chargeUtile,
        "highWaterMarkApresMicroUsdc",
      );
      brouillon.highWaterMarkProprietaire = hwmApres;
      break;
    }
    case "REDEVANCE_PROPRIETAIRE_PAYEE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.capitalLiquide -= montant;
      brouillon.totalRedevancesProprietairePayees += montant;
      break;
    }
    case "DETTE_CREEE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.obligationsDues += montant;
      break;
    }
    case "DETTE_REGLEE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      brouillon.obligationsDues -= montant;
      brouillon.capitalLiquide -= montant;
      const motif = evenement.chargeUtile.motif;
      if (motif === "loyer_infrastructure") {
        brouillon.totalLoyersPayes += montant;
      } else if (motif === "redevance_proprietaire") {
        brouillon.totalRedevancesProprietairePayees += montant;
      }
      break;
    }
    case "TRANSFERT_INTERNE": {
      const montant = lireMontantChargeUtile(
        evenement.chargeUtile,
        "montantMicroUsdc",
      );
      const sens = evenement.chargeUtile.sens;
      if (sens === "sortie") {
        brouillon.capitalLiquide -= montant;
        brouillon.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
          brouillon.highWaterMarkProprietaire,
          montant,
          "sortie",
        );
      } else if (sens === "entree") {
        brouillon.capitalLiquide += montant;
        brouillon.highWaterMarkProprietaire = ajusterHighWaterMarkTransfert(
          brouillon.highWaterMarkProprietaire,
          montant,
          "entree",
        );
      }
      break;
    }
    case "ETAT_SURVIE_MODIFIE": {
      const vers = evenement.chargeUtile.vers;
      if (typeof vers !== "string") {
        throw new Error("ETAT_SURVIE_MODIFIE : vers invalide");
      }
      brouillon.etatSurvie = transitionnerEtatSurvie(
        brouillon.etatSurvie,
        vers as EtatSurvie,
      );
      break;
    }
    case "AGENT_DORMANT": {
      const cycles = evenement.chargeUtile.cyclesDormanceConsecutifs;
      if (typeof cycles === "number") {
        brouillon.cyclesDormanceConsecutifs = cycles;
      }
      if (brouillon.etatSurvie !== "mort" && brouillon.etatSurvie !== "dormant") {
        brouillon.etatSurvie = transitionnerEtatSurvie(
          brouillon.etatSurvie,
          "dormant",
        );
      }
      break;
    }
    case "AGENT_MORT": {
      const cycles = evenement.chargeUtile.cyclesDormanceConsecutifs;
      if (typeof cycles === "number") {
        brouillon.cyclesDormanceConsecutifs = cycles;
      }
      brouillon.etatSurvie = transitionnerEtatSurvie(
        brouillon.etatSurvie,
        "mort",
      );
      break;
    }
    case "CYCLE_TERMINE": {
      if (
        typeof evenement.chargeUtile.highWaterMarkProprietaireMicroUsdc ===
        "string"
      ) {
        brouillon.highWaterMarkProprietaire = lireMontantChargeUtile(
          evenement.chargeUtile,
          "highWaterMarkProprietaireMicroUsdc",
        );
      }
      if (typeof evenement.chargeUtile.cyclesDormanceConsecutifs === "number") {
        brouillon.cyclesDormanceConsecutifs =
          evenement.chargeUtile.cyclesDormanceConsecutifs;
      }
      if (typeof evenement.chargeUtile.etatSurvie === "string") {
        brouillon.etatSurvie = transitionnerEtatSurvie(
          brouillon.etatSurvie,
          evenement.chargeUtile.etatSurvie as EtatSurvie,
        );
      }
      brouillon.dernierNumeroCycle = Math.max(
        brouillon.dernierNumeroCycle,
        evenement.numeroCycle,
      );
      break;
    }
    case "CYCLE_DEMARRE":
    case "LOYER_INFRASTRUCTURE_DU":
    case "DEPENSE_INFRASTRUCTURE_PROPRIETAIRE":
      break;
    default: {
      const _exhaustif: never = evenement.type;
      void _exhaustif;
      break;
    }
  }

  if (evenement.numeroCycle > brouillon.dernierNumeroCycle) {
    brouillon.dernierNumeroCycle = evenement.numeroCycle;
  }
}
