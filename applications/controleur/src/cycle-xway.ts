import type { EntreeEvenementXway, MicroUsdc } from "@esp/protocole";
import {
  creerEntreeDemandeInferenceAutorisee,
  creerEntreeDemandeInferenceRecue,
  creerEntreeDemandeInferenceRefusee,
  creerEntreeInferenceEchouee,
  creerEntreeInferenceExecutee,
} from "@esp/protocole";
import type {
  ConfigurationXway,
  DemandeInference,
  DemandeInferenceSignee,
  PasserelleXway,
} from "@esp/xway";
import {
  construireMessageCanoniqueDemandeInference,
  trouverTarifModele,
} from "@esp/xway";
import type { SignataireAgent } from "@esp/moteur-agent";
import type { AgentExperience } from "./projections.js";
import { calculerLimiteDepenseCognitive } from "./budget-cognitif.js";
import { deciderPolitiqueCognitiveDeveloppement } from "./politique-cognitive-developpement.js";

export type ResultatCycleXwayAgent = {
  readonly coutComputeXwayMicroUsdc: MicroUsdc;
  readonly evenements: EntreeEvenementXway[];
  readonly limiteDepenseAutoriseeMicroUsdc: MicroUsdc;
};

/**
 * Exécute la politique cognitive de développement + passerelle Xway pour un agent.
 *
 * Ordre critique pour la reprise :
 * 1. RECUE
 * 2. autoriser → AUTORISEE (réservation) ou REFUSEE
 * 3. enregistrer ces événements AVANT l'appel fournisseur
 * 4. exécuter → EXECUTEE ou ECHOUEE
 *
 * Le coût final sera agrégé en DEPENSE_COMPUTE par le noyau (une seule fois).
 */
export function executerCycleCognitifAgent(options: {
  readonly configurationXway: ConfigurationXway;
  readonly passerelle: PasserelleXway;
  readonly agent: AgentExperience;
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly graineSimulation: number;
  readonly prochaineSequence: () => number;
  readonly dateEnregistrement?: string;
  /**
   * Callback pour persister immédiatement RECUE/AUTORISEE avant l'inférence.
   * Indispensable pour reconstruire réservations et états après crash.
   */
  readonly enregistrerImmediatement?: (
    evenements: readonly EntreeEvenementXway[],
  ) => void;
  /** Si fourni, la demande est signée avant présentation à Xway. */
  readonly signataire?: SignataireAgent;
}): ResultatCycleXwayAgent {
  const limite = calculerLimiteDepenseCognitive({
    etat: options.agent.etatEconomique,
    plafondComputeParCycleMicroUsdc:
      options.configurationXway.plafondComputeParCycleMicroUsdc,
  });

  const decision = deciderPolitiqueCognitiveDeveloppement({
    graineSimulation: options.graineSimulation,
    identifiantAgent: options.agent.identite.identifiant,
    numeroCycle: options.numeroCycle,
  });

  if (decision.action === "aucun") {
    return {
      coutComputeXwayMicroUsdc: 0n,
      evenements: [],
      limiteDepenseAutoriseeMicroUsdc: limite,
    };
  }

  const tarif = trouverTarifModele(
    options.configurationXway.modeles,
    decision.modele,
  );
  const nombreMaxJetonsSortie = tarif?.nombreMaxJetonsSortie ?? 256;

  const identifiantDemande = `${options.identifiantExperience}-${options.agent.identite.identifiant}-c${String(options.numeroCycle)}-i0`;

  const demande: DemandeInference = {
    identifiantDemande,
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.agent.identite.identifiant,
    numeroCycle: options.numeroCycle,
    modeleDemande: decision.modele,
    messages: [
      {
        role: "systeme",
        contenu: "Contexte expérimental ESP — fournisseur simulé.",
      },
      {
        role: "utilisateur",
        contenu: `Agent ${options.agent.identite.identifiant} cycle ${String(options.numeroCycle)} demande ${decision.modele}.`,
      },
    ],
    nombreMaxJetonsSortie,
    limiteDepenseAutoriseeMicroUsdc: limite,
  };

  const evenements: EntreeEvenementXway[] = [];
  const dateOpts =
    options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {};

  evenements.push(
    creerEntreeDemandeInferenceRecue({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      identifiantDemande,
      modeleDemande: decision.modele,
      limiteDepenseAutoriseeMicroUsdc: limite,
      indiceUnicite: options.prochaineSequence(),
      ...dateOpts,
    }),
  );

  let presentation: DemandeInference | DemandeInferenceSignee = demande;
  if (options.signataire !== undefined) {
    if (options.signataire.statut !== "disponible") {
      evenements.push(
        creerEntreeDemandeInferenceRefusee({
          identifiantExperience: options.identifiantExperience,
          identifiantAgent: options.agent.identite.identifiant,
          numeroCycle: options.numeroCycle,
          identifiantDemande,
          modeleDemande: decision.modele,
          limiteDepenseAutoriseeMicroUsdc: limite,
          motifRefus: "authentification_invalide",
          detail: `Signataire indisponible (statut=${options.signataire.statut}) — aucune régénération`,
          indiceUnicite: options.prochaineSequence(),
          ...dateOpts,
        }),
      );
      options.enregistrerImmediatement?.(evenements);
      return {
        coutComputeXwayMicroUsdc: 0n,
        evenements,
        limiteDepenseAutoriseeMicroUsdc: limite,
      };
    }
    const message = construireMessageCanoniqueDemandeInference(demande);
    const signe = options.signataire.signer(message);
    presentation = {
      demande,
      clePubliqueBase64Url: signe.clePubliqueBase64Url,
      signatureBase64Url: signe.signatureBase64Url,
    };
  }

  const autorisation = options.passerelle.autoriser(presentation);

  if (!autorisation.autorisee) {
    evenements.push(
      creerEntreeDemandeInferenceRefusee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identite.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantDemande,
        modeleDemande: decision.modele,
        limiteDepenseAutoriseeMicroUsdc: limite,
        motifRefus: autorisation.motif,
        detail: autorisation.detail,
        ...(autorisation.estimation !== null
          ? {
              coutMaximumEstimeMicroUsdc:
                autorisation.estimation.coutMaximumEstimeMicroUsdc,
            }
          : {}),
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    );
    options.enregistrerImmediatement?.(evenements);
    return {
      coutComputeXwayMicroUsdc: 0n,
      evenements,
      limiteDepenseAutoriseeMicroUsdc: limite,
    };
  }

  evenements.push(
    creerEntreeDemandeInferenceAutorisee({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      identifiantDemande,
      modeleDemande: decision.modele,
      limiteDepenseAutoriseeMicroUsdc: limite,
      coutMaximumEstimeMicroUsdc:
        autorisation.estimation.coutMaximumEstimeMicroUsdc,
      reservationMicroUsdc: autorisation.reservationMicroUsdc,
      indiceUnicite: options.prochaineSequence(),
      ...dateOpts,
    }),
  );

  // Persister l'autorisation (réservation) AVANT l'appel fournisseur.
  options.enregistrerImmediatement?.(evenements);

  const resultat = options.passerelle.executer(presentation);
  const evenementsFinaux: EntreeEvenementXway[] = [];

  if (resultat.statut === "refusee") {
    // Ne devrait pas arriver après autorisation locale réussie.
    evenementsFinaux.push(
      creerEntreeDemandeInferenceRefusee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identite.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantDemande,
        modeleDemande: decision.modele,
        limiteDepenseAutoriseeMicroUsdc: limite,
        motifRefus: resultat.motif,
        detail: resultat.detail,
        ...(resultat.estimation !== null
          ? {
              coutMaximumEstimeMicroUsdc:
                resultat.estimation.coutMaximumEstimeMicroUsdc,
            }
          : {}),
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    );
    options.enregistrerImmediatement?.(evenementsFinaux);
    return {
      coutComputeXwayMicroUsdc: 0n,
      evenements: [...evenements, ...evenementsFinaux],
      limiteDepenseAutoriseeMicroUsdc: limite,
    };
  }

  if (
    resultat.statut === "echouee" ||
    resultat.statut === "resultat_indetermine"
  ) {
    evenementsFinaux.push(
      creerEntreeInferenceEchouee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identite.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantDemande,
        modeleDemande: decision.modele,
        detail: resultat.detail,
        natureEchec: resultat.natureEchec,
        ...(resultat.estimation !== null
          ? {
              coutMaximumEstimeMicroUsdc:
                resultat.estimation.coutMaximumEstimeMicroUsdc,
            }
          : {}),
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    );
    options.enregistrerImmediatement?.(evenementsFinaux);
    return {
      coutComputeXwayMicroUsdc: 0n,
      evenements: [...evenements, ...evenementsFinaux],
      limiteDepenseAutoriseeMicroUsdc: limite,
    };
  }

  evenementsFinaux.push(
    creerEntreeInferenceExecutee({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      identifiantDemande,
      modeleDemande: decision.modele,
      jetonsEntree: resultat.reponse.usage.jetonsEntree,
      jetonsSortie: resultat.reponse.usage.jetonsSortie,
      coutFinalMicroUsdc: resultat.coutFinalMicroUsdc,
      fournisseur: options.configurationXway.fournisseur.identifiant,
      indiceUnicite: options.prochaineSequence(),
      ...dateOpts,
    }),
  );
  options.enregistrerImmediatement?.(evenementsFinaux);

  return {
    coutComputeXwayMicroUsdc: resultat.coutFinalMicroUsdc,
    evenements: [...evenements, ...evenementsFinaux],
    limiteDepenseAutoriseeMicroUsdc: limite,
  };
}
