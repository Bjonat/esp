import type { MicroUsdc } from "@esp/protocole";
import { trouverTarifModele } from "./configuration.js";
import type {
  EtatPersistantDemandeXway,
} from "./etats-demande.js";
import type { FournisseurInference } from "./fournisseur.js";
import { creerFournisseurInferenceSimule } from "./fournisseur-simule.js";
import { CompteReservationsCognitives } from "./reservations.js";
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
  private readonly dossiers = new Map<string, DossierDemandeInterne>();
  private readonly traces: TraceDemandeXway[] = [];

  constructor(options: {
    configuration: ConfigurationXway;
    fournisseur?: FournisseurInference;
    /** @deprecated préférer etatsDemandes reconstruits depuis le registre */
    demandesDejaConsommees?: readonly string[];
    etatsDemandes?: ReadonlyMap<string, EtatPersistantDemandeXway>;
  }) {
    this.configuration = options.configuration;
    this.fournisseur =
      options.fournisseur ?? creerFournisseurInferenceSimule();

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
   * Estime, vérifie la capacité (limite − réservations − coûts réglés), réserve.
   * N'appelle pas le fournisseur d'inférence.
   */
  autoriser(demande: DemandeInference): ResultatAutorisationInference {
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
   * Idempotent : une demande EXECUTEE ne rappelle jamais le fournisseur.
   */
  executer(demande: DemandeInference): ResultatExecutionInference {
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
      // Préparation réseau : AUTORISEE reprise sans preuve d'issue fournisseur.
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
      const autorisation = this.autoriser(demande);
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
      const reponse = this.fournisseur.inferer(demande, tarif);
      const coutFinal = reponse.usage.coutMicroUsdc;

      if (coutFinal > autorisationEstimation.coutMaximumEstimeMicroUsdc) {
        throw new XwayErreur(
          `Invariant Xway violé : coût final ${coutFinal.toString(10)} > estimation max ${autorisationEstimation.coutMaximumEstimeMicroUsdc.toString(10)}`,
        );
      }
      if (coutFinal > demande.limiteDepenseAutoriseeMicroUsdc) {
        throw new XwayErreur(
          `Invariant Xway violé : coût final ${coutFinal.toString(10)} > limite ${demande.limiteDepenseAutoriseeMicroUsdc.toString(10)}`,
        );
      }

      const reservation =
        autorisationEstimation.coutMaximumEstimeMicroUsdc;
      this.comptes.regler({
        cle: {
          identifiantAgent: demande.identifiantAgent,
          numeroCycle: demande.numeroCycle,
        },
        identifiantDemande: demande.identifiantDemande,
        coutFinalMicroUsdc: coutFinal,
      });

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
        coutMaximumEstimeMicroUsdc:
          autorisationEstimation.coutMaximumEstimeMicroUsdc,
        reservationMicroUsdc: reservation,
      });

      return {
        statut: "executee",
        reponse,
        coutFinalMicroUsdc: coutFinal,
        estimation: autorisationEstimation,
        reservationLibereeMicroUsdc: reservation - coutFinal,
      };
    } catch (erreur) {
      if (erreur instanceof XwayErreur) {
        throw erreur;
      }
      const detail = erreur instanceof Error ? erreur.message : String(erreur);
      // Fournisseur simulé synchrone : échec = certain avant/ pendant sans ambiguïté réseau.
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
    return {
      statut: "echouee",
      detail: options.detail,
      estimation,
      natureEchec: options.natureEchec,
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
}): PasserelleXway {
  return new PasserelleXway(options);
}
