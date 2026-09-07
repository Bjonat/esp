import type { PropositionCognitiveV01 } from "@esp/xway";
import type { EtatResultatFournisseur } from "./interpreter-reponse-responses.js";
import type { MetadonneesReponseResponses } from "./interpreter-reponse-responses.js";
import { sortieCandidateValidationMetier } from "./interpreter-reponse-responses.js";

/**
 * Validation stricte côté adaptateur — équivalent local de `output_parsed`.
 * Aucune réparation permissive, aucun retry, aucun extrait ```json.
 */
export function validerPropositionCognitiveV01(
  texte: string,
): PropositionCognitiveV01 {
  try {
    const brut: unknown = JSON.parse(texte);
    if (brut === null || typeof brut !== "object" || Array.isArray(brut)) {
      return propositionInvalide("sortie non-objet");
    }
    const objet = brut as Record<string, unknown>;
    const cles = Object.keys(objet).sort();
    const attendues = ["actionProposee", "confiance", "resume"];
    if (cles.length !== 3 || cles.join(",") !== attendues.join(",")) {
      return propositionInvalide("champs schema non stricts");
    }
    const resume = objet.resume;
    const action = objet.actionProposee;
    const confiance = objet.confiance;

    if (typeof resume !== "string" || resume.trim().length === 0) {
      return propositionInvalide("resume invalide");
    }
    if (action !== "attendre" && action !== "agir") {
      return propositionInvalide("actionProposee invalide");
    }
    if (typeof confiance !== "number" || !Number.isFinite(confiance)) {
      return propositionInvalide("confiance invalide");
    }
    if (confiance < 0 || confiance > 1) {
      return propositionInvalide("confiance hors [0,1]");
    }

    return {
      resume: resume.slice(0, 500),
      actionProposee: action,
      confiance,
      valide: true,
    };
  } catch {
    return propositionInvalide("json invalide");
  }
}

/**
 * Parse officiel local (sans Zod) — candidate uniquement si statut fournisseur le permet.
 */
export function interpreterPropositionDepuisReponse(options: {
  readonly texte: string;
  readonly metadonnees: MetadonneesReponseResponses;
}): {
  readonly etat: EtatResultatFournisseur;
  readonly proposition: PropositionCognitiveV01;
  readonly detail: string;
} {
  const { texte, metadonnees } = options;

  if (metadonnees.statut === "failed" || metadonnees.statut === "autre") {
    return {
      etat: "echec_fournisseur",
      proposition: propositionInvalide(
        `statut fournisseur ${metadonnees.statutBrut}`,
      ),
      detail: `Réponse fournisseur non complétée (status=${metadonnees.statutBrut})`,
    };
  }

  if (metadonnees.presenceRefusal) {
    return {
      etat: "refus_fournisseur",
      proposition: propositionInvalide("refusal fournisseur"),
      detail: "Refusal fournisseur — proposition non actionnable",
    };
  }

  if (metadonnees.statut === "incomplete") {
    const reason = metadonnees.incompleteDetails?.reason;
    const detail =
      reason === "max_output_tokens"
        ? "Réponse incomplete : max_output_tokens atteint — proposition non actionnable"
        : `Réponse incomplete (${reason ?? "raison inconnue"}) — proposition non actionnable`;
    return {
      etat: "resultat_fournisseur_incomplet",
      proposition: propositionInvalide(
        reason === "max_output_tokens"
          ? "incomplete max_output_tokens"
          : "incomplete",
      ),
      detail,
    };
  }

  if (!sortieCandidateValidationMetier(metadonnees)) {
    return {
      etat: "sortie_structuree_invalide",
      proposition: propositionInvalide("non candidate validation"),
      detail: "Sortie non candidate à la validation métier",
    };
  }

  const proposition = validerPropositionCognitiveV01(texte);
  if (!proposition.valide) {
    return {
      etat: "sortie_structuree_invalide",
      proposition,
      detail: proposition.resume,
    };
  }

  return {
    etat: "resultat_fournisseur_complet",
    proposition,
    detail: "sortie structuree valide",
  };
}

function propositionInvalide(raison: string): PropositionCognitiveV01 {
  return {
    resume: `[sortie invalide: ${raison}]`,
    actionProposee: "attendre",
    confiance: 0,
    valide: false,
  };
}
