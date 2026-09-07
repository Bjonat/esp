import type { MicroUsdc } from "@esp/protocole";
import { authentifierDemandeInference } from "./authentification.js";
import { trouverTarifModele } from "./configuration.js";
import type {
  EtatPersistantDemandeXway,
} from "./etats-demande.js";
import {
  ErreurFournisseurInference,
  ErreurSurconsommationInference,
} from "./erreurs-fournisseur.js";
import type { FournisseurInference } from "./fournisseur.js";
import { creerFournisseurInferenceSimule } from "./fournisseur-simule.js";
import { ComptePlafondFournisseurReel } from "./plafond-fournisseur.js";
import { CompteReservationsCognitives } from "./reservations.js";
import type { DemandeInferenceSignee } from "./signature-demande.js";
import type {
  ConfigurationXway,
  DemandeInference,
  EstimationCoutInference,
  EtatDemandeInference,
  MotifRefusInference,
  NatureEchecInference,
  ResultatAutorisationInference,
  ResultatExecutionInference,
  TarifModeleInference,
} from "./types.js";

export class XwayErreur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XwayErreur";
  }
}

export type TraceDemandeXway = {
  readonly demande: DemandeInference;
  readonly etat: EtatDemandeInference;
  readonly coutFinalMicroUsdc: MicroUsdc;
  readonly motifRefus?: string;
  readonly detail?: string;
  readonly jetonsEntree?: number;
  readonly jetonsSortie?: number;
  readonly coutMaximumEstimeMicroUsdc?: MicroUsdc;
  readonly reservationMicroUsdc?: MicroUsdc;
  readonly natureEchec?: NatureEchecInference;
};

type DossierDemandeInterne = {
  demande: DemandeInference | undefined;
  etat: EtatDemandeInference;
  estimation: EstimationCoutInference | null;
  coutFinalMicroUsdc: MicroUsdc;
  jetonsEntree?: number;
  jetonsSortie?: number;
  motifRefus?: MotifRefusInference;
  detail?: string;
  natureEchec?: NatureEchecInference;
  /**
   * Autorisation issue du registre sans exécution confirmée dans ce processus.
   * Interdit le rappel automatique du fournisseur.
   */
  repriseSansConfirmationFournisseur: boolean;
  texteReponse?: string;
};

/**
 * Passerelle Xway in-process.
 * Autorise (réserve), route, mesure — ne modifie PAS le capital agent ni le registre.
 */
export class PasserelleXway {
  private readonly configuration: ConfigurationXway;
  private readonly fournisseur: FournisseurInference;
  private readonly comptes = new CompteReservationsCognitives();
  private readonly plafondFournisseur: ComptePlafondFournisseurReel;
  private readonly dossiers = new Map<string, DossierDemandeInterne>();
  private readonly traces: TraceDemandeXway[] = [];
  private readonly authentificationRequise: boolean;
  private readonly clesPubliquesParAgent: ReadonlyMap<string, string>;
  private compteurAppelsFournisseur = 0;

  constructor(options: {
    configuration: ConfigurationXway;
    fournisseur?: FournisseurInference;
    /** @deprecated préférer etatsDemandes reconstruits depuis le registre */
    demandesDejaConsommees?: readonly string[];
    etatsDemandes?: ReadonlyMap<string, EtatPersistantDemandeXway>;
    /**
     * Si true : AUTH avant estimation / réservation / fournisseur.
     * Exige une DemandeInferenceSignee.
     */
    authentificationRequise?: boolean;
    /** Clés publiques enregistrées (registre) — source de vérité. */
    clesPubliquesParAgent?: ReadonlyMap<string, string>;
    /** Restauration du plafond fournisseur réel depuis projection. */
    etatPlafondFournisseur?: {
      readonly cumuleMicroUsd: bigint;
      readonly nombreAppels: number;
    };
  }) {
    this.configuration = options.configuration;
    this.fournisseur =
      options.fournisseur ?? creerFournisseurInferenceSimule();
    this.authentificationRequise = options.authentificationRequise === true;
    this.clesPubliquesParAgent = options.clesPubliquesParAgent ?? new Map();
    this.plafondFournisseur = new ComptePlafondFournisseurReel(
      options.configuration.plafondDepenseFournisseurReelleMicroUsd,
    );
    if (options.etatPlafondFournisseur !== undefined) {
      this.plafondFournisseur.restaurer(options.etatPlafondFournisseur);
    }

    if (options.etatsDemandes !== undefined) {
      this.hydraterDepuisEtats(options.etatsDemandes);
    } else {
      for (const identifiant of options.demandesDejaConsommees ?? []) {
        this.dossiers.set(identifiant, {
          demande: undefined,
          etat: "executee",
          estimation: null,
          coutFinalMicroUsdc: 0n,
          repriseSansConfirmationFournisseur: false,
        });
      }
    }
  }

  obtenirConfiguration(): ConfigurationXway {
    return this.configuration;
  }

  obtenirTraces(): readonly TraceDemandeXway[] {
    return this.traces;
  }

  obtenirCompteReservations(): CompteReservationsCognitives {
    return this.comptes;
  }

  obtenirComptePlafondFournisseur(): ComptePlafondFournisseurReel {
    return this.plafondFournisseur;
  }

  /** Compteur de tests — appels réels au fournisseur d'inférence. */
  obtenirNombreAppelsFournisseur(): number {
    return this.compteurAppelsFournisseur;
  }

  obtenirEtatDemande(
    identifiantDemande: string,
  ): EtatDemandeInference | undefined {
    return this.dossiers.get(identifiantDemande)?.etat;
  }

  capaciteDisponiblePour(demande: DemandeInference): MicroUsdc {
    return this.comptes.capaciteDisponible(
      {
        identifiantAgent: demande.identifiantAgent,
        numeroCycle: demande.numeroCycle,
      },
      demande.limiteDepenseAutoriseeMicroUsdc,
    );
  }

  /**
   * Estimation via le fournisseur injecté — même chemin que `autoriser`,
   * sans réservation ni mutation d'état.
   */
  estimerCoutPourDemande(
    demande: DemandeInference,
  ): EstimationCoutInference | undefined {
    const tarif = this.resoudreTarif(demande.modeleDemande);
    if (tarif === undefined) {
      return undefined;
    }
    return this.fournisseur.estimerCout(demande, tarif);
  }

  /**
   * Estime, vérifie la capacité (limite − réservations − coûts réglés), réserve.
   * Si authentification requise : AUTH avant toute estimation / réservation.
   * N'appelle pas le fournisseur d'inférence.
   */
  autoriser(
    demandeOuEnveloppe: DemandeInference | DemandeInferenceSignee,
  ): ResultatAutorisationInference {
    const { demande, refusAuth } = this.resoudreDemandeAuthentifiee(
      demandeOuEnveloppe,
    );
    if (refusAuth !== undefined) {
      this.enregistrerDossier(demande, {
        etat: "refusee",
        estimation: null,
        coutFinalMicroUsdc: 0n,
        motifRefus: "authentification_invalide",
        detail: refusAuth.detail,
        repriseSansConfirmationFournisseur: false,
      });
      this.traces.push({
        demande,
        etat: "refusee",
        coutFinalMicroUsdc: 0n,
        motifRefus: "authentification_invalide",
        detail: refusAuth.detail,
      });
      return {
        autorisee: false,
        motif: "authentification_invalide",
        estimation: null,
        detail: refusAuth.detail,
      };
    }

    const existant = this.dossiers.get(demande.identifiantDemande);
    if (existant !== undefined) {
      if (existant.etat === "autorisee" && existant.estimation !== null) {
        return {
          autorisee: true,
          estimation: existant.estimation,
          reservationMicroUsdc:
            existant.estimation.coutMaximumEstimeMicroUsdc,
          dejaConnue: true,
        };
      }
      if (existant.etat === "executee") {
        return {
          autorisee: false,
          motif: "demande_deja_consommee",
          estimation: existant.estimation,
          detail: `Demande déjà exécutée : ${demande.identifiantDemande}`,
        };
      }
      if (existant.etat === "refusee") {
        return {
          autorisee: false,
          motif: existant.motifRefus ?? "demande_invalide",
          estimation: existant.estimation,
          detail:
            existant.detail ??
            `Demande déjà refusée : ${demande.identifiantDemande}`,
        };
      }
      if (existant.etat === "echouee") {
        return {
          autorisee: false,
          motif: "demande_deja_consommee",
          estimation: existant.estimation,
          detail:
            existant.detail ??
            `Demande déjà échouée : ${demande.identifiantDemande}`,
        };
      }
    }

    const tarif = this.resoudreTarif(demande.modeleDemande);
    if (tarif === undefined) {
      const refus: ResultatAutorisationInference = {
        autorisee: false,
        motif: "modele_inconnu",
        estimation: null,
        detail: `Modèle inconnu : ${demande.modeleDemande}`,
      };
      this.enregistrerDossier(demande, {
        etat: "refusee",
        estimation: null,
        coutFinalMicroUsdc: 0n,
        motifRefus: "modele_inconnu",
        detail: refus.detail,
        repriseSansConfirmationFournisseur: false,
      });
      this.traces.push({
        demande,
        etat: "refusee",
        coutFinalMicroUsdc: 0n,
        motifRefus: "modele_inconnu",
        detail: refus.detail,
      });
      return refus;
    }

    const estimation = this.fournisseur.estimerCout(demande, tarif);

    // Circuit breaker propriétaire — indépendant du budget agent.
    const estimationFournisseur =
      estimation.coutMaximumEstimeFournisseurMicroUsd ?? 0n;
    if (
      this.configuration.fournisseur.selecteur === "openai" &&
      !this.plafondFournisseur.peutAutoriser(estimationFournisseur)
    ) {
      const detail =
        "Plafond de dépense fournisseur réelle atteint — aucune nouvelle inférence réelle";
      this.enregistrerDossier(demande, {
        etat: "refusee",
        estimation,
        coutFinalMicroUsdc: 0n,
        motifRefus: "plafond_fournisseur_reel_atteint",
        detail,
        repriseSansConfirmationFournisseur: false,
      });
      this.traces.push({
        demande,
        etat: "refusee",
        coutFinalMicroUsdc: 0n,
        motifRefus: "plafond_fournisseur_reel_atteint",
        detail,
        coutMaximumEstimeMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
      });
      return {
        autorisee: false,
        motif: "plafond_fournisseur_reel_atteint",
        estimation,
        detail,
      };
    }

    const cle = {
      identifiantAgent: demande.identifiantAgent,
      numeroCycle: demande.numeroCycle,
    };
    const reservation = this.comptes.reserver({
      cle,
      identifiantDemande: demande.identifiantDemande,
      montantMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
      limiteDepenseAutoriseeMicroUsdc: demande.limiteDepenseAutoriseeMicroUsdc,
    });

    if (!reservation.ok) {
      const motif =
        reservation.motif === "capacite_insuffisante"
          ? estimation.coutMaximumEstimeMicroUsdc >
              demande.limiteDepenseAutoriseeMicroUsdc
            ? "budget_insuffisant"
            : "capacite_reservee_insuffisante"
          : "demande_deja_consommee";
      const detail =
        motif === "capacite_reservee_insuffisante"
          ? `Réservation insuffisante : estimé ${estimation.coutMaximumEstimeMicroUsdc.toString(10)} > capacité disponible ${this.comptes.capaciteDisponible(cle, demande.limiteDepenseAutoriseeMicroUsdc).toString(10)}`
          : `Coût max estimé ${estimation.coutMaximumEstimeMicroUsdc.toString(10)} > limite ${demande.limiteDepenseAutoriseeMicroUsdc.toString(10)}`;
      this.enregistrerDossier(demande, {
        etat: "refusee",
        estimation,
        coutFinalMicroUsdc: 0n,
        motifRefus: motif,
        detail,
        repriseSansConfirmationFournisseur: false,
      });
      this.traces.push({
        demande,
        etat: "refusee",
        coutFinalMicroUsdc: 0n,
        motifRefus: motif,
        detail,
        coutMaximumEstimeMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
        jetonsEntree: estimation.jetonsEntreeEstimes,
        jetonsSortie: estimation.jetonsSortieMax,
      });
      return {
        autorisee: false,
        motif,
        estimation,
        detail,
      };
    }

    this.enregistrerDossier(demande, {
      etat: "autorisee",
      estimation,
      coutFinalMicroUsdc: 0n,
      repriseSansConfirmationFournisseur: false,
    });
    this.traces.push({
      demande,
      etat: "autorisee",
      coutFinalMicroUsdc: 0n,
      coutMaximumEstimeMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
      reservationMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
      jetonsEntree: estimation.jetonsEntreeEstimes,
      jetonsSortie: estimation.jetonsSortieMax,
    });

    return {
      autorisee: true,
      estimation,
      reservationMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
    };
  }

  /**
   * Exécute après autorisation (réservation).
   * Idempotent : une demande EXECUTEE / REFUSEE / RESULTAT_INDETERMINE
   * ne rappelle jamais le fournisseur sous le même identifiant.
   */
  async executer(
    demandeOuEnveloppe: DemandeInference | DemandeInferenceSignee,
  ): Promise<ResultatExecutionInference> {
    const { demande, refusAuth } = this.resoudreDemandeAuthentifiee(
      demandeOuEnveloppe,
    );
    const dossierExistant = this.dossiers.get(demande.identifiantDemande);
    const dejaAutoriseeLocale =
      dossierExistant?.etat === "autorisee" &&
      dossierExistant.repriseSansConfirmationFournisseur === false;

    if (
      refusAuth !== undefined &&
      !dejaAutoriseeLocale &&
      dossierExistant?.etat !== "executee" &&
      dossierExistant?.etat !== "refusee" &&
      dossierExistant?.etat !== "echouee"
    ) {
      this.enregistrerDossier(demande, {
        etat: "refusee",
        estimation: null,
        coutFinalMicroUsdc: 0n,
        motifRefus: "authentification_invalide",
        detail: refusAuth.detail,
        repriseSansConfirmationFournisseur: false,
      });
      return {
        statut: "refusee",
        motif: "authentification_invalide",
        detail: refusAuth.detail,
        estimation: null,
      };
    }

    const dossier = this.dossiers.get(demande.identifiantDemande);

    if (dossier?.etat === "executee") {
      return this.reconstruireResultatExecute(demande, dossier);
    }
    if (dossier?.etat === "refusee") {
      return {
        statut: "refusee",
        motif: dossier.motifRefus ?? "demande_invalide",
        detail:
          dossier.detail ??
          `Demande déjà refusée : ${demande.identifiantDemande}`,
        estimation: dossier.estimation,
      };
    }
    if (dossier?.etat === "echouee") {
      const nature = dossier.natureEchec ?? "echec_certain";
      if (nature === "resultat_indetermine") {
        return {
          statut: "resultat_indetermine",
          detail:
            dossier.detail ??
            `Résultat indéterminé — ne pas relancer : ${demande.identifiantDemande}`,
          estimation: dossier.estimation,
          natureEchec: "resultat_indetermine",
        };
      }
      return {
        statut: "echouee",
        detail:
          dossier.detail ??
          `Demande déjà échouée : ${demande.identifiantDemande}`,
        estimation: dossier.estimation,
        natureEchec: nature,
        dejaConnue: true,
      };
    }

    if (
      dossier?.etat === "autorisee" &&
      dossier.repriseSansConfirmationFournisseur
    ) {
      dossier.etat = "echouee";
      dossier.natureEchec = "resultat_indetermine";
      dossier.detail =
        "Reprise après AUTORISEE sans confirmation fournisseur — résultat indéterminé ; ne pas relancer automatiquement";
      this.traces.push({
        demande,
        etat: "echouee",
        coutFinalMicroUsdc: 0n,
        detail: dossier.detail,
        natureEchec: "resultat_indetermine",
        ...(dossier.estimation !== null
          ? {
              coutMaximumEstimeMicroUsdc:
                dossier.estimation.coutMaximumEstimeMicroUsdc,
            }
          : {}),
      });
      return {
        statut: "resultat_indetermine",
        detail: dossier.detail,
        estimation: dossier.estimation,
        natureEchec: "resultat_indetermine",
      };
    }

    let autorisationEstimation: EstimationCoutInference;
    if (dossier?.etat === "autorisee" && dossier.estimation !== null) {
      autorisationEstimation = dossier.estimation;
    } else {
      const autorisation = this.autoriser(demandeOuEnveloppe);
      if (!autorisation.autorisee) {
        return {
          statut: "refusee",
          motif: autorisation.motif,
          detail: autorisation.detail,
          estimation: autorisation.estimation,
        };
      }
      autorisationEstimation = autorisation.estimation;
    }

    const tarif = this.resoudreTarif(demande.modeleDemande);
    if (tarif === undefined) {
      return this.echouerAvantConsommation(demande, autorisationEstimation, {
        detail: "tarif introuvable après autorisation",
        natureEchec: "echec_certain",
      });
    }

    try {
      const reponse = await this.fournisseur.inferer(demande, tarif);
      this.compteurAppelsFournisseur += 1;
      const coutFinal = reponse.usage.coutMicroUsdc;
      const reservation = autorisationEstimation.coutMaximumEstimeMicroUsdc;

      if (coutFinal > reservation) {
        // Ne PAS débiter au-delà — erreur système explicite pour réconciliation.
        const detail = `Surconsommation système : coutFinal ${coutFinal.toString(10)} > reservation ${reservation.toString(10)} — aucun débit, réservation conservée`;
        this.enregistrerDossier(demande, {
          etat: "echouee",
          estimation: autorisationEstimation,
          coutFinalMicroUsdc: 0n,
          detail,
          natureEchec: "resultat_indetermine",
          jetonsEntree: reponse.usage.jetonsEntree,
          jetonsSortie: reponse.usage.jetonsSortie,
          texteReponse: reponse.texte,
          repriseSansConfirmationFournisseur: true,
        });
        this.traces.push({
          demande,
          etat: "echouee",
          coutFinalMicroUsdc: 0n,
          detail,
          natureEchec: "resultat_indetermine",
          coutMaximumEstimeMicroUsdc: reservation,
        });
        // Expose l'erreur pour les appelants / tests tout en renvoyant l'état indéterminé.
        const erreurSurconso = new ErreurSurconsommationInference({
          coutFinalMicroUsdc: coutFinal,
          reservationMicroUsdc: reservation,
        });
        return {
          statut: "resultat_indetermine",
          detail: `${detail} [${erreurSurconso.name}]`,
          estimation: autorisationEstimation,
          natureEchec: "resultat_indetermine",
        };
      }
      if (coutFinal > demande.limiteDepenseAutoriseeMicroUsdc) {
        throw new XwayErreur(
          `Invariant Xway violé : coût final ${coutFinal.toString(10)} > limite ${demande.limiteDepenseAutoriseeMicroUsdc.toString(10)}`,
        );
      }

      this.comptes.regler({
        cle: {
          identifiantAgent: demande.identifiantAgent,
          numeroCycle: demande.numeroCycle,
        },
        identifiantDemande: demande.identifiantDemande,
        coutFinalMicroUsdc: coutFinal,
      });

      if (reponse.coutFournisseurEstimeMicroUsd !== undefined) {
        this.plafondFournisseur.enregistrerEstimationConsommee(
          reponse.coutFournisseurEstimeMicroUsd,
        );
      }

      this.enregistrerDossier(demande, {
        etat: "executee",
        estimation: autorisationEstimation,
        coutFinalMicroUsdc: coutFinal,
        jetonsEntree: reponse.usage.jetonsEntree,
        jetonsSortie: reponse.usage.jetonsSortie,
        texteReponse: reponse.texte,
        repriseSansConfirmationFournisseur: false,
      });
      this.traces.push({
        demande,
        etat: "executee",
        coutFinalMicroUsdc: coutFinal,
        jetonsEntree: reponse.usage.jetonsEntree,
        jetonsSortie: reponse.usage.jetonsSortie,
        coutMaximumEstimeMicroUsdc: reservation,
        reservationMicroUsdc: reservation,
      });

      return {
        statut: "executee",
        reponse,
        coutFinalMicroUsdc: coutFinal,
        estimation: autorisationEstimation,
        reservationLibereeMicroUsdc: reservation - coutFinal,
        ...(reponse.coutFournisseurEstimeMicroUsd !== undefined
          ? {
              coutFournisseurEstimeMicroUsd:
                reponse.coutFournisseurEstimeMicroUsd,
            }
          : {}),
      };
    } catch (erreur) {
      if (erreur instanceof XwayErreur) {
        throw erreur;
      }
      if (erreur instanceof ErreurFournisseurInference) {
        return this.echouerAvantConsommation(demande, autorisationEstimation, {
          detail: erreur.message,
          natureEchec: erreur.natureEchec,
        });
      }
      const detail = erreur instanceof Error ? erreur.message : String(erreur);
      return this.echouerAvantConsommation(demande, autorisationEstimation, {
        detail,
        natureEchec: "echec_certain",
      });
    }
  }

  /**
   * Déclare un résultat indéterminé (ex. timeout réseau futur) sans relancer.
   * Conserve la réservation — ne crée pas de DEPENSE_COMPUTE.
   */
  declarerResultatIndetermine(
    demande: DemandeInference,
    detail: string,
  ): ResultatExecutionInference {
    const dossier = this.dossiers.get(demande.identifiantDemande);
    if (dossier?.etat === "executee") {
      return this.reconstruireResultatExecute(demande, dossier);
    }
    this.enregistrerDossier(demande, {
      etat: "echouee",
      estimation: dossier?.estimation ?? null,
      coutFinalMicroUsdc: 0n,
      detail,
      natureEchec: "resultat_indetermine",
      repriseSansConfirmationFournisseur: true,
    });
    this.traces.push({
      demande,
      etat: "echouee",
      coutFinalMicroUsdc: 0n,
      detail,
      natureEchec: "resultat_indetermine",
    });
    return {
      statut: "resultat_indetermine",
      detail,
      estimation: dossier?.estimation ?? null,
      natureEchec: "resultat_indetermine",
    };
  }

  private echouerAvantConsommation(
    demande: DemandeInference,
    estimation: EstimationCoutInference,
    options: { detail: string; natureEchec: NatureEchecInference },
  ): ResultatExecutionInference {
    if (options.natureEchec === "echec_certain") {
      this.comptes.liberer({
        cle: {
          identifiantAgent: demande.identifiantAgent,
          numeroCycle: demande.numeroCycle,
        },
        identifiantDemande: demande.identifiantDemande,
      });
    }
    this.enregistrerDossier(demande, {
      etat: "echouee",
      estimation,
      coutFinalMicroUsdc: 0n,
      detail: options.detail,
      natureEchec: options.natureEchec,
      repriseSansConfirmationFournisseur:
        options.natureEchec === "resultat_indetermine",
    });
    this.traces.push({
      demande,
      etat: "echouee",
      coutFinalMicroUsdc: 0n,
      detail: options.detail,
      natureEchec: options.natureEchec,
      coutMaximumEstimeMicroUsdc: estimation.coutMaximumEstimeMicroUsdc,
    });
    if (options.natureEchec === "resultat_indetermine") {
      return {
        statut: "resultat_indetermine",
        detail: options.detail,
        estimation,
        natureEchec: "resultat_indetermine",
      };
    }
    return {
      statut: "echouee",
      detail: options.detail,
      estimation,
      natureEchec: "echec_certain",
    };
  }

  private reconstruireResultatExecute(
    demande: DemandeInference,
    dossier: DossierDemandeInterne,
  ): ResultatExecutionInference {
    const estimation: EstimationCoutInference = dossier.estimation ?? {
      jetonsEntreeEstimes: dossier.jetonsEntree ?? 0,
      jetonsSortieMax: dossier.jetonsSortie ?? 0,
      coutMaximumEstimeMicroUsdc: dossier.coutFinalMicroUsdc,
    };
    return {
      statut: "executee",
      dejaConnue: true,
      coutFinalMicroUsdc: dossier.coutFinalMicroUsdc,
      estimation,
      reponse: {
        texte:
          dossier.texteReponse ??
          `[RECONSTRUIT] demande=${demande.identifiantDemande}`,
        usage: {
          jetonsEntree: dossier.jetonsEntree ?? 0,
          jetonsSortie: dossier.jetonsSortie ?? 0,
          coutMicroUsdc: dossier.coutFinalMicroUsdc,
        },
      },
    };
  }

  private enregistrerDossier(
    demande: DemandeInference,
    partial: Omit<DossierDemandeInterne, "demande">,
  ): void {
    this.dossiers.set(demande.identifiantDemande, {
      ...partial,
      demande,
    });
  }

  private hydraterDepuisEtats(
    etats: ReadonlyMap<string, EtatPersistantDemandeXway>,
  ): void {
    for (const etat of etats.values()) {
      const estimation: EstimationCoutInference | null =
        etat.coutMaximumEstimeMicroUsdc !== undefined
          ? {
              jetonsEntreeEstimes: etat.jetonsEntree ?? 0,
              jetonsSortieMax: etat.jetonsSortie ?? 0,
              coutMaximumEstimeMicroUsdc: etat.coutMaximumEstimeMicroUsdc,
            }
          : null;

      this.dossiers.set(etat.identifiantDemande, {
        demande: undefined,
        etat: etat.etat,
        estimation,
        coutFinalMicroUsdc: etat.coutFinalMicroUsdc ?? 0n,
        ...(etat.jetonsEntree !== undefined
          ? { jetonsEntree: etat.jetonsEntree }
          : {}),
        ...(etat.jetonsSortie !== undefined
          ? { jetonsSortie: etat.jetonsSortie }
          : {}),
        ...(etat.motifRefus !== undefined ? { motifRefus: etat.motifRefus } : {}),
        ...(etat.detail !== undefined ? { detail: etat.detail } : {}),
        ...(etat.natureEchec !== undefined
          ? { natureEchec: etat.natureEchec }
          : {}),
        repriseSansConfirmationFournisseur:
          etat.repriseSansConfirmationFournisseur === true ||
          (etat.etat === "autorisee"),
      });

      const cle = {
        identifiantAgent: etat.identifiantAgent,
        numeroCycle: etat.numeroCycle,
      };

      if (
        etat.etat === "autorisee" &&
        etat.coutMaximumEstimeMicroUsdc !== undefined
      ) {
        this.comptes.restaurerReservation({
          cle,
          identifiantDemande: etat.identifiantDemande,
          montantMicroUsdc: etat.coutMaximumEstimeMicroUsdc,
        });
      } else if (
        etat.etat === "echouee" &&
        etat.natureEchec === "resultat_indetermine" &&
        etat.coutMaximumEstimeMicroUsdc !== undefined
      ) {
        // Réservation conservée tant que le résultat est indéterminé.
        this.comptes.restaurerReservation({
          cle,
          identifiantDemande: etat.identifiantDemande,
          montantMicroUsdc: etat.coutMaximumEstimeMicroUsdc,
        });
      } else if (
        etat.etat === "executee" &&
        etat.coutFinalMicroUsdc !== undefined
      ) {
        this.comptes.restaurerCoutRegle({
          cle,
          coutFinalMicroUsdc: etat.coutFinalMicroUsdc,
        });
      }
    }
  }

  private resoudreDemandeAuthentifiee(
    demandeOuEnveloppe: DemandeInference | DemandeInferenceSignee,
  ): {
    demande: DemandeInference;
    refusAuth?: { detail: string };
  } {
    const estEnveloppe = "demande" in demandeOuEnveloppe && "signatureBase64Url" in demandeOuEnveloppe;
    const demande = estEnveloppe
      ? (demandeOuEnveloppe as DemandeInferenceSignee).demande
      : (demandeOuEnveloppe as DemandeInference);

    if (!this.authentificationRequise) {
      return { demande };
    }

    if (!estEnveloppe) {
      return {
        demande,
        refusAuth: {
          detail:
            "Authentification requise : enveloppe signée absente (ESP-XWAY-INFERENCE-V1)",
        },
      };
    }

    const enveloppe = demandeOuEnveloppe as DemandeInferenceSignee;
    const auth = authentifierDemandeInference({
      enveloppe,
      clePubliqueEnregistreeBase64Url: this.clesPubliquesParAgent.get(
        enveloppe.demande.identifiantAgent,
      ),
    });
    if (!auth.ok) {
      return {
        demande: enveloppe.demande,
        refusAuth: { detail: `${auth.motif}: ${auth.detail}` },
      };
    }
    return { demande: enveloppe.demande };
  }

  private resoudreTarif(
    identifiant: DemandeInference["modeleDemande"],
  ): TarifModeleInference | undefined {
    return trouverTarifModele(this.configuration.modeles, identifiant);
  }
}

export function creerPasserelleXway(options: {
  configuration: ConfigurationXway;
  fournisseur?: FournisseurInference;
  demandesDejaConsommees?: readonly string[];
  etatsDemandes?: ReadonlyMap<string, EtatPersistantDemandeXway>;
  authentificationRequise?: boolean;
  clesPubliquesParAgent?: ReadonlyMap<string, string>;
  etatPlafondFournisseur?: {
    readonly cumuleMicroUsd: bigint;
    readonly nombreAppels: number;
  };
}): PasserelleXway {
  return new PasserelleXway(options);
}
