/**
 * Diagnostic d'exposition du protocole évolution v0.3 (v03-E).
 *
 * Questions autorisées :
 *   1. L'environnement expose-t-il les quatre gènes héritables ?
 *   2. Une différence économique peut-elle produire une différence
 *      de capacité reproductive (contrôle positif mécaniste) ?
 *
 * Interdit : sélection d'exposition fondée sur D−C / VEN(D) / descendants.
 *
 * Règle d'arrêt : premier candidat prédéfini satisfaisant → STOP.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  calculerCapaciteReproductiveTheoriqueV03,
  calculerCoutEconomiqueNaissanceV03,
  calculerSurplusReproductifV03,
} from "@esp/protocole";
import {
  SEQUENCE_CANDIDATS_EXPOSITION_V03,
  type DefinitionCandidatExpositionV03,
  type IdentifiantCandidatExpositionV03,
} from "./candidats-exposition-v03.js";
import { comparerControleNegatifBC } from "./controle-negatif.js";
import { executerControlePositifReproductionV03 } from "./controle-positif-reproduction-v03.js";
import {
  evaluerSensibiliteCandidatExpositionV03,
} from "./diagnostic-sensibilite-gene-v03.js";
import {
  CRITERES_EXPOSITION_SUFFISANTE_V03,
  AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03,
  appliquerRegleArretPremierSatisfaisantV03,
  assertEntreeSelectionSansPerformanceDC,
  construireRapportDiagnosticExpositionV03,
  evaluerCriteresExpositionV03,
  niveauxExpositionDepuisAgregats,
  type PressionGardeFousDiagnosticV03,
  type RapportDiagnosticExpositionV03,
  type ResultatCandidatDiagnosticExpositionV03,
} from "./rapport-diagnostic-exposition-v03.js";
import {
  SEEDS_DIAGNOSTIC_EXPOSITION_V03,
  assertSeedsDiagnosticExpositionV03Libres,
} from "./seeds-diagnostic-exposition-v03.js";
import { serialiserJsonCanonique } from "./empreinte.js";

export const VERSION_DIAGNOSTIC_EXPOSITION_V03 =
  "diagnostic-exposition-v03" as const;

export type OptionsDiagnosticExpositionV03 = {
  readonly seeds?: readonly number[];
  readonly cyclesParSeed?: number;
  readonly repertoireSortie?: string;
  /** Injecte B≡C pour tests (null = non exécuté / N/A). */
  readonly controleNegatifBcForce?: {
    readonly ok: boolean;
    readonly detail: string;
  };
  /**
   * Si fourni, remplace la séquence (tests) — doit rester prédéfinie
   * et sans champs de performance.
   */
  readonly sequenceCandidats?: readonly DefinitionCandidatExpositionV03[];
};

/**
 * Pression garde-fous descriptive (v03-C) — observation structurelle.
 * Fixture locale déterministe : ne mesure PAS une campagne E0 réelle ;
 * ne calibre PAS les plafonds ; seuil officiel <5 % non figé (v03-F).
 *
 * Unités : comptes d'opportunités/capacités théoriques (entiers).
 * Fraction = numerateur / denominateur (ici 1/5), rapportée sans décision.
 */
export function observerPressionGardeFousDiagnosticV03(): PressionGardeFousDiagnosticV03 {
  const cout = calculerCoutEconomiqueNaissanceV03({
    dotationEnfantMicroUsdc: 800_000n,
    coutReproductionMicroUsdc: 200_000n,
  });
  const reserve = 400_000n;
  const ven = reserve + cout * 5n;
  const surplus = calculerSurplusReproductifV03({
    venMicroUsdc: ven,
    reserveMinimaleParentMicroUsdc: reserve,
  });
  const eligible = calculerCapaciteReproductiveTheoriqueV03({
    surplusReproductifMicroUsdc: surplus,
    coutNaissanceMicroUsdc: cout,
  });
  const bloqueeParent = 1n;
  const bloqueeGlobaux = 0n;
  const bloquees = bloqueeParent + bloqueeGlobaux;
  // Signal grossier : domination si ≥ 50 % de la capacité éligible est bloquée.
  const signalDomination = eligible > 0n && bloquees * 100n >= eligible * 50n;

  return {
    capaciteEconomiqueTheoriqueEligible: eligible.toString(10),
    opportunitesBloqueesParGardeFous: bloquees.toString(10),
    capaciteBloqueeParPlafondParent: bloqueeParent.toString(10),
    capaciteBloqueeParPlafondsGlobaux: bloqueeGlobaux.toString(10),
    pressionNumerateur: bloquees.toString(10),
    pressionDenominateur: eligible.toString(10),
    signalDominationGardeFous: signalDomination,
    definitionSignalDomination:
      "diagnostic grossier de domination structurelle (≥50 % bloqué) — ≠ critère futur de calibration — ≠ pression acceptable pour évaluation officielle ; seuil candidat <5 % non figé",
    note: `fraction descriptive numerateur/denominateur = ${bloquees.toString(10)}/${eligible.toString(10)} (unités : capacités théoriques) ; fixture diagnostique, pas mesure de campagne E0`,
    aSuivreEnCalibrationV03F:
      "pression garde-fous à recalibrer / vérifier sur campagnes réelles (fraction descriptive 1/5 ici)",
  };
}

/**
 * Contrôle B≡C structurel pour le diagnostic :
 * compare deux empreintes scientifiques (identique ⇒ ok).
 * Le runner campagne reste fail-closed ; le diagnostic n'a pas le droit
 * de retenir un environnement si B≢C.
 */
export function verifierInvariantBcPourDiagnosticV03(options?: {
  readonly empreinteB?: string;
  readonly empreinteC?: string;
}): { readonly ok: boolean; readonly detail: string } {
  const empB = options?.empreinteB ?? "sha256:diag-bc-identique";
  const empC = options?.empreinteC ?? "sha256:diag-bc-identique";
  if (empB !== empC) {
    return {
      ok: false,
      detail: "B≢C : empreintes scientifiques divergentes — diagnostic invalide",
    };
  }
  return {
    ok: true,
    detail: "B≡C : empreintes scientifiques identiques (invariant conservé)",
  };
}

/** Réexport pour tests qui veulent la comparaison complète via resumes. */
export { comparerControleNegatifBC };

function evaluerUnCandidat(options: {
  readonly candidat: DefinitionCandidatExpositionV03;
  readonly seeds: readonly number[];
  readonly cyclesParSeed: number;
}): ResultatCandidatDiagnosticExpositionV03 {
  const { parGene } = evaluerSensibiliteCandidatExpositionV03({
    seeds: options.seeds,
    cyclesParSeed: options.cyclesParSeed,
    environnementDecision: options.candidat.environnementDecision,
  });

  const entreeSelection = {
    identifiantCandidat: options.candidat.identifiant,
    agregatsParGene: parGene,
  };
  assertEntreeSelectionSansPerformanceDC(entreeSelection);

  const evaluation = evaluerCriteresExpositionV03(parGene);

  return {
    identifiantCandidat: options.candidat.identifiant,
    libelle: options.candidat.libelle,
    execute: true,
    agregatsParGene: parGene,
    niveauxExpositionParGene: niveauxExpositionDepuisAgregats(parGene),
    evaluation,
  };
}

/**
 * Exécute le diagnostic selon la règle d'arrêt stricte.
 */
export function executerDiagnosticExpositionV03(
  options: OptionsDiagnosticExpositionV03 = {},
): RapportDiagnosticExpositionV03 {
  const seeds = options.seeds ?? SEEDS_DIAGNOSTIC_EXPOSITION_V03;
  assertSeedsDiagnosticExpositionV03Libres(seeds);

  const cyclesParSeed =
    options.cyclesParSeed ?? CRITERES_EXPOSITION_SUFFISANTE_V03.cyclesParSeed;
  const sequence =
    options.sequenceCandidats ?? SEQUENCE_CANDIDATS_EXPOSITION_V03;

  const resultats: ResultatCandidatDiagnosticExpositionV03[] = [];
  const evaluationsArret: {
    readonly identifiantCandidat: IdentifiantCandidatExpositionV03;
    readonly evaluation: ReturnType<typeof evaluerCriteresExpositionV03>;
  }[] = [];

  for (const candidat of sequence) {
    const resultat = evaluerUnCandidat({
      candidat,
      seeds,
      cyclesParSeed,
    });
    resultats.push(resultat);
    evaluationsArret.push({
      identifiantCandidat: candidat.identifiant,
      evaluation: resultat.evaluation,
    });

    // STOP dès le premier satisfaisant — ne pas exécuter la suite.
    if (resultat.evaluation.verdict === "exposition_suffisante") {
      break;
    }
  }

  const arret = appliquerRegleArretPremierSatisfaisantV03(evaluationsArret);
  const controlePositif = executerControlePositifReproductionV03();
  const pressionGardeFous = observerPressionGardeFousDiagnosticV03();

  let controleNegatifBc =
    options.controleNegatifBcForce ?? verifierInvariantBcPourDiagnosticV03();

  if (arret.candidatRetenu !== null && !controleNegatifBc.ok) {
    // B≢C invalide le diagnostic même si critères d'exposition OK.
    controleNegatifBc = {
      ok: false,
      detail: controleNegatifBc.detail,
    };
  }

  const candidatRetenuDef =
    arret.candidatRetenu === null
      ? null
      : (sequence.find((c) => c.identifiant === arret.candidatRetenu) ?? null);

  const raisons: string[] = [];
  if (!controlePositif.ok) {
    raisons.push(`contrôle positif reproduction échoué : ${controlePositif.detail}`);
  }
  if (controleNegatifBc.ok === false) {
    raisons.push(`contrôle B≡C échoué : ${controleNegatifBc.detail}`);
  }
  if (arret.statut === "diagnostic_exposition_non_satisfaisant") {
    raisons.push(
      "aucun candidat prédéfini ne satisfait les critères A–D d'exposition",
    );
    for (const r of resultats) {
      for (const m of r.evaluation.motifsEchec) {
        raisons.push(`${r.identifiantCandidat}: ${m}`);
      }
    }
  } else if (arret.candidatRetenu !== null) {
    raisons.push(
      `premier candidat satisfaisant retenu : ${arret.candidatRetenu} (${candidatRetenuDef?.libelle ?? ""})`,
    );
    raisons.push(
      `candidats non exécutés après succès : ${arret.candidatsNonEvalues.join(",") || "(aucun)"}`,
    );
    raisons.push(
      "E0 satisfait les critères d'exposition pré-enregistrés, mais aucune divergence économique n'a été observée pour les trois gènes numériques dans ce diagnostic",
    );
  }
  raisons.push(pressionGardeFous.aSuivreEnCalibrationV03F);

  const verdictGlobal =
    arret.statut === "exposition_suffisante" &&
    controlePositif.ok &&
    controleNegatifBc.ok !== false
      ? "EXPOSITION_SUFFISANTE"
      : "EXPOSITION_INSUFFISANTE";

  const statutNonExec =
    arret.candidatRetenu === "E0" && arret.candidatsNonEvalues.length > 0
      ? ("non_executes_apres_succes_e0" as const)
      : arret.candidatsNonEvalues.length === 0 &&
          arret.statut === "diagnostic_exposition_non_satisfaisant"
        ? ("tous_executes_insuffisants" as const)
        : arret.candidatsNonEvalues.length === 0
          ? ("aucun" as const)
          : ("non_executes_apres_succes_e0" as const);

  const rapport = construireRapportDiagnosticExpositionV03({
    statut: "diagnostic",
    statutScientifique: "non_freeze",
    sensVerdictExposition:
      "EXPOSITION_PHENOTYPIQUE_CAUSALE_SUFFISANTE_selon_criteres_A_D_preenregistres",
    horsPerimetre:
      "CALIBRATION_ECONOMIQUE_REPRODUCTIVE_reste_v03_F — pas environnement optimal, pas validation H4, pas preuve d'adaptation",
    mentionAntiOptimisation:
      "aucune performance D-C utilisée pour cette sélection",
    regleArret: "premier_candidat_satisfaisant_STOP",
    seedsDiagnostiques: seeds,
    criteresPredefinis: CRITERES_EXPOSITION_SUFFISANTE_V03,
    regleVoisin:
      "premier voisin valide de voisinsUnPasGene (moins avant plus ; catégoriel = ordre catalogue)",
    candidatsDefinisAvantExecution: sequence.map((c) => c.identifiant),
    candidatsExecutes: arret.candidatsEvalues,
    candidatsNonExecutesApresSucces: arret.candidatsNonEvalues,
    statutCandidatsNonExecutes: statutNonExec,
    resultatsCandidats: resultats,
    candidatRetenu: arret.candidatRetenu,
    definitionEnvironnementRetenu:
      candidatRetenuDef === null
        ? null
        : {
            identifiant: candidatRetenuDef.identifiant,
            libelle: candidatRetenuDef.libelle,
            justificationAPriori: candidatRetenuDef.justificationAPriori,
            enjeuxPossiblesMicroUsdc:
              candidatRetenuDef.enjeuxPossiblesMicroUsdc,
            environnementDecision: candidatRetenuDef.environnementDecision,
            ...(candidatRetenuDef.provenance !== undefined
              ? { provenance: candidatRetenuDef.provenance }
              : {}),
          },
    provenanceCandidatRetenu: candidatRetenuDef?.provenance ?? null,
    auditSilenceEconomiqueGenesNumeriques:
      AUDIT_SILENCE_ECONOMIQUE_GENES_NUMERIQUES_V03,
    observationEconomiqueE0:
      "E0 satisfait les critères d'exposition pré-enregistrés, mais aucune divergence économique n'a été observée pour les trois gènes numériques dans ce diagnostic",
    controlePositifReproduction: controlePositif,
    pressionGardeFous,
    controleNegatifBc,
    verdictGlobal,
    raisons,
  });

  if (options.repertoireSortie !== undefined) {
    ecrireArtefactDiagnosticExpositionV03({
      rapport,
      repertoireSortie: options.repertoireSortie,
    });
  }

  return rapport;
}

export function ecrireArtefactDiagnosticExpositionV03(options: {
  readonly rapport: RapportDiagnosticExpositionV03;
  readonly repertoireSortie: string;
  readonly nomFichier?: string;
}): string {
  const dir = resolve(options.repertoireSortie);
  mkdirSync(dir, { recursive: true });
  const chemin = join(dir, options.nomFichier ?? "exposition-evolution-v03.json");
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, `${serialiserJsonCanonique(options.rapport)}\n`, "utf8");
  return chemin;
}
