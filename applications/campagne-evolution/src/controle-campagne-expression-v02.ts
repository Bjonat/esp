/**
 * Contrôle positif niveau campagne : mutation génotype → action divergente.
 * Traverse la vraie voie fabriquerConfigurationRunV02 → ControleurExperience.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ControleurExperience,
  parserConfigurationExperience,
} from "@esp/controleur";
import { empreinteConfigurationHeritable } from "@esp/protocole";
import { fabriquerConfigurationRunV02 } from "./conditions-v02.js";
import { DATE_EVENEMENTS_FIXES_EVOLUTION } from "./conditions.js";
import { ControleSensibilitePhenotypiqueErreur } from "./controle-sensibilite-phenotypique-v02.js";
import {
  parserProtocoleEvolutionV02,
  type ProtocoleExperienceEvolutionV02Json,
} from "./protocole-evolution-v02.js";
import { VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02 } from "./protocole-evolution-v02.js";
import {
  extraireTracePhenotypiqueCycle,
  tracesPhenotypiquesDivergent,
} from "./trace-phenotypique.js";

const GENE_COMPORTEMENT_SEUL = [
  {
    cle: "comportementSansInference" as const,
    type: "categoriel" as const,
    valeursAutorisees: ["attendre", "agir_si_favorable"] as const,
    defaut: "agir_si_favorable" as const,
  },
];

function protocoleFixtureCampagne(options: {
  readonly identifiantProtocole: string;
  readonly tauxMutationConditionDBps: number;
  readonly genes?: typeof GENE_COMPORTEMENT_SEUL;
}): ProtocoleExperienceEvolutionV02Json {
  return {
    version: VERSION_PROTOCOLE_EXPERIENCE_EVOLUTION_V02,
    identifiantProtocole: options.identifiantProtocole,
    mode: "calibration",
    seedsCalibration: [9001],
    seedsEvaluation: [],
    cyclesMaximum: 4,
    populationInitiale: 1,
    capitalInitialParAgentMicroUsdc: "10000000",
    tauxMutationConditionDBps: options.tauxMutationConditionDBps,
    conditions: ["A", "B", "C", "D"],
    dateLancementFixe: DATE_EVENEMENTS_FIXES_EVOLUTION,
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: "0.1.0",
      selecteur: "simule",
    },
    parametresEconomiques: {
      version: "demo-campagne-sensibilite-v02",
      loyerInfrastructureMicroUsdc: "0",
      periodeLoyerEnCycles: 100,
      tauxRedevanceProprietairePointsDeBase: "0",
      coutOperationnelMinimalParCycleMicroUsdc: "1000",
      seuilRunwaySainEnCycles: 20,
      seuilRunwayContraintEnCycles: 5,
      cyclesDormanceAvantMort: 3,
    },
    reproduction: {
      version: "parametres-reproduction-v01",
      active: true,
      dotationEnfantMicroUsdc: "2000000",
      coutReproductionMicroUsdc: "500000",
      reserveMinimaleParentMicroUsdc: "500000",
      populationMaximale: 8,
      nombreMaxReproductionsParCycle: 3,
      nombreMaxEnfantsParAgent: 3,
      cooldownCycles: 0,
    },
    reproductionAutonome: {
      version: "politique-reproduction-autonome-v01",
      active: true,
      etatsSurvieEligibles: ["sain", "contraint"],
      nombreMaxNaissancesParCycle: 2,
    },
    mutationBase: {
      version: "parametres-mutation-v01",
      active: true,
      tauxMutationParGeneBps: options.tauxMutationConditionDBps,
      versionCatalogueGenes: "genes-mutables-v01",
      ...(options.genes !== undefined ? { genes: [...options.genes] } : {}),
    },
    // EV positive + seuil haut → force sans inférence (gène comportement observable).
    environnementDecision: {
      identifiant: "environnement-opportunites-simulees",
      version: "0.1.0",
      probabiliteSuccesBaseBps: 8000,
      amplitudeProbabiliteBps: 0,
      gainSiSuccesMicroUsdc: "125000",
      perteSiEchecMicroUsdc: "50000",
      fraisActionMicroUsdc: "1000",
      fraisAttendreMicroUsdc: "0",
    },
    politiqueBudgetCognitif: {
      identifiant: "politique-budget-cognitif-agent",
      version: "0.1.0",
      seuilEnjeuPourInferenceMicroUsdc: "200000",
      partMaxVenParCycleBps: 50,
      plafondCognitifMicroUsdc: "10000",
      modeleLogique: "modele_standard",
      comportementSansInference: "agir_si_favorable",
      refuserSiCritiqueOuDormant: true,
    },
  };
}

async function executerLigneeEtObserverEnfant(options: {
  readonly identifiantProtocole: string;
  readonly tauxMutation: number;
  readonly genes?: typeof GENE_COMPORTEMENT_SEUL;
}): Promise<{
  readonly actionEnfant: string | undefined;
  readonly comportementEnfant: string | undefined;
  readonly empreinteEnfant: string | undefined;
  readonly traceCycleEnfant: ReturnType<typeof extraireTracePhenotypiqueCycle>;
}> {
  const protocole = parserProtocoleEvolutionV02(
    protocoleFixtureCampagne({
      identifiantProtocole: options.identifiantProtocole,
      tauxMutationConditionDBps: Math.max(1, options.tauxMutation),
      ...(options.genes !== undefined ? { genes: options.genes } : {}),
    }),
  );

  // Condition D si taux > 0 avec genes ; sinon B (mutation inactive) comme contrefactuel.
  const condition = options.tauxMutation > 0 ? "D" : "B";
  const confJson = fabriquerConfigurationRunV02(protocole, condition, 9001);
  const conf = parserConfigurationExperience(confJson);
  const repertoire = mkdtempSync(join(tmpdir(), "esp-campagne-sens-v02-"));
  const controleur = ControleurExperience.ouvrir({
    configuration: conf,
    cheminSqlite: join(repertoire, "esp.sqlite"),
    cheminKeystoreIdentites: join(repertoire, "identites"),
    dateCreationFixe: DATE_EVENEMENTS_FIXES_EVOLUTION,
    datesEvenementsFixes: DATE_EVENEMENTS_FIXES_EVOLUTION,
  });

  try {
    const parent = controleur.obtenirAgents()[0]!;
    const repro = await controleur.demanderReproduction(
      parent.identite.identifiant,
    );
    if (repro.statut !== "autorisee") {
      throw new ControleSensibilitePhenotypiqueErreur(
        `reproduction refusée : ${repro.statut}`,
      );
    }
    const enfant = controleur
      .obtenirAgents()
      .find((a) => a.identite.identifiant === repro.identifiantEnfant);
    if (enfant === undefined) {
      throw new ControleSensibilitePhenotypiqueErreur("enfant introuvable");
    }

    await controleur.avancerUnCycle();

    const evenements = [
      ...controleur.registre.listerParExperience(conf.identifiantExperience),
    ];
    const cycleEnfant = controleur.obtenirNumeroCycleCourant();
    const empreinteEnfant =
      enfant.configurationHeritable !== undefined
        ? empreinteConfigurationHeritable(enfant.configurationHeritable)
        : undefined;
    const trace = extraireTracePhenotypiqueCycle({
      evenements,
      identifiantAgent: enfant.identite.identifiant,
      numeroCycle: cycleEnfant,
      ...(empreinteEnfant !== undefined
        ? { empreinteConfiguration: empreinteEnfant }
        : {}),
    });

    return {
      actionEnfant: trace.decision?.action ?? trace.action?.action,
      comportementEnfant: String(
        enfant.configurationHeritable?.parametres.comportementSansInference ??
          "",
      ),
      empreinteEnfant,
      traceCycleEnfant: trace,
    };
  } finally {
    controleur.fermer();
    rmSync(repertoire, { recursive: true, force: true });
  }
}

/**
 * Mutant (taux 10000, catalogue comportement seul) vs contrefactuel (mutation off).
 * Attendu : actions divergentes (agir vs attendre) sur EV positive sans inférence.
 */
export async function executerControleCampagneExpressionPhenotypiqueV02(): Promise<{
  readonly ok: boolean;
  readonly detail: string;
}> {
  const mutant = await executerLigneeEtObserverEnfant({
    identifiantProtocole: "fixture-campagne-expression-v02",
    tauxMutation: 10_000,
    genes: GENE_COMPORTEMENT_SEUL,
  });
  const contrefactuel = await executerLigneeEtObserverEnfant({
    identifiantProtocole: "fixture-campagne-expression-v02",
    tauxMutation: 0,
  });

  if (mutant.comportementEnfant !== "attendre") {
    return {
      ok: false,
      detail: `mutant n'a pas reçu comportement attendre (reçu ${String(mutant.comportementEnfant)})`,
    };
  }
  if (contrefactuel.comportementEnfant !== "agir_si_favorable") {
    return {
      ok: false,
      detail: `contrefactuel n'a pas conservé agir_si_favorable (reçu ${String(contrefactuel.comportementEnfant)})`,
    };
  }

  if (
    mutant.actionEnfant === undefined ||
    contrefactuel.actionEnfant === undefined
  ) {
    return {
      ok: false,
      detail: "action enfant absente — voie décisionnelle non traversée",
    };
  }

  const divergent =
    mutant.actionEnfant !== contrefactuel.actionEnfant &&
    tracesPhenotypiquesDivergent(
      mutant.traceCycleEnfant,
      contrefactuel.traceCycleEnfant,
    );

  const ok =
    divergent &&
    mutant.actionEnfant === "attendre" &&
    contrefactuel.actionEnfant === "agir";

  return {
    ok,
    detail: ok
      ? `campagne : mutant action=${mutant.actionEnfant} / contrefactuel=${contrefactuel.actionEnfant}`
      : `pas de divergence d'action : mutant=${String(mutant.actionEnfant)} contrefactuel=${String(contrefactuel.actionEnfant)}`,
  };
}
