import OpenAI from "openai";
import type {
  ClientResponsesOpenAi,
  ReponseResponsesInterne,
  RequeteResponsesInterne,
} from "./client-responses.js";
import { ErreurClientOpenAi } from "./client-responses.js";
import {
  construireCorpsRequeteResponses,
  type CorpsRequeteResponsesApi,
} from "./corps-responses-api.js";
import {
  extraireSortieResponses,
  type ReponseResponsesHttpBrute,
} from "./interpreter-reponse-responses.js";

/**
 * Port d'envoi HTTP — permet d'inspecter le payload exact en tests
 * sans appeler `responses.create` (types SDK trop étroits pour effort "none").
 */
export type EnvoyeurResponsesOpenAi = {
  envoyer(
    corps: CorpsRequeteResponsesApi,
    options: { readonly signal: AbortSignal },
  ): Promise<ReponseResponsesHttpBrute>;
};

export function creerEnvoyeurResponsesSdk(client: OpenAI): EnvoyeurResponsesOpenAi {
  return {
    async envoyer(corps, options) {
      // client.post accepte un body JSON libre — pas de cast de ReasoningEffort.
      // Contrairement à responses.create / parse, post n'applique PAS addOutputText :
      // l'extraction se fait dans interpreter-reponse-responses.
      return client.post<ReponseResponsesHttpBrute>("/responses", {
        body: corps,
        signal: options.signal,
      });
    },
  };
}

function mapperStatutEsp(
  statutOpenAi: ReponseResponsesInterne["statutOpenAi"],
): ReponseResponsesInterne["statut"] {
  if (statutOpenAi === "completed") return "complete";
  if (statutOpenAi === "incomplete") return "incomplete";
  return "echec";
}

/**
 * Client réel Responses API — SEUL point d'import du SDK OpenAI.
 * Ne propage aucune structure OpenAI brute hors de ce module.
 *
 * Voie Structured Outputs :
 * - payload : text.format.json_schema (strict) via construireCorpsRequeteResponses ;
 * - transport : client.post (nécessaire pour reasoning.effort = "none") ;
 * - parsing : extraction output + validation locale stricte (équivalent
 *   responses.parse / output_parsed sans Zod — zodTextFormat exigerait Zod).
 */
export function creerClientResponsesOpenAi(options: {
  readonly cleApi: string;
  /** Injection tests : capturer le corps exact sans réseau. */
  readonly envoyeur?: EnvoyeurResponsesOpenAi;
}): ClientResponsesOpenAi {
  const envoyeur =
    options.envoyeur ??
    creerEnvoyeurResponsesSdk(
      new OpenAI({
        apiKey: options.cleApi,
      }),
    );

  return {
    async creer(requete: RequeteResponsesInterne): Promise<ReponseResponsesInterne> {
      const controleur = new AbortController();
      const minuteur = setTimeout(() => {
        controleur.abort();
      }, requete.timeoutMs);

      const corps = construireCorpsRequeteResponses(requete);

      try {
        const reponse = await envoyeur.envoyer(corps, {
          signal: controleur.signal,
        });

        const { texte, metadonnees } = extraireSortieResponses(reponse);

        return {
          id: metadonnees.id,
          modeleEffectif: metadonnees.modele || requete.modeleExterne,
          statutOpenAi: metadonnees.statut,
          statut: mapperStatutEsp(metadonnees.statut),
          texte,
          usage: {
            inputTokens: metadonnees.inputTokens,
            outputTokens: metadonnees.outputTokens,
            cachedInputTokens: metadonnees.cachedTokens,
            reasoningTokens: metadonnees.reasoningTokens,
          },
          incompleteDetails: metadonnees.incompleteDetails,
          presenceRefusal: metadonnees.presenceRefusal,
          metadonnees,
          texteBrutDiagnostic: texte,
        };
      } catch (erreur) {
        if (controleur.signal.aborted) {
          throw new ErreurClientOpenAi(
            "Timeout OpenAI après envoi potentiel — résultat indéterminé",
            { natureEchec: "resultat_indetermine", cause: erreur },
          );
        }
        if (estErreurReseauAmbigu(erreur)) {
          throw new ErreurClientOpenAi(
            "Erreur réseau ambiguë OpenAI — résultat indéterminé",
            { natureEchec: "resultat_indetermine", cause: erreur },
          );
        }
        throw new ErreurClientOpenAi(
          erreur instanceof Error ? erreur.message : String(erreur),
          { natureEchec: "echec_certain", cause: erreur },
        );
      } finally {
        clearTimeout(minuteur);
      }
    },
  };
}

function estErreurReseauAmbigu(erreur: unknown): boolean {
  if (!(erreur instanceof Error)) {
    return false;
  }
  const message = erreur.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("socket hang up") ||
    message.includes("network")
  );
}
