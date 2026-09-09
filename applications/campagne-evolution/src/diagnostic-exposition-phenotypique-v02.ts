/**
 * Diagnostic d'exposition phénotypique v0.2 — orchestration post-campagne.
 * Artefacts dérivés hors registre ; n'entrent pas dans l'empreinte scientifique.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ControleurExperience,
  reconstruireConfigurationsHeritablesDepuisEvenements,
  reconstruireIdentitesDepuisEvenements,
  type ConfigurationExperienceJson,
} from "@esp/controleur";
import type {
  CleGeneMutable,
  EvenementEconomique,
  EvenementEsp,
  ObservationOpportunite,
} from "@esp/protocole";
import {
  calculerValeurEconomiqueNette,
  configurationHeritableDepuisPolitiqueBase,
  empreinteConfigurationHeritable,
  estTypeEvenementEconomique,
  parserConfigurationHeritable,
  reconstruireEtatEconomique,
  resoudrePolitiqueDepuisConfigurationHeritable,
} from "@esp/protocole";
import {
  deciderBudgetCognitif,
  parserConfigurationPolitiqueBudgetCognitif,
} from "@esp/moteur-agent";
import {
  parserConfigurationEnvironnementOpportunites,
  type ConfigurationEnvironnementOpportunites,
} from "@esp/environnement";
import { DATE_EVENEMENTS_FIXES_EVOLUTION } from "./conditions.js";
import {
  classifierBornesCognitives,
  type ClassificationBornesCognitives,
} from "./diagnostic-bornes-cognitives.js";
import {
  executerContrefactuelUnGene,
  parametresDepuisPolitique,
  voisinsUnPasGene,
  type ResultatContrefactuelUnGene,
} from "./diagnostic-contrefactuel-un-gene.js";
import { estProtocoleEvolutionV02 } from "./protocole-versionne.js";
import type { ProtocoleCampagneEvolution } from "./protocole-versionne.js";
import type { ResumeRunEvolution } from "./resume-run.js";
import type { ManifesteBatchEvolution } from "./manifeste-batch.js";

export const CLES_GENES_DIAGNOSTIC: readonly CleGeneMutable[] = [
  "seuilEnjeuPourInferenceMicroUsdc",
  "partMaxVenParCycleBps",
  "plafondCognitifMicroUsdc",
  "comportementSansInference",
] as const;

export type LigneTraceDiagnostic = {
  readonly condition: string;
  readonly seed: number;
  readonly cycle: number;
  readonly identifiantAgent: string;
  readonly generation: number;
  readonly identifiantLignee: string;
  readonly empreinteConfiguration: string;
  readonly seuilEnjeuPourInferenceMicroUsdc: string;
  readonly partMaxVenParCycleBps: number;
  readonly plafondCognitifMicroUsdc: string;
  readonly comportementSansInference: string;
  readonly venAvantDecisionMicroUsdc: string;
  readonly etatSurvie: string;
  readonly enjeuMicroUsdc: string;
  readonly probabiliteSuccesBps: number;
  readonly gainMicroUsdc: string;
  readonly perteMicroUsdc: string;
  readonly fraisMicroUsdc: string;
  readonly utiliserInference: boolean;
  readonly modeleLogique: string | null;
  readonly limiteDepenseAutoriseeMicroUsdc: string;
  readonly motif: string;
  readonly action: string | null;
  readonly sourceDecision: string | null;
  readonly issue: string | null;
  readonly revenuMicroUsdc: string | null;
  readonly perteActiviteMicroUsdc: string | null;
  readonly fraisExecutionMicroUsdc: string | null;
  readonly coutCognitifMicroUsdc: string | null;
  readonly borneDominante: string;
  readonly bornesCoLimitantes: string;
};

export type MetriquesGeneDiagnostic = {
  readonly cleGene: CleGeneMutable;
  readonly mutationsEffectives: number;
  readonly agentsMutants: number;
  readonly agentsCyclesMutants: number;
  readonly contextsTestes: number;
  readonly contextsSensiblesUnPas: number;
  readonly expressionsCognitives: number;
  readonly expressionsComportementales: number;
  readonly consequencesEconomiquesImmediates: number;
  readonly tauxSensibiliteLocale: number | null;
  readonly tauxExpressionMutants: number | null;
  readonly seedsAvecSensibilite: readonly number[];
};

export type ResumeDiagnosticExposition = {
  readonly version: "diagnostic-exposition-phenotypique-v02";
  readonly identifiantBatch: string;
  readonly identifiantProtocole: string;
  readonly runsPrevus: number;
  readonly runsTermines: number;
  readonly runsEchoues: number;
  readonly controleNegatifBcIdentique: boolean;
  readonly evenementsDecisionnelsParCondition: Readonly<
    Record<string, number>
  >;
  readonly metriquesParGene: readonly MetriquesGeneDiagnostic[];
  readonly repartitionBornes: Readonly<Record<string, number>>;
  /** Distribution des enjeux observés (max gain/perte) — utile pour E2+. */
  readonly distributionEnjeuxObserves: Readonly<Record<string, number>>;
  /**
   * Par run : expression issue des contrefactuels de réversion (mutants).
   * Sert à la calibration F/G sans signer D−C.
   */
  readonly expressionParRun: readonly {
    readonly condition: string;
    readonly seed: number;
    readonly expressionCognitive: boolean;
    readonly expressionComportementale: boolean;
    readonly consequenceEconomiqueImmediate: boolean;
  }[];
  readonly criteresCouverture: {
    readonly integriteOk: boolean;
    readonly sensibiliteParGene: Readonly<
      Record<
        string,
        {
          readonly seedsSensibles: number;
          readonly agentCyclesSensibles: number;
          readonly atteint: boolean;
        }
      >
    >;
    readonly couvertureGlobaleAtteinte: boolean;
  };
};

function tauxOuNull(numerateur: number, denominateur: number): number | null {
  if (denominateur === 0) {
    return null;
  }
  return numerateur / denominateur;
}

function observationDepuisEvenement(
  evenement: EvenementEsp,
): ObservationOpportunite {
  const charge = evenement.chargeUtile as {
    identifiantObservation: string;
    donnees: Record<string, unknown>;
  };
  const d = charge.donnees;
  return {
    identifiantObservation: charge.identifiantObservation,
    identifiantAgent: evenement.identifiantAgent!,
    numeroCycle: evenement.numeroCycle,
    typeObservation: "opportunite_simulee",
    probabiliteSuccesBps: Number(d.probabiliteSuccesBps),
    gainSiSuccesMicroUsdc: BigInt(String(d.gainSiSuccesMicroUsdc)),
    perteSiEchecMicroUsdc: BigInt(String(d.perteSiEchecMicroUsdc)),
    fraisActionMicroUsdc: BigInt(String(d.fraisActionMicroUsdc)),
    description: String(d.description ?? ""),
    actionsAutorisees: ["attendre", "agir"],
  };
}

function chargerEvenementsRun(repertoireRun: string): {
  readonly evenements: EvenementEsp[];
  readonly configuration: ConfigurationExperienceJson;
} {
  const conf = JSON.parse(
    readFileSync(join(repertoireRun, "configuration.json"), "utf8"),
  ) as ConfigurationExperienceJson;
  const controleur = ControleurExperience.ouvrir({
    identifiantExperience: conf.identifiantExperience,
    cheminSqlite: join(repertoireRun, "esp.sqlite"),
    cheminKeystoreIdentites: join(repertoireRun, "identites"),
    datesEvenementsFixes: DATE_EVENEMENTS_FIXES_EVOLUTION,
  });
  try {
    return {
      evenements: [
        ...controleur.registre.listerParExperience(conf.identifiantExperience),
      ],
      configuration: conf,
    };
  } finally {
    controleur.fermer();
  }
}

function indexerMutationsParEnfant(
  evenements: readonly EvenementEsp[],
): Map<string, Map<CleGeneMutable, string | number | boolean>> {
  const carte = new Map<
    string,
    Map<CleGeneMutable, string | number | boolean>
  >();
  for (const e of evenements) {
    if (e.type !== "MUTATION_APPLIQUEE") {
      continue;
    }
    const enfant = String(
      (e.chargeUtile as { identifiantEnfant?: string }).identifiantEnfant ??
        e.identifiantAgent ??
        "",
    );
    const cle = String(
      (e.chargeUtile as { cleGene?: string }).cleGene ?? "",
    ) as CleGeneMutable;
    const valeurParent = (e.chargeUtile as { valeurParent?: string | number | boolean })
      .valeurParent;
    if (enfant === "" || valeurParent === undefined) {
      continue;
    }
    let genes = carte.get(enfant);
    if (genes === undefined) {
      genes = new Map();
      carte.set(enfant, genes);
    }
    genes.set(cle, valeurParent);
  }
  return carte;
}

function compterDecisionnels(evenements: readonly EvenementEsp[]): number {
  let n = 0;
  for (const e of evenements) {
    if (
      e.type === "CHOIX_COGNITIF_EFFECTUE" ||
      e.type === "DECISION_AGENT_VALIDEE" ||
      e.type === "OBSERVATION_AGENT_RECUE"
    ) {
      n += 1;
    }
  }
  return n;
}

export function analyserRunPourDiagnostic(options: {
  readonly repertoireRun: string;
  readonly condition: string;
  readonly seed: number;
}): {
  readonly lignes: LigneTraceDiagnostic[];
  readonly contrefactuels: ResultatContrefactuelUnGene[];
  readonly bornes: ClassificationBornesCognitives[];
  readonly mutationsParGene: Record<CleGeneMutable, number>;
  readonly agentsMutantsParGene: Record<CleGeneMutable, Set<string>>;
  readonly evenementsDecisionnels: number;
} {
  const { evenements, configuration } = chargerEvenementsRun(
    options.repertoireRun,
  );
  const politiqueBase = parserConfigurationPolitiqueBudgetCognitif(
    configuration.politiqueBudgetCognitif!,
  );
  const envDecision: ConfigurationEnvironnementOpportunites | undefined =
    configuration.environnementDecision !== undefined
      ? parserConfigurationEnvironnementOpportunites(
          configuration.environnementDecision,
        )
      : undefined;
  const plafondXway =
    configuration.xway?.active === true
      ? BigInt(configuration.xway.plafondComputeParCycleMicroUsdc)
      : undefined;
  const coutOp = BigInt(
    configuration.parametresEconomiques.coutOperationnelMinimalParCycleMicroUsdc,
  );
  const graine = configuration.graineSimulation ?? options.seed;

  const identites = reconstruireIdentitesDepuisEvenements(
    evenements.filter((e) => estTypeEvenementEconomique(e.type)) as EvenementEconomique[],
  );
  const heritables =
    reconstruireConfigurationsHeritablesDepuisEvenements(evenements);
  const mutationsParents = indexerMutationsParEnfant(evenements);
  const identiteParId = new Map(identites.map((i) => [i.identifiant, i]));

  const mutationsParGene = Object.fromEntries(
    CLES_GENES_DIAGNOSTIC.map((c) => [c, 0]),
  ) as Record<CleGeneMutable, number>;
  const agentsMutantsParGene = Object.fromEntries(
    CLES_GENES_DIAGNOSTIC.map((c) => [c, new Set<string>()]),
  ) as Record<CleGeneMutable, Set<string>>;

  for (const e of evenements) {
    if (e.type !== "MUTATION_APPLIQUEE") {
      continue;
    }
    const cle = String(
      (e.chargeUtile as { cleGene?: string }).cleGene ?? "",
    ) as CleGeneMutable;
    if (!CLES_GENES_DIAGNOSTIC.includes(cle)) {
      continue;
    }
    mutationsParGene[cle] += 1;
    const enfant = String(
      (e.chargeUtile as { identifiantEnfant?: string }).identifiantEnfant ??
        e.identifiantAgent ??
        "",
    );
    if (enfant !== "") {
      agentsMutantsParGene[cle]!.add(enfant);
    }
  }

  const lignes: LigneTraceDiagnostic[] = [];
  const contrefactuels: ResultatContrefactuelUnGene[] = [];
  const bornes: ClassificationBornesCognitives[] = [];

  const choixEvents = evenements.filter((e) => e.type === "CHOIX_COGNITIF_EFFECTUE");
  for (const choixEvt of choixEvents) {
    const agentId = choixEvt.identifiantAgent;
    if (agentId === undefined) {
      continue;
    }
    const cycle = choixEvt.numeroCycle;
    const obsEvt = evenements.find(
      (e) =>
        e.type === "OBSERVATION_AGENT_RECUE" &&
        e.identifiantAgent === agentId &&
        e.numeroCycle === cycle,
    );
    if (obsEvt === undefined) {
      continue;
    }
    const observation = observationDepuisEvenement(obsEvt);
    const ecoAvant = evenements.filter(
      (e) =>
        e.identifiantAgent === agentId &&
        estTypeEvenementEconomique(e.type) &&
        e.numeroCycle < cycle,
    ) as EvenementEconomique[];
    const etat = reconstruireEtatEconomique(ecoAvant, agentId);
    const ven = calculerValeurEconomiqueNette(etat);

    let heritable = heritables.get(agentId);
    if (heritable === undefined || Object.keys(heritable.parametres).length === 0) {
      heritable = configurationHeritableDepuisPolitiqueBase({
        seuilEnjeuPourInferenceMicroUsdc:
          politiqueBase.seuilEnjeuPourInferenceMicroUsdc,
        partMaxVenParCycleBps: politiqueBase.partMaxVenParCycleBps,
        plafondCognitifMicroUsdc: politiqueBase.plafondCognitifMicroUsdc,
        comportementSansInference: politiqueBase.comportementSansInference,
      });
    }
    // Prefer live CONFIGURATION_HERITEE if present
    const confHeritee = evenements.find(
      (e) =>
        e.type === "CONFIGURATION_HERITEE" &&
        e.identifiantAgent === agentId,
    );
    if (confHeritee !== undefined) {
      heritable = parserConfigurationHeritable(
        confHeritee.chargeUtile.configurationHeritable,
      );
    }

    const politique = resoudrePolitiqueDepuisConfigurationHeritable({
      politiqueBase,
      configurationHeritable: heritable,
    });
    const parametres = {
      ...parametresDepuisPolitique(politiqueBase),
      ...heritable.parametres,
    };

    const chargeChoix = choixEvt.chargeUtile as {
      utiliserInference: boolean;
      modeleLogique: string | null;
      limiteDepenseAutoriseeMicroUsdc: string;
      motif: string;
    };
    const decisionEvt = evenements.find(
      (e) =>
        e.type === "DECISION_AGENT_VALIDEE" &&
        e.identifiantAgent === agentId &&
        e.numeroCycle === cycle,
    );
    const resultatEvt = evenements.find(
      (e) =>
        e.type === "RESULTAT_ACTION_OBSERVE" &&
        e.identifiantAgent === agentId &&
        e.numeroCycle === cycle,
    );

    const choixPourBorne = deciderBudgetCognitif({
      etatEconomique: etat,
      runway: 20,
      observation,
      configuration: politique,
      ...(plafondXway !== undefined ? { plafondXwayMicroUsdc: plafondXway } : {}),
    });
    const classif = classifierBornesCognitives({
      etatEconomique: etat,
      observation,
      configuration: politique,
      choix: choixPourBorne,
      ...(plafondXway !== undefined ? { plafondXwayMicroUsdc: plafondXway } : {}),
    });
    bornes.push(classif);

    const identite = identiteParId.get(agentId);
    const action =
      decisionEvt !== undefined
        ? String((decisionEvt.chargeUtile as { action?: string }).action ?? "")
        : null;

    lignes.push({
      condition: options.condition,
      seed: options.seed,
      cycle,
      identifiantAgent: agentId,
      generation: identite?.generation ?? 0,
      identifiantLignee: identite?.identifiantLignee ?? agentId,
      empreinteConfiguration: empreinteConfigurationHeritable(heritable),
      seuilEnjeuPourInferenceMicroUsdc: String(
        parametres.seuilEnjeuPourInferenceMicroUsdc,
      ),
      partMaxVenParCycleBps: Number(parametres.partMaxVenParCycleBps),
      plafondCognitifMicroUsdc: String(parametres.plafondCognitifMicroUsdc),
      comportementSansInference: String(parametres.comportementSansInference),
      venAvantDecisionMicroUsdc: ven.toString(10),
      etatSurvie: etat.etatSurvie,
      enjeuMicroUsdc: classif.enjeuMicroUsdc,
      probabiliteSuccesBps: observation.probabiliteSuccesBps,
      gainMicroUsdc: observation.gainSiSuccesMicroUsdc.toString(10),
      perteMicroUsdc: observation.perteSiEchecMicroUsdc.toString(10),
      fraisMicroUsdc: observation.fraisActionMicroUsdc.toString(10),
      utiliserInference: chargeChoix.utiliserInference,
      modeleLogique: chargeChoix.modeleLogique,
      limiteDepenseAutoriseeMicroUsdc: String(
        chargeChoix.limiteDepenseAutoriseeMicroUsdc,
      ),
      motif: chargeChoix.motif,
      action,
      sourceDecision:
        decisionEvt !== undefined
          ? String(
              (decisionEvt.chargeUtile as { sourceDecision?: string })
                .sourceDecision ?? "",
            )
          : null,
      issue:
        resultatEvt !== undefined
          ? String((resultatEvt.chargeUtile as { issue?: string }).issue ?? "")
          : null,
      revenuMicroUsdc:
        resultatEvt !== undefined
          ? String(
              (resultatEvt.chargeUtile as { revenuActiviteMicroUsdc?: string })
                .revenuActiviteMicroUsdc ?? "0",
            )
          : null,
      perteActiviteMicroUsdc:
        resultatEvt !== undefined
          ? String(
              (resultatEvt.chargeUtile as { perteActiviteMicroUsdc?: string })
                .perteActiviteMicroUsdc ?? "0",
            )
          : null,
      fraisExecutionMicroUsdc:
        resultatEvt !== undefined
          ? String(
              (resultatEvt.chargeUtile as { fraisExecutionMicroUsdc?: string })
                .fraisExecutionMicroUsdc ?? "0",
            )
          : null,
      coutCognitifMicroUsdc:
        decisionEvt !== undefined
          ? String(
              (decisionEvt.chargeUtile as { coutCognitifMicroUsdc?: string })
                .coutCognitifMicroUsdc ?? "0",
            )
          : null,
      borneDominante: classif.borneDominante,
      bornesCoLimitantes: classif.bornesCoLimitantes.join("+"),
    });

    const actionObservee =
      action === "agir" || action === "attendre" ? action : undefined;

    for (const cle of CLES_GENES_DIAGNOSTIC) {
      // Sensibilité ±1 pas
      for (const voisin of voisinsUnPasGene(cle, parametres[cle]!)) {
        contrefactuels.push(
          executerContrefactuelUnGene({
            cleGene: cle,
            typeContrefactuel: "sensibilite_locale",
            valeurContrefactuelle: voisin.valeur,
            politiqueBase,
            parametresReels: parametres,
            etatEconomique: etat,
            observation,
            coutOperationnelMinimalParCycleMicroUsdc: coutOp,
            ...(plafondXway !== undefined
              ? { plafondXwayMicroUsdc: plafondXway }
              : {}),
            ...(envDecision !== undefined
              ? { environnementDecision: envDecision, graineExperience: graine }
              : {}),
            ...(actionObservee !== undefined
              ? { actionReelleObservee: actionObservee }
              : {}),
            identifiantAgent: agentId,
            numeroCycle: cycle,
          }),
        );
      }

      // Réversion mutant
      const parentVals = mutationsParents.get(agentId);
      const valeurParent = parentVals?.get(cle);
      if (valeurParent !== undefined && String(valeurParent) !== String(parametres[cle])) {
        contrefactuels.push(
          executerContrefactuelUnGene({
            cleGene: cle,
            typeContrefactuel: "reversion",
            valeurContrefactuelle: valeurParent,
            politiqueBase,
            parametresReels: parametres,
            etatEconomique: etat,
            observation,
            coutOperationnelMinimalParCycleMicroUsdc: coutOp,
            ...(plafondXway !== undefined
              ? { plafondXwayMicroUsdc: plafondXway }
              : {}),
            ...(envDecision !== undefined
              ? { environnementDecision: envDecision, graineExperience: graine }
              : {}),
            ...(actionObservee !== undefined
              ? { actionReelleObservee: actionObservee }
              : {}),
            identifiantAgent: agentId,
            numeroCycle: cycle,
          }),
        );
      }
    }
  }

  return {
    lignes,
    contrefactuels,
    bornes,
    mutationsParGene,
    agentsMutantsParGene,
    evenementsDecisionnels: compterDecisionnels(evenements),
  };
}

function agregerMetriques(options: {
  readonly analyses: readonly ReturnType<typeof analyserRunPourDiagnostic>[];
  readonly conditionsSeeds: readonly {
    condition: string;
    seed: number;
    analyseIndex: number;
  }[];
}): {
  readonly metriquesParGene: MetriquesGeneDiagnostic[];
  readonly repartitionBornes: Record<string, number>;
} {
  const repartitionBornes: Record<string, number> = {};
  const metriquesParGene: MetriquesGeneDiagnostic[] = [];

  for (const a of options.analyses) {
    for (const b of a.bornes) {
      const cle =
        b.borneDominante === "egalite"
          ? `egalite:${b.bornesCoLimitantes.join("+")}`
          : b.borneDominante;
      repartitionBornes[cle] = (repartitionBornes[cle] ?? 0) + 1;
    }
  }

  for (const cle of CLES_GENES_DIAGNOSTIC) {
    let mutationsEffectives = 0;
    const agentsMutants = new Set<string>();
    let agentsCyclesMutants = 0;
    let contextsTestes = 0;
    let contextsSensiblesUnPas = 0;
    let expressionsCognitives = 0;
    let expressionsComportementales = 0;
    let consequencesEconomiquesImmediates = 0;
    const seedsSensibles = new Set<number>();

    for (const meta of options.conditionsSeeds) {
      const a = options.analyses[meta.analyseIndex]!;
      mutationsEffectives += a.mutationsParGene[cle] ?? 0;
      for (const id of a.agentsMutantsParGene[cle] ?? []) {
        agentsMutants.add(id);
      }

      // Grouper : un contexte = un agent×cycle (ligne de trace).
      const nLignes = a.lignes.length;
      contextsTestes += nLignes;

      let sensiblesRun = 0;
      for (const ligne of a.lignes) {
        const cfLigne = a.contrefactuels.filter(
          (c) =>
            c.cleGene === cle &&
            c.typeContrefactuel === "sensibilite_locale" &&
            c.identifiantAgent === ligne.identifiantAgent &&
            c.numeroCycle === ligne.cycle,
        );
        const sensible = cfLigne.some(
          (c) => c.expressionCognitive || c.expressionComportementale,
        );
        if (sensible) {
          sensiblesRun += 1;
        }
      }
      contextsSensiblesUnPas += sensiblesRun;
      if (sensiblesRun > 0) {
        seedsSensibles.add(meta.seed);
      }

      for (const ligne of a.lignes) {
        if (a.agentsMutantsParGene[cle]?.has(ligne.identifiantAgent)) {
          agentsCyclesMutants += 1;
        }
      }

      const cfRev = a.contrefactuels.filter(
        (c) => c.cleGene === cle && c.typeContrefactuel === "reversion",
      );
      expressionsCognitives += cfRev.filter((c) => c.expressionCognitive).length;
      expressionsComportementales += cfRev.filter(
        (c) => c.expressionComportementale,
      ).length;
      consequencesEconomiquesImmediates += cfRev.filter(
        (c) => c.consequenceEconomiqueImmediate,
      ).length;
    }

    metriquesParGene.push({
      cleGene: cle,
      mutationsEffectives,
      agentsMutants: agentsMutants.size,
      agentsCyclesMutants,
      contextsTestes,
      contextsSensiblesUnPas,
      expressionsCognitives,
      expressionsComportementales,
      consequencesEconomiquesImmediates,
      tauxSensibiliteLocale: tauxOuNull(
        contextsSensiblesUnPas,
        contextsTestes,
      ),
      tauxExpressionMutants: tauxOuNull(
        expressionsCognitives,
        agentsCyclesMutants,
      ),
      seedsAvecSensibilite: [...seedsSensibles].sort((a, b) => a - b),
    });
  }

  return { metriquesParGene, repartitionBornes };
}

function echapperCsv(valeur: string | number | boolean | null): string {
  const t = valeur === null ? "" : String(valeur);
  if (t.includes(",") || t.includes('"') || t.includes("\n")) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

function serialiserCsv(lignes: readonly LigneTraceDiagnostic[]): string {
  if (lignes.length === 0) {
    return "";
  }
  const cles = Object.keys(lignes[0]!) as (keyof LigneTraceDiagnostic)[];
  const header = cles.join(",");
  const rows = lignes.map((l) =>
    cles.map((c) => echapperCsv(l[c] as string | number | boolean | null)).join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}

function rendreRapportMarkdown(resume: ResumeDiagnosticExposition): string {
  const lignes: string[] = [
    "# Rapport diagnostic expression phénotypique v0.2",
    "",
    "## 1. Validité technique",
    "",
    `- Runs prévus : ${String(resume.runsPrevus)}`,
    `- Runs terminés : ${String(resume.runsTermines)}`,
    `- Runs échoués : ${String(resume.runsEchoues)}`,
    `- Intégrité critères : ${resume.criteresCouverture.integriteOk ? "OK" : "NON"}`,
    "",
    "## 2. B/C",
    "",
    `- Contrôle négatif B/C scientifiquement identiques : ${
      resume.controleNegatifBcIdentique ? "oui" : "non"
    }`,
    "",
    "## 3. Événements décisionnels",
    "",
  ];
  for (const [cond, n] of Object.entries(
    resume.evenementsDecisionnelsParCondition,
  )) {
    lignes.push(`- ${cond} : ${String(n)}`);
  }
  lignes.push("", "## 4–8. Par gène", "");
  for (const m of resume.metriquesParGene) {
    lignes.push(`### ${m.cleGene}`, "");
    lignes.push(`- mutationsEffectives : ${String(m.mutationsEffectives)}`);
    lignes.push(`- agentsMutants : ${String(m.agentsMutants)}`);
    lignes.push(`- agentsCyclesMutants : ${String(m.agentsCyclesMutants)}`);
    lignes.push(`- contextsTestes : ${String(m.contextsTestes)}`);
    lignes.push(
      `- contextsSensiblesUnPas : ${String(m.contextsSensiblesUnPas)}`,
    );
    lignes.push(
      `- seedsAvecSensibilite : ${m.seedsAvecSensibilite.join(", ") || "—"}`,
    );
    lignes.push(
      `- expressionsCognitives (réversion) : ${String(m.expressionsCognitives)}`,
    );
    lignes.push(
      `- expressionsComportementales : ${String(m.expressionsComportementales)}`,
    );
    lignes.push(
      `- consequencesEconomiquesImmediates : ${String(m.consequencesEconomiquesImmediates)}`,
    );
    lignes.push(
      `- tauxSensibiliteLocale : ${
        m.tauxSensibiliteLocale === null
          ? "null"
          : m.tauxSensibiliteLocale.toFixed(4)
      }`,
    );
    lignes.push(
      `- tauxExpressionMutants : ${
        m.tauxExpressionMutants === null
          ? "null"
          : m.tauxExpressionMutants.toFixed(4)
      }`,
    );
    lignes.push("");
  }
  lignes.push("## 9. Bornes cognitives dominantes", "");
  for (const [borne, n] of Object.entries(resume.repartitionBornes).sort()) {
    lignes.push(`- ${borne} : ${String(n)}`);
  }
  lignes.push("", "### Distribution des enjeux observés", "");
  for (const [enjeu, n] of Object.entries(
    resume.distributionEnjeuxObserves,
  ).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    lignes.push(`- enjeu ${enjeu} : ${String(n)} observations`);
  }
  lignes.push("", "## 10. Critères de couverture", "");
  for (const [gene, c] of Object.entries(
    resume.criteresCouverture.sensibiliteParGene,
  )) {
    lignes.push(
      `- ${gene} : seedsSensibles=${String(c.seedsSensibles)} agentCyclesSensibles=${String(c.agentCyclesSensibles)} atteint=${c.atteint ? "oui" : "non"}`,
    );
  }
  lignes.push(
    "",
    `- Couverture globale atteinte : ${
      resume.criteresCouverture.couvertureGlobaleAtteinte ? "oui" : "non"
    }`,
    "",
    "Ce rapport ne contient aucune conclusion économique D vs C.",
    "",
  );
  return lignes.join("\n");
}

/**
 * Critères prédéfinis de couverture phénotypique (figés avant exécution).
 */
export const CRITERES_COUVERTURE_DIAGNOSTIC_V02 = {
  seedsSensiblesMinimumParGene: 3,
  seedsTotal: 5,
  agentCyclesSensiblesMinimumParGene: 10,
} as const;

export function genererDiagnosticExpositionPhenotypique(options: {
  readonly repertoireBatch: string;
  readonly manifeste: ManifesteBatchEvolution;
  readonly resumes: readonly ResumeRunEvolution[];
  readonly controleNegatifBcIdentique: boolean;
}): ResumeDiagnosticExposition {
  const analyses: ReturnType<typeof analyserRunPourDiagnostic>[] = [];
  const meta: { condition: string; seed: number; analyseIndex: number }[] = [];
  const evenementsDecisionnelsParCondition: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };
  const toutesLignes: LigneTraceDiagnostic[] = [];

  for (const run of options.manifeste.runs) {
    if (run.statut !== "termine") {
      continue;
    }
    const repertoireRun = join(
      options.repertoireBatch,
      "runs",
      run.identifiantRun,
    );
    if (!existsSync(join(repertoireRun, "esp.sqlite"))) {
      continue;
    }
    const analyse = analyserRunPourDiagnostic({
      repertoireRun,
      condition: run.condition,
      seed: run.seed,
    });
    meta.push({
      condition: run.condition,
      seed: run.seed,
      analyseIndex: analyses.length,
    });
    analyses.push(analyse);
    evenementsDecisionnelsParCondition[run.condition] =
      (evenementsDecisionnelsParCondition[run.condition] ?? 0) +
      analyse.evenementsDecisionnels;
    toutesLignes.push(...analyse.lignes);
  }

  const { metriquesParGene, repartitionBornes } = agregerMetriques({
    analyses,
    conditionsSeeds: meta,
  });

  const distributionEnjeuxObserves: Record<string, number> = {};
  for (const ligne of toutesLignes) {
    const cle = ligne.enjeuMicroUsdc;
    distributionEnjeuxObserves[cle] =
      (distributionEnjeuxObserves[cle] ?? 0) + 1;
  }

  const expressionParRun = meta.map((m) => {
    const a = analyses[m.analyseIndex]!;
    const reversions = a.contrefactuels.filter(
      (c) => c.typeContrefactuel === "reversion",
    );
    return {
      condition: m.condition,
      seed: m.seed,
      expressionCognitive: reversions.some((c) => c.expressionCognitive),
      expressionComportementale: reversions.some(
        (c) => c.expressionComportementale,
      ),
      consequenceEconomiqueImmediate: reversions.some(
        (c) => c.consequenceEconomiqueImmediate,
      ),
    };
  });

  const runsPrevus = options.manifeste.runs.length;
  const runsTermines = options.manifeste.runs.filter(
    (r) => r.statut === "termine",
  ).length;
  const runsEchoues = options.manifeste.runs.filter(
    (r) => r.statut === "echoue",
  ).length;

  const decisionnelsBcd =
    (evenementsDecisionnelsParCondition.B ?? 0) > 0 &&
    (evenementsDecisionnelsParCondition.C ?? 0) > 0 &&
    (evenementsDecisionnelsParCondition.D ?? 0) > 0;

  const integriteOk =
    options.controleNegatifBcIdentique &&
    runsEchoues === 0 &&
    runsTermines === runsPrevus &&
    decisionnelsBcd;

  const sensibiliteParGene: Record<
    string,
    {
      readonly seedsSensibles: number;
      readonly agentCyclesSensibles: number;
      readonly atteint: boolean;
    }
  > = {};
  let couvertureGlobaleAtteinte = integriteOk;
  for (const m of metriquesParGene) {
    const seedsSensibles = m.seedsAvecSensibilite.length;
    const atteint =
      seedsSensibles >=
        CRITERES_COUVERTURE_DIAGNOSTIC_V02.seedsSensiblesMinimumParGene &&
      m.contextsSensiblesUnPas >=
        CRITERES_COUVERTURE_DIAGNOSTIC_V02.agentCyclesSensiblesMinimumParGene;
    sensibiliteParGene[m.cleGene] = {
      seedsSensibles,
      agentCyclesSensibles: m.contextsSensiblesUnPas,
      atteint,
    };
    if (!atteint) {
      couvertureGlobaleAtteinte = false;
    }
  }

  const resume: ResumeDiagnosticExposition = {
    version: "diagnostic-exposition-phenotypique-v02",
    identifiantBatch: options.manifeste.identifiantBatch,
    identifiantProtocole: options.manifeste.identifiantProtocole,
    runsPrevus,
    runsTermines,
    runsEchoues,
    controleNegatifBcIdentique: options.controleNegatifBcIdentique,
    evenementsDecisionnelsParCondition,
    metriquesParGene,
    repartitionBornes,
    distributionEnjeuxObserves,
    expressionParRun,
    criteresCouverture: {
      integriteOk,
      sensibiliteParGene,
      couvertureGlobaleAtteinte,
    },
  };

  const dirDiag = join(options.repertoireBatch, "diagnostic-exposition");
  mkdirSync(dirDiag, { recursive: true });
  writeFileSync(
    join(dirDiag, "diagnostic-expression-phenotypique.csv"),
    serialiserCsv(toutesLignes),
    "utf8",
  );
  writeFileSync(
    join(dirDiag, "resume-diagnostic-expression.json"),
    JSON.stringify(resume, null, 2),
    "utf8",
  );
  writeFileSync(
    join(dirDiag, "rapport-diagnostic-expression.md"),
    rendreRapportMarkdown(resume),
    "utf8",
  );

  return resume;
}

export function peutGenererDiagnosticExposition(
  protocole: ProtocoleCampagneEvolution,
): boolean {
  return estProtocoleEvolutionV02(protocole);
}
