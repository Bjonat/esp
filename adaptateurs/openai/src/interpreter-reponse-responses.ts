/**
 * Interprétation de la réponse HTTP Responses API — sans dump de contenu.
 * Miroir de `addOutputText` du SDK (absent sur `client.post` brut).
 */

export type StatutResponsesOpenAi =
  | "completed"
  | "incomplete"
  | "failed"
  | "autre";

/**
 * États explicites de sortie structurée côté adaptateur.
 * Coût compute ≠ proposition métier valide.
 */
export type EtatResultatFournisseur =
  | "resultat_fournisseur_complet"
  | "resultat_fournisseur_incomplet"
  | "refus_fournisseur"
  | "sortie_structuree_invalide"
  | "echec_fournisseur";

export type DetailsIncompletsResponses = {
  readonly reason?: string;
};

/** Métadonnées non sensibles — jamais le prompt ni le texte métier brut. */
export type MetadonneesReponseResponses = {
  readonly id: string;
  readonly statut: StatutResponsesOpenAi;
  readonly statutBrut: string;
  readonly incompleteDetails: DetailsIncompletsResponses | null;
  readonly modele: string;
  readonly longueurOutputText: number;
  readonly typesOutputItems: readonly string[];
  readonly typesContent: readonly string[];
  readonly presenceRefusal: boolean;
  readonly inputTokens: number;
  readonly cachedTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number | null;
};

export type ReponseResponsesHttpBrute = {
  readonly id?: string;
  readonly model?: string;
  readonly status?: string;
  readonly output_text?: string;
  readonly incomplete_details?: {
    readonly reason?: string;
  } | null;
  readonly error?: { readonly message?: string; readonly code?: string } | null;
  readonly output?: readonly {
    readonly type?: string;
    readonly content?: readonly {
      readonly type?: string;
      readonly text?: string;
      readonly refusal?: string;
    }[];
  }[];
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly input_tokens_details?: {
      readonly cached_tokens?: number;
    };
    readonly output_tokens_details?: {
      readonly reasoning_tokens?: number;
    };
  };
};

export type ExtractionSortieResponses = {
  readonly texte: string;
  readonly metadonnees: MetadonneesReponseResponses;
};

/**
 * Équivalent de `addOutputText` du SDK OpenAI.
 * `client.post("/responses")` ne l'applique pas — d'où le premier smoke « JSON invalide ».
 */
export function extraireTexteOutputResponses(
  reponse: ReponseResponsesHttpBrute,
): string {
  if (typeof reponse.output_text === "string" && reponse.output_text.length > 0) {
    return reponse.output_text;
  }
  const textes: string[] = [];
  for (const item of reponse.output ?? []) {
    if (item.type !== "message") {
      continue;
    }
    for (const contenu of item.content ?? []) {
      if (contenu.type === "output_text" && typeof contenu.text === "string") {
        textes.push(contenu.text);
      }
    }
  }
  return textes.join("");
}

export function detecterPresenceRefusal(
  reponse: ReponseResponsesHttpBrute,
): boolean {
  for (const item of reponse.output ?? []) {
    if (item.type !== "message") {
      continue;
    }
    for (const contenu of item.content ?? []) {
      if (contenu.type === "refusal") {
        return true;
      }
      if (
        typeof contenu.refusal === "string" &&
        contenu.refusal.trim().length > 0
      ) {
        return true;
      }
    }
  }
  return false;
}

export function normaliserStatutResponses(
  statutBrut: string | undefined,
): StatutResponsesOpenAi {
  if (statutBrut === "completed") return "completed";
  if (statutBrut === "incomplete") return "incomplete";
  if (statutBrut === "failed") return "failed";
  return "autre";
}

export function extraireMetadonneesReponseResponses(
  reponse: ReponseResponsesHttpBrute,
  texte: string,
): MetadonneesReponseResponses {
  const typesOutputItems: string[] = [];
  const typesContent: string[] = [];
  for (const item of reponse.output ?? []) {
    if (typeof item.type === "string") {
      typesOutputItems.push(item.type);
    }
    for (const contenu of item.content ?? []) {
      if (typeof contenu.type === "string") {
        typesContent.push(contenu.type);
      }
    }
  }

  const usage = reponse.usage;
  const reasoning =
    usage?.output_tokens_details?.reasoning_tokens;
  const statutBrut = reponse.status ?? "unknown";
  const incomplete = reponse.incomplete_details ?? null;

  return {
    id: reponse.id ?? "",
    statut: normaliserStatutResponses(statutBrut),
    statutBrut,
    incompleteDetails:
      incomplete === null
        ? null
        : { ...(incomplete.reason !== undefined ? { reason: incomplete.reason } : {}) },
    modele: reponse.model ?? "",
    longueurOutputText: texte.length,
    typesOutputItems,
    typesContent,
    presenceRefusal: detecterPresenceRefusal(reponse),
    inputTokens: usage?.input_tokens ?? 0,
    cachedTokens: usage?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    reasoningTokens: typeof reasoning === "number" ? reasoning : null,
  };
}

export function extraireSortieResponses(
  reponse: ReponseResponsesHttpBrute,
): ExtractionSortieResponses {
  const texte = extraireTexteOutputResponses(reponse);
  return {
    texte,
    metadonnees: extraireMetadonneesReponseResponses(reponse, texte),
  };
}

/**
 * Une sortie n'est candidate à la validation métier structurée
 * que si le fournisseur a terminé complètement, sans refusal.
 */
export function sortieCandidateValidationMetier(
  metadonnees: MetadonneesReponseResponses,
): boolean {
  return (
    metadonnees.statut === "completed" &&
    !metadonnees.presenceRefusal
  );
}
