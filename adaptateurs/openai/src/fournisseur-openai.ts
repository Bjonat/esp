import {
  MODELE_EXTERNE_OPENAI_LUNA,
  MODELE_LOGIQUE_LUNA_REEL_V01,
  calculerCoutFournisseurEstimeMicroUsd,
  calculerCoutUsageMicroUsdc,
  compterJetonsEntreeConservateur,
  ErreurFournisseurInference,
  estimerCoutInference,
  type BaremeCoutInference,
  type DemandeInference,
  type EstimationCoutInference,
  type FournisseurInference,
  type ReponseInference,
  type TarifModeleInference,
} from "@esp/xway";
import { creerClientResponsesOpenAi } from "./client-openai-reel.js";
import type { ClientResponsesOpenAi } from "./client-responses.js";
import { ErreurClientOpenAi } from "./client-responses.js";
import { interpreterPropositionDepuisReponse } from "./validation-proposition.js";

export const NOM_VARIABLE_CLE_OPENAI = "OPENAI_API_KEY" as const;
export const TIMEOUT_INFERENCE_DEFAUT_MS = 30_000;

export type OptionsFournisseurInferenceOpenAi = {
  readonly bareme: BaremeCoutInference;
  readonly timeoutMs?: number;
  /**
   * Injection de test uniquement — aucun réseau.
   * En production : client réel créé si OPENAI_API_KEY présente.
   */
  readonly client?: ClientResponsesOpenAi;
  /** Lecture env injectable pour tests (secret absent). */
  readonly lireCleApi?: () => string | undefined;
};

/**
 * Adaptateur OpenAI réel — hors @esp/xway.
 * Texte → texte uniquement ; aucun outil ; barème figé pour estimation USD.
 */
export class FournisseurInferenceOpenAi implements FournisseurInference {
  private readonly bareme: BaremeCoutInference;
  private readonly timeoutMs: number;
  private readonly client: ClientResponsesOpenAi | undefined;
  private readonly motifIndisponibilite: string | undefined;

  constructor(options: OptionsFournisseurInferenceOpenAi) {
    this.bareme = options.bareme;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_INFERENCE_DEFAUT_MS;

    if (options.client !== undefined) {
      this.client = options.client;
      return;
    }

    const lire = options.lireCleApi ?? (() => process.env[NOM_VARIABLE_CLE_OPENAI]);
    const cle = lire();
    if (cle === undefined || cle.trim().length === 0) {
      this.client = undefined;
      this.motifIndisponibilite =
        "OPENAI_API_KEY absente — fournisseur réel indisponible (fail closed, aucun réseau)";
      return;
    }
    this.client = creerClientResponsesOpenAi({ cleApi: cle });
  }

  estDisponible(): boolean {
    return this.client !== undefined;
  }

  estimerCout(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): EstimationCoutInference {
    // Borne conservatrice avant appel — jamais sous-estimer.
    return estimerCoutInference(demande, tarif, {
      conservateur: true,
      bareme: this.bareme,
    });
  }

  async inferer(
    demande: DemandeInference,
    tarif: TarifModeleInference,
  ): Promise<ReponseInference> {
    if (this.client === undefined) {
      throw new ErreurFournisseurInference(
        this.motifIndisponibilite ?? "fournisseur openai indisponible",
        { natureEchec: "echec_certain", code: "cle_api_absente" },
      );
    }

    if (demande.modeleDemande !== MODELE_LOGIQUE_LUNA_REEL_V01) {
      throw new ErreurFournisseurInference(
        `Modèle logique non supporté par l'adaptateur OpenAI v0.1 : ${demande.modeleDemande}`,
        { natureEchec: "echec_certain", code: "modele_non_supporte" },
      );
    }

    const debut = Date.now();
    try {
      const reponseBrute = await this.client.creer({
        modeleExterne: this.bareme.modeleExterne || MODELE_EXTERNE_OPENAI_LUNA,
        messages: demande.messages.map((m) => ({
          role:
            m.role === "systeme"
              ? "system"
              : m.role === "utilisateur"
                ? "user"
                : "assistant",
          content: m.contenu,
        })),
        maxOutputTokens: Math.min(
          demande.nombreMaxJetonsSortie,
          tarif.nombreMaxJetonsSortie,
        ),
        timeoutMs: this.timeoutMs,
        cleIdempotence: demande.identifiantDemande,
      });

      const jetonsEntree = reponseBrute.usage.inputTokens;
      const jetonsSortie = reponseBrute.usage.outputTokens;
      const jetonsEntreeCache = reponseBrute.usage.cachedInputTokens;

      // Coût agent depuis usage MESURÉ + tarif ESP (pas estimation pré-appel).
      const coutImputeAgentMicroUsdc = calculerCoutUsageMicroUsdc(
        jetonsEntree,
        jetonsSortie,
        tarif,
        jetonsEntreeCache,
      );

      // ESTIMATION fournisseur depuis barème figé — distinct du coût agent.
      const coutFournisseurEstimeMicroUsd = calculerCoutFournisseurEstimeMicroUsd(
        {
          jetonsEntree,
          jetonsSortie,
          jetonsEntreeCache,
          bareme: this.bareme,
        },
      );

      const interpretation = interpreterPropositionDepuisReponse({
        texte: reponseBrute.texte,
        metadonnees: reponseBrute.metadonnees,
      });

      if (interpretation.etat === "echec_fournisseur") {
        // failed / autre : pas de débit via usage nul — remonter comme échec certain
        // sauf si usage > 0 (consommation possible) → indéterminé côté passerelle via throw.
        if (jetonsEntree + jetonsSortie > 0) {
          // Consommation mesurée malgré statut failed — on renvoie quand même
          // une réponse facturable avec état explicite (ne pas throw).
        } else {
          throw new ErreurFournisseurInference(interpretation.detail, {
            natureEchec: "echec_certain",
            code: "reponse_fournisseur_echec",
          });
        }
      }

      const latenceMs = Date.now() - debut;
      const statutUsage =
        reponseBrute.statutOpenAi === "completed"
          ? ("complete" as const)
          : reponseBrute.statutOpenAi === "incomplete"
            ? ("incomplete" as const)
            : reponseBrute.statutOpenAi === "failed"
              ? ("echec" as const)
              : ("indetermine" as const);

      return {
        // Texte non persisté dans le registre — utile runtime uniquement.
        texte: reponseBrute.texte,
        usage: {
          jetonsEntree,
          jetonsSortie,
          jetonsEntreeCache,
          coutMicroUsdc: coutImputeAgentMicroUsdc,
        },
        usageFournisseur: {
          jetonsEntree,
          jetonsSortie,
          jetonsEntreeCache,
          identifiantReponseFournisseur: reponseBrute.id,
          modeleEffectif: reponseBrute.modeleEffectif,
          statut: statutUsage,
          ...(reponseBrute.usage.reasoningTokens !== null
            ? { jetonsRaisonnement: reponseBrute.usage.reasoningTokens }
            : {}),
          ...(reponseBrute.incompleteDetails?.reason !== undefined
            ? { motifIncomplet: reponseBrute.incompleteDetails.reason }
            : {}),
        },
        coutFournisseurEstimeMicroUsd,
        latenceMs,
        propositionStructuree: interpretation.proposition,
        etatResultatFournisseur: interpretation.etat,
        detailResultatFournisseur: interpretation.detail,
        metadonneesFournisseur: {
          identifiantReponse: reponseBrute.metadonnees.id,
          statut: reponseBrute.metadonnees.statutBrut,
          incompleteDetails: reponseBrute.metadonnees.incompleteDetails,
          modele: reponseBrute.metadonnees.modele,
          longueurOutputText: reponseBrute.metadonnees.longueurOutputText,
          typesOutputItems: reponseBrute.metadonnees.typesOutputItems,
          typesContent: reponseBrute.metadonnees.typesContent,
          presenceRefusal: reponseBrute.metadonnees.presenceRefusal,
          inputTokens: reponseBrute.metadonnees.inputTokens,
          cachedTokens: reponseBrute.metadonnees.cachedTokens,
          outputTokens: reponseBrute.metadonnees.outputTokens,
          reasoningTokens: reponseBrute.metadonnees.reasoningTokens,
        },
      };
    } catch (erreur) {
      if (erreur instanceof ErreurFournisseurInference) {
        throw erreur;
      }
      if (erreur instanceof ErreurClientOpenAi) {
        throw new ErreurFournisseurInference(erreur.message, {
          natureEchec: erreur.natureEchec,
          cause: erreur,
        });
      }
      throw new ErreurFournisseurInference(
        erreur instanceof Error ? erreur.message : String(erreur),
        { natureEchec: "echec_certain", cause: erreur },
      );
    }
  }
}

export function creerFournisseurInferenceOpenAi(
  options: OptionsFournisseurInferenceOpenAi,
): FournisseurInferenceOpenAi {
  return new FournisseurInferenceOpenAi(options);
}

/** Helper test : borne conservatrice exposée. */
export function estimerJetonsEntreeConservateurPourTest(
  messages: DemandeInference["messages"],
): number {
  return compterJetonsEntreeConservateur(messages);
}
