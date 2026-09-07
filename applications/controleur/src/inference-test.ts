import {
  calculerValeurEconomiqueNette,
  serialiserMicroUsd,
  serialiserMicroUsdc,
} from "@esp/protocole";
import type {
  ConfigurationXway,
  DemandeInference,
  EstimationCoutInference,
  MotifRefusInference,
  PasserelleXway,
  PropositionCognitiveV01,
} from "@esp/xway";
import {
  MODELE_LOGIQUE_LUNA_REEL_V01,
  construireMessageCanoniqueDemandeInference,
  trouverTarifModele,
} from "@esp/xway";
import type { SignataireAgent } from "@esp/moteur-agent";
import {
  creerEntreeDemandeInferenceAutorisee,
  creerEntreeDemandeInferenceRecue,
  creerEntreeDemandeInferenceRefusee,
  creerEntreeInferenceEchouee,
  creerEntreeInferenceExecutee,
  type EntreeEvenementXway,
  type MicroUsdc,
} from "@esp/protocole";
import type { AgentExperience } from "./projections.js";
import { calculerLimiteDepenseCognitive } from "./budget-cognitif.js";

/** Nombre maximal d'appels réseau par commande inference-test / CLI. */
export const NOMBRE_APPELS_RESEAU_MAX_INFERENCE_TEST = 1 as const;

/**
 * Tâche cognitive v0.1 — structure déterministe, TEXTE→TEXTE.
 * Le résultat est une OBSERVATION / PROPOSITION — jamais une action économique.
 */
export function construireMessagesTacheCognitiveV01(options: {
  readonly identifiantAgent: string;
  readonly numeroCycle: number;
  readonly capitalLiquide: string;
  readonly etatSurvie: string;
}): DemandeInference["messages"] {
  const observation = {
    agent: options.identifiantAgent,
    cycle: options.numeroCycle,
    capitalLiquideMicroUsdc: options.capitalLiquide,
    etatSurvie: options.etatSurvie,
  };
  return [
    {
      role: "systeme",
      contenu:
        "Tu es un observateur ESP. Réponds UNIQUEMENT avec le JSON demandé. " +
        "Aucune action économique réelle. Pas de chain-of-thought. " +
        'Format: {"resume":"...","actionProposee":"attendre"|"agir","confiance":0..1}',
    },
    {
      role: "utilisateur",
      contenu: `Observation structurée:\n${JSON.stringify(observation)}\nPropose une action parmi attendre|agir (proposition seulement).`,
    },
  ];
}

export type ApercuInferenceTest = {
  readonly identifiantAgent: string;
  readonly venAgentMicroUsdc: string;
  readonly limiteDepenseCognitiveMicroUsdc: string;
  readonly modeleLogique: string;
  readonly modeleExterne: string | null;
  readonly nombreMaxJetonsSortie: number;
  readonly estimationMaximaleXwayMicroUsdc: string;
  readonly reservationCognitiveMaximaleMicroUsdc: string;
  readonly plafondFournisseurReelTotalMicroUsd: string | null;
  readonly depenseFournisseurEstimeeCumuleeMicroUsd: string;
  readonly plafondFournisseurReelRestantMicroUsd: string | null;
  readonly borneHauteCoutFournisseurCetAppelMicroUsd: string | null;
  readonly nombreAppelsReseauMaximum: typeof NOMBRE_APPELS_RESEAU_MAX_INFERENCE_TEST;
  readonly fournisseur: string;
  readonly autorisable: boolean;
  readonly motifRefus: MotifRefusInference | null;
  readonly detailRefus: string | null;
};

export type AuditRegistreInferenceTest = {
  readonly identifiantDemande: string;
  readonly nombreInferenceExecutee: number;
  readonly nombreAttributionsDepenseCompute: number;
  readonly montantAttribueMicroUsdc: string;
  readonly coutImputeAgentMicroUsdc: string | null;
  readonly correspondanceMontant: boolean;
  readonly attributionUnique: boolean;
};

export type DiagnosticExecutionInferenceTest = {
  readonly identifiantReponseFournisseur: string | null;
  /** Statut brut Responses API (ex. completed). */
  readonly statutFournisseurBrut: string | null;
  readonly etatResultatFournisseur: string | null;
  readonly inputTokens: number | null;
  readonly cachedTokens: number | null;
  readonly outputTokens: number | null;
  readonly reasoningTokens: number | null;
  readonly coutImputeAgentMicroUsdc: string | null;
  readonly coutFournisseurEstimeMicroUsd: string | null;
  readonly reservationInitialeMicroUsdc: string | null;
  readonly reservationLibereeMicroUsdc: string | null;
  readonly motifIncomplet: string | null;
  readonly detailResultatFournisseur: string | null;
  /** Texte brut — uniquement si option CLI explicite ; jamais persisté. */
  readonly texteBrutDiagnostic: string | null;
};

export type ResultatInferenceTest = {
  readonly apercu: ApercuInferenceTest;
  readonly statut: string;
  readonly coutImputeAgentMicroUsdc: string | null;
  readonly coutFournisseurEstimeMicroUsd: string | null;
  readonly proposition: PropositionCognitiveV01 | null;
  readonly detail?: string;
  readonly identifiantDemande?: string;
  readonly diagnostic?: DiagnosticExecutionInferenceTest;
  readonly auditRegistre?: AuditRegistreInferenceTest;
};

type ContexteDemandeInferenceTest = {
  readonly demande: DemandeInference;
  readonly limite: MicroUsdc;
  readonly ven: MicroUsdc;
};

/**
 * Construit la même DemandeInference que l'exécution réelle
 * (messages, limite, max jetons) — sans effet de bord.
 */
export function construireDemandeInferenceTest(options: {
  readonly configurationXway: ConfigurationXway;
  readonly agent: AgentExperience;
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  /** Suffixe stable pour aperçu ; l'exécution réelle utilise une séquence registre. */
  readonly suffixeDemande: string;
}): ContexteDemandeInferenceTest {
  const limite = calculerLimiteDepenseCognitive({
    etat: options.agent.etatEconomique,
    plafondComputeParCycleMicroUsdc:
      options.configurationXway.plafondComputeParCycleMicroUsdc,
  });
  const ven = calculerValeurEconomiqueNette(options.agent.etatEconomique);

  const tarif = trouverTarifModele(
    options.configurationXway.modeles,
    MODELE_LOGIQUE_LUNA_REEL_V01,
  );
  if (tarif === undefined) {
    throw new Error("Tarif luna_reel_v01 absent de la configuration figée");
  }

  const demande: DemandeInference = {
    identifiantDemande: `${options.identifiantExperience}-${options.agent.identite.identifiant}-test-${String(options.numeroCycle)}-${options.suffixeDemande}`,
    identifiantExperience: options.identifiantExperience,
    identifiantAgent: options.agent.identite.identifiant,
    numeroCycle: options.numeroCycle,
    modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
    messages: construireMessagesTacheCognitiveV01({
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      capitalLiquide: options.agent.etatEconomique.capitalLiquide.toString(10),
      etatSurvie: options.agent.etatEconomique.etatSurvie,
    }),
    nombreMaxJetonsSortie: Math.min(tarif.nombreMaxJetonsSortie, 128),
    limiteDepenseAutoriseeMicroUsdc: limite,
  };

  return { demande, limite, ven };
}

/**
 * Aperçu dry-run : mêmes estimations / contrôles que l'autorisation réelle,
 * sans réservation, sans écriture registre, sans réseau.
 */
export function calculerApercuInferenceTest(options: {
  readonly configurationXway: ConfigurationXway;
  readonly passerelle: PasserelleXway;
  readonly agent: AgentExperience;
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly signataire?: SignataireAgent;
}): ApercuInferenceTest {
  const { demande, limite, ven } = construireDemandeInferenceTest({
    configurationXway: options.configurationXway,
    agent: options.agent,
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    suffixeDemande: "apercu",
  });

  const comptePlafond = options.passerelle.obtenirComptePlafondFournisseur();
  const bareme = options.configurationXway.baremeCoutInference;
  const plafondTotal = comptePlafond.obtenirPlafondMicroUsd();
  const cumul = comptePlafond.obtenirCumuleMicroUsd();
  const restant = comptePlafond.restantMicroUsd();

  const baseCommun = {
    identifiantAgent: options.agent.identite.identifiant,
    venAgentMicroUsdc: serialiserMicroUsdc(ven),
    limiteDepenseCognitiveMicroUsdc: serialiserMicroUsdc(limite),
    modeleLogique: MODELE_LOGIQUE_LUNA_REEL_V01,
    modeleExterne: bareme?.modeleExterne ?? null,
    nombreMaxJetonsSortie: demande.nombreMaxJetonsSortie,
    plafondFournisseurReelTotalMicroUsd:
      plafondTotal === undefined ? null : serialiserMicroUsd(plafondTotal),
    depenseFournisseurEstimeeCumuleeMicroUsd: serialiserMicroUsd(cumul),
    plafondFournisseurReelRestantMicroUsd:
      restant === undefined ? null : serialiserMicroUsd(restant),
    nombreAppelsReseauMaximum: NOMBRE_APPELS_RESEAU_MAX_INFERENCE_TEST,
    fournisseur: options.configurationXway.fournisseur.identifiant,
  } as const;

  if (options.signataire !== undefined && options.signataire.statut !== "disponible") {
    return {
      ...baseCommun,
      estimationMaximaleXwayMicroUsdc: "0",
      reservationCognitiveMaximaleMicroUsdc: "0",
      borneHauteCoutFournisseurCetAppelMicroUsd: null,
      autorisable: false,
      motifRefus: "authentification_invalide",
      detailRefus: `Signataire indisponible (${options.signataire.statut})`,
    };
  }

  const estimation = options.passerelle.estimerCoutPourDemande(demande);
  if (estimation === undefined) {
    return {
      ...baseCommun,
      estimationMaximaleXwayMicroUsdc: "0",
      reservationCognitiveMaximaleMicroUsdc: "0",
      borneHauteCoutFournisseurCetAppelMicroUsd: null,
      autorisable: false,
      motifRefus: "modele_inconnu",
      detailRefus: `Modèle inconnu : ${demande.modeleDemande}`,
    };
  }

  const borneFournisseur =
    estimation.coutMaximumEstimeFournisseurMicroUsd !== undefined
      ? serialiserMicroUsd(estimation.coutMaximumEstimeFournisseurMicroUsd)
      : null;

  const avecEstimation = {
    ...baseCommun,
    estimationMaximaleXwayMicroUsdc: serialiserMicroUsdc(
      estimation.coutMaximumEstimeMicroUsdc,
    ),
    reservationCognitiveMaximaleMicroUsdc: serialiserMicroUsdc(
      estimation.coutMaximumEstimeMicroUsdc,
    ),
    borneHauteCoutFournisseurCetAppelMicroUsd: borneFournisseur,
  };

  const estimationFournisseur =
    estimation.coutMaximumEstimeFournisseurMicroUsd ?? 0n;
  if (
    options.configurationXway.fournisseur.selecteur === "openai" &&
    !comptePlafond.peutAutoriser(estimationFournisseur)
  ) {
    return {
      ...avecEstimation,
      autorisable: false,
      motifRefus: "plafond_fournisseur_reel_atteint",
      detailRefus:
        "Plafond de dépense fournisseur réelle atteint — aucune nouvelle inférence réelle",
    };
  }

  const capacite = options.passerelle.capaciteDisponiblePour(demande);
  if (estimation.coutMaximumEstimeMicroUsdc > capacite) {
    const motif: MotifRefusInference =
      estimation.coutMaximumEstimeMicroUsdc >
      demande.limiteDepenseAutoriseeMicroUsdc
        ? "budget_insuffisant"
        : "capacite_reservee_insuffisante";
    const detail =
      motif === "capacite_reservee_insuffisante"
        ? `Réservation insuffisante : estimé ${estimation.coutMaximumEstimeMicroUsdc.toString(10)} > capacité disponible ${capacite.toString(10)}`
        : `Coût max estimé ${estimation.coutMaximumEstimeMicroUsdc.toString(10)} > limite ${demande.limiteDepenseAutoriseeMicroUsdc.toString(10)}`;
    return {
      ...avecEstimation,
      autorisable: false,
      motifRefus: motif,
      detailRefus: detail,
    };
  }

  return {
    ...avecEstimation,
    autorisable: true,
    motifRefus: null,
    detailRefus: null,
  };
}

function formaterApercuDepuisEstimation(options: {
  readonly agent: AgentExperience;
  readonly configurationXway: ConfigurationXway;
  readonly passerelle: PasserelleXway;
  readonly limite: MicroUsdc;
  readonly demande: DemandeInference;
  readonly estimation: EstimationCoutInference | null;
  readonly autorisable: boolean;
  readonly motifRefus: MotifRefusInference | null;
  readonly detailRefus: string | null;
}): ApercuInferenceTest {
  const ven = calculerValeurEconomiqueNette(options.agent.etatEconomique);
  const compte = options.passerelle.obtenirComptePlafondFournisseur();
  const plafondTotal = compte.obtenirPlafondMicroUsd();
  const restant = compte.restantMicroUsd();
  const bareme = options.configurationXway.baremeCoutInference;
  return {
    identifiantAgent: options.agent.identite.identifiant,
    venAgentMicroUsdc: serialiserMicroUsdc(ven),
    limiteDepenseCognitiveMicroUsdc: serialiserMicroUsdc(options.limite),
    modeleLogique: MODELE_LOGIQUE_LUNA_REEL_V01,
    modeleExterne: bareme?.modeleExterne ?? null,
    nombreMaxJetonsSortie: options.demande.nombreMaxJetonsSortie,
    estimationMaximaleXwayMicroUsdc: serialiserMicroUsdc(
      options.estimation?.coutMaximumEstimeMicroUsdc ?? 0n,
    ),
    reservationCognitiveMaximaleMicroUsdc: serialiserMicroUsdc(
      options.estimation?.coutMaximumEstimeMicroUsdc ?? 0n,
    ),
    plafondFournisseurReelTotalMicroUsd:
      plafondTotal === undefined ? null : serialiserMicroUsd(plafondTotal),
    depenseFournisseurEstimeeCumuleeMicroUsd: serialiserMicroUsd(
      compte.obtenirCumuleMicroUsd(),
    ),
    plafondFournisseurReelRestantMicroUsd:
      restant === undefined ? null : serialiserMicroUsd(restant),
    borneHauteCoutFournisseurCetAppelMicroUsd:
      options.estimation?.coutMaximumEstimeFournisseurMicroUsd !== undefined
        ? serialiserMicroUsd(
            options.estimation.coutMaximumEstimeFournisseurMicroUsd,
          )
        : null,
    nombreAppelsReseauMaximum: NOMBRE_APPELS_RESEAU_MAX_INFERENCE_TEST,
    fournisseur: options.configurationXway.fournisseur.identifiant,
    autorisable: options.autorisable,
    motifRefus: options.motifRefus,
    detailRefus: options.detailRefus,
  };
}

/**
 * Une demande volontaire : 1 agent, 1 requête, 1 réponse, 1 débit max.
 * Hors boucle automatique du cycle.
 */
export async function executerInferenceTestVolontaire(options: {
  readonly configurationXway: ConfigurationXway;
  readonly passerelle: PasserelleXway;
  readonly agent: AgentExperience;
  readonly identifiantExperience: string;
  readonly numeroCycle: number;
  readonly prochaineSequence: () => number;
  readonly enregistrerImmediatement: (
    evenements: readonly EntreeEvenementXway[],
  ) => void;
  readonly signataire?: SignataireAgent;
  readonly dateEnregistrement?: string;
  /** Si true : expose le texte brut dans le diagnostic runtime (jamais registre). */
  readonly inclureTexteBrutDiagnostic?: boolean;
}): Promise<ResultatInferenceTest> {
  const apercuPrealable = calculerApercuInferenceTest({
    configurationXway: options.configurationXway,
    passerelle: options.passerelle,
    agent: options.agent,
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    ...(options.signataire !== undefined
      ? { signataire: options.signataire }
      : {}),
  });

  if (!apercuPrealable.autorisable) {
    return {
      apercu: apercuPrealable,
      statut: "refusee",
      coutImputeAgentMicroUsdc: null,
      coutFournisseurEstimeMicroUsd: null,
      proposition: null,
      detail: apercuPrealable.detailRefus ?? "autorisation refusee",
    };
  }

  const { demande, limite } = construireDemandeInferenceTest({
    configurationXway: options.configurationXway,
    agent: options.agent,
    identifiantExperience: options.identifiantExperience,
    numeroCycle: options.numeroCycle,
    suffixeDemande: String(options.prochaineSequence()),
  });
  const demandeExecutee = demande;

  const dateOpts =
    options.dateEnregistrement !== undefined
      ? { dateEnregistrement: options.dateEnregistrement }
      : {};

  const evenements: EntreeEvenementXway[] = [];
  evenements.push(
    creerEntreeDemandeInferenceRecue({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      identifiantDemande: demandeExecutee.identifiantDemande,
      modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
      limiteDepenseAutoriseeMicroUsdc: limite,
      indiceUnicite: options.prochaineSequence(),
      ...dateOpts,
    }),
  );

  let presentation: Parameters<PasserelleXway["autoriser"]>[0] = demandeExecutee;
  if (options.signataire !== undefined) {
    if (options.signataire.statut !== "disponible") {
      // Déjà couvert par l'aperçu — filet de sécurité.
      return {
        apercu: apercuPrealable,
        statut: "refusee",
        coutImputeAgentMicroUsdc: null,
        coutFournisseurEstimeMicroUsd: null,
        proposition: null,
        detail: "authentification_invalide",
      };
    }
    const message = construireMessageCanoniqueDemandeInference(demandeExecutee);
    const signe = options.signataire.signer(message);
    presentation = {
      demande: demandeExecutee,
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
        identifiantDemande: demandeExecutee.identifiantDemande,
        modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
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
    options.enregistrerImmediatement(evenements);
    return {
      apercu: formaterApercuDepuisEstimation({
        agent: options.agent,
        configurationXway: options.configurationXway,
        passerelle: options.passerelle,
        limite,
        demande: demandeExecutee,
        estimation: autorisation.estimation,
        autorisable: false,
        motifRefus: autorisation.motif,
        detailRefus: autorisation.detail,
      }),
      statut: "refusee",
      coutImputeAgentMicroUsdc: null,
      coutFournisseurEstimeMicroUsd: null,
      proposition: null,
      detail: autorisation.detail,
    };
  }

  const apercuComplet = formaterApercuDepuisEstimation({
    agent: options.agent,
    configurationXway: options.configurationXway,
    passerelle: options.passerelle,
    limite,
    demande: demandeExecutee,
    estimation: autorisation.estimation,
    autorisable: true,
    motifRefus: null,
    detailRefus: null,
  });

  evenements.push(
    creerEntreeDemandeInferenceAutorisee({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      identifiantDemande: demandeExecutee.identifiantDemande,
      modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
      limiteDepenseAutoriseeMicroUsdc: limite,
      coutMaximumEstimeMicroUsdc:
        autorisation.estimation.coutMaximumEstimeMicroUsdc,
      reservationMicroUsdc: autorisation.reservationMicroUsdc,
      indiceUnicite: options.prochaineSequence(),
      ...dateOpts,
    }),
  );
  options.enregistrerImmediatement(evenements);

  const resultat = await options.passerelle.executer(presentation);
  const finaux: EntreeEvenementXway[] = [];

  if (resultat.statut === "executee") {
    const prop = resultat.reponse.propositionStructuree;
    finaux.push(
      creerEntreeInferenceExecutee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identite.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantDemande: demandeExecutee.identifiantDemande,
        modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
        jetonsEntree: resultat.reponse.usage.jetonsEntree,
        jetonsSortie: resultat.reponse.usage.jetonsSortie,
        coutFinalMicroUsdc: resultat.coutFinalMicroUsdc,
        fournisseur: options.configurationXway.fournisseur.identifiant,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
        ...(resultat.coutFournisseurEstimeMicroUsd !== undefined
          ? {
              coutFournisseurEstimeMicroUsd:
                resultat.coutFournisseurEstimeMicroUsd.toString(10),
            }
          : {}),
        ...(resultat.reponse.usageFournisseur?.identifiantReponseFournisseur !==
        undefined
          ? {
              identifiantReponseFournisseur:
                resultat.reponse.usageFournisseur.identifiantReponseFournisseur,
            }
          : {}),
        ...(resultat.reponse.latenceMs !== undefined
          ? { latenceMs: resultat.reponse.latenceMs }
          : {}),
        ...(prop !== undefined
          ? {
              propositionResume: prop.resume,
              propositionAction: prop.actionProposee,
              propositionConfiance: prop.confiance,
              propositionValide: prop.valide,
            }
          : {}),
        ...(resultat.reponse.etatResultatFournisseur !== undefined
          ? {
              etatResultatFournisseur:
                resultat.reponse.etatResultatFournisseur,
            }
          : {}),
        ...(resultat.reponse.metadonneesFournisseur?.statut !== undefined
          ? {
              statutFournisseurBrut:
                resultat.reponse.metadonneesFournisseur.statut,
            }
          : {}),
        ...(resultat.reponse.usageFournisseur?.motifIncomplet !== undefined
          ? {
              motifIncomplet: resultat.reponse.usageFournisseur.motifIncomplet,
            }
          : {}),
        ...(resultat.reponse.usageFournisseur?.jetonsRaisonnement !== undefined
          ? {
              jetonsRaisonnement:
                resultat.reponse.usageFournisseur.jetonsRaisonnement,
            }
          : {}),
      }),
    );
    options.enregistrerImmediatement(finaux);

    return {
      apercu: apercuComplet,
      statut: "executee",
      coutImputeAgentMicroUsdc: resultat.coutFinalMicroUsdc.toString(10),
      coutFournisseurEstimeMicroUsd:
        resultat.coutFournisseurEstimeMicroUsd?.toString(10) ?? null,
      proposition: prop ?? null,
      identifiantDemande: demandeExecutee.identifiantDemande,
      diagnostic: {
        identifiantReponseFournisseur:
          resultat.reponse.usageFournisseur?.identifiantReponseFournisseur ??
          null,
        statutFournisseurBrut:
          resultat.reponse.metadonneesFournisseur?.statut ?? null,
        etatResultatFournisseur:
          resultat.reponse.etatResultatFournisseur ?? null,
        inputTokens: resultat.reponse.usage.jetonsEntree,
        cachedTokens: resultat.reponse.usage.jetonsEntreeCache ?? 0,
        outputTokens: resultat.reponse.usage.jetonsSortie,
        reasoningTokens:
          resultat.reponse.usageFournisseur?.jetonsRaisonnement ??
          resultat.reponse.metadonneesFournisseur?.reasoningTokens ??
          null,
        coutImputeAgentMicroUsdc: resultat.coutFinalMicroUsdc.toString(10),
        coutFournisseurEstimeMicroUsd:
          resultat.coutFournisseurEstimeMicroUsd?.toString(10) ?? null,
        reservationInitialeMicroUsdc:
          autorisation.reservationMicroUsdc.toString(10),
        reservationLibereeMicroUsdc:
          (resultat.reservationLibereeMicroUsdc ?? 0n).toString(10),
        motifIncomplet:
          resultat.reponse.usageFournisseur?.motifIncomplet ?? null,
        detailResultatFournisseur:
          resultat.reponse.detailResultatFournisseur ?? null,
        texteBrutDiagnostic: options.inclureTexteBrutDiagnostic
          ? resultat.reponse.texte
          : null,
      },
    };
  }

  if (resultat.statut === "refusee") {
    finaux.push(
      creerEntreeDemandeInferenceRefusee({
        identifiantExperience: options.identifiantExperience,
        identifiantAgent: options.agent.identite.identifiant,
        numeroCycle: options.numeroCycle,
        identifiantDemande: demandeExecutee.identifiantDemande,
        modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
        limiteDepenseAutoriseeMicroUsdc: limite,
        motifRefus: resultat.motif,
        detail: resultat.detail,
        indiceUnicite: options.prochaineSequence(),
        ...dateOpts,
      }),
    );
    options.enregistrerImmediatement(finaux);
    return {
      apercu: apercuComplet,
      statut: "refusee",
      coutImputeAgentMicroUsdc: null,
      coutFournisseurEstimeMicroUsd: null,
      proposition: null,
      detail: resultat.detail,
    };
  }

  finaux.push(
    creerEntreeInferenceEchouee({
      identifiantExperience: options.identifiantExperience,
      identifiantAgent: options.agent.identite.identifiant,
      numeroCycle: options.numeroCycle,
      identifiantDemande: demandeExecutee.identifiantDemande,
      modeleDemande: MODELE_LOGIQUE_LUNA_REEL_V01,
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
  options.enregistrerImmediatement(finaux);

  return {
    apercu: apercuComplet,
    statut: resultat.statut,
    coutImputeAgentMicroUsdc: null,
    coutFournisseurEstimeMicroUsd: null,
    proposition: null,
    detail: resultat.detail,
  };
}

/** Applique un DEPENSE_COMPUTE unique pour un coût d'inférence test. */
export function montantDepenseComputeDepuisTest(
  cout: string | null,
): MicroUsdc {
  if (cout === null) {
    return 0n;
  }
  return BigInt(cout);
}
