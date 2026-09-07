/**
 * Port HTTP interne — isole le SDK OpenAI derrière une frontière.
 * Aucun type OpenAI ne traverse cette interface vers le domaine ESP.
 */
import type {
  EtatResultatFournisseur,
  MetadonneesReponseResponses,
  StatutResponsesOpenAi,
} from "./interpreter-reponse-responses.js";

export type RequeteResponsesInterne = {
  readonly modeleExterne: string;
  readonly messages: readonly {
    readonly role: "system" | "user" | "assistant";
    readonly content: string;
  }[];
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  /** Clé d'idempotence transmisible si le fournisseur la supporte. */
  readonly cleIdempotence?: string;
};

export type UsageResponsesInterne = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly reasoningTokens: number | null;
};

export type ReponseResponsesInterne = {
  readonly id: string;
  readonly modeleEffectif: string;
  /** Statut OpenAI normalisé (completed / incomplete / failed). */
  readonly statutOpenAi: StatutResponsesOpenAi;
  /** Alias historique ESP — complete ≈ completed. */
  readonly statut: "complete" | "incomplete" | "echec";
  readonly texte: string;
  readonly usage: UsageResponsesInterne;
  readonly incompleteDetails: { readonly reason?: string } | null;
  readonly presenceRefusal: boolean;
  /** Métadonnées non sensibles pour diagnostic automatisé. */
  readonly metadonnees: MetadonneesReponseResponses;
  /**
   * Texte brut — uniquement pour option CLI de diagnostic.
   * Ne doit jamais être persisté dans le registre.
   */
  readonly texteBrutDiagnostic: string;
};

export type ClientResponsesOpenAi = {
  creer(requete: RequeteResponsesInterne): Promise<ReponseResponsesInterne>;
};

export type NatureErreurClientOpenAi = "echec_certain" | "resultat_indetermine";

export class ErreurClientOpenAi extends Error {
  readonly natureEchec: NatureErreurClientOpenAi;

  constructor(
    message: string,
    options: { readonly natureEchec: NatureErreurClientOpenAi; readonly cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : {});
    this.name = "ErreurClientOpenAi";
    this.natureEchec = options.natureEchec;
  }
}

export type { EtatResultatFournisseur, MetadonneesReponseResponses, StatutResponsesOpenAi };
