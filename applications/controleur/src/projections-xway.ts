import type { EvenementEsp, MicroUsdc } from "@esp/protocole";
import { lireMontantChargeUtile, filtrerEvenementsXway } from "@esp/protocole";
import type {
  EtatPersistantDemandeXway,
  FaitEvenementDemandeXway,
  NatureEchecInference,
  SelecteurFournisseurXway,
} from "@esp/xway";
import { reconstruireEtatsDemandesXway } from "@esp/xway";
import type { MontantApi } from "./serialisation-api.js";
import { serialiserMontantApi } from "./serialisation-api.js";

export type ProjectionXwayGlobale = {
  readonly active: boolean;
  readonly fournisseurSimule: boolean;
  readonly fournisseurReel: boolean;
  readonly selecteurFournisseur: SelecteurFournisseurXway;
  readonly libelleFournisseur: string;
  readonly banniereFournisseurReel: string | null;
  readonly demandesRecues: number;
  readonly demandesAutorisees: number;
  readonly demandesRefusees: number;
  readonly inferencesExecutees: number;
  readonly inferencesEchouees: number;
  readonly coutComputeCumule: MontantApi;
  readonly coutComputeCycleCourant: MontantApi;
  readonly coutFournisseurEstimeCumuleMicroUsd: string;
  readonly repartitionParModele: readonly {
    readonly modele: string;
    readonly executees: number;
    readonly refusees: number;
    readonly coutCumule: MontantApi;
  }[];
};

export type ProjectionInferenceRecente = {
  readonly numeroCycle: number;
  readonly modele: string | null;
  readonly jetonsEntree: number | null;
  readonly jetonsSortie: number | null;
  readonly coutImputeEsp: MontantApi | null;
  readonly coutFournisseurEstimeMicroUsd: string | null;
  readonly latenceMs: number | null;
  readonly statut: string;
  readonly propositionResume: string | null;
  readonly propositionAction: string | null;
  readonly propositionConfiance: number | null;
  readonly propositionValide: boolean | null;
};

export type ProjectionXwayAgent = {
  readonly identifiantAgent: string;
  readonly fournisseurSimule: boolean;
  readonly fournisseurReel: boolean;
  readonly selecteurFournisseur: SelecteurFournisseurXway;
  readonly libelleFournisseur: string;
  readonly nombreDemandes: number;
  readonly modelesUtilises: readonly string[];
  readonly inferencesRefusees: number;
  readonly inferencesExecutees: number;
  readonly jetonsEntreeCumules: number;
  readonly jetonsSortieCumules: number;
  readonly coutCumule: MontantApi;
  readonly coutFournisseurEstimeCumuleMicroUsd: string;
  readonly dernierAppel: {
    readonly numeroCycle: number;
    readonly type: string;
    readonly modele: string | null;
    readonly resume: string;
  } | null;
  readonly derniereInference: ProjectionInferenceRecente | null;
  readonly budgetCognitifDernierCycle: MontantApi | null;
};

function libelleFournisseur(selecteur: SelecteurFournisseurXway): string {
  return selecteur === "openai"
    ? "FOURNISSEUR : OPENAI RÉEL"
    : "FOURNISSEUR : SIMULÉ";
}

export function projeterXwayGlobal(options: {
  readonly evenements: readonly EvenementEsp[];
  readonly numeroCycleCourant: number;
  readonly active: boolean;
  readonly selecteurFournisseur?: SelecteurFournisseurXway;
  readonly identifiantFournisseur?: string;
}): ProjectionXwayGlobale {
  const selecteur = options.selecteurFournisseur ?? "simule";
  const xway = filtrerEvenementsXway(options.evenements);
  let demandesRecues = 0;
  let demandesAutorisees = 0;
  let demandesRefusees = 0;
  let inferencesExecutees = 0;
  let inferencesEchouees = 0;
  let coutCumule = 0n;
  let coutCycleCourant = 0n;
  let coutFournisseur = 0n;
  const parModele = new Map<
    string,
    { executees: number; refusees: number; cout: MicroUsdc }
  >();

  for (const evenement of xway) {
    const modele =
      typeof evenement.chargeUtile.modeleDemande === "string"
        ? evenement.chargeUtile.modeleDemande
        : "inconnu";
    const bucket = parModele.get(modele) ?? {
      executees: 0,
      refusees: 0,
      cout: 0n,
    };

    switch (evenement.type) {
      case "DEMANDE_INFERENCE_RECUE":
        demandesRecues += 1;
        break;
      case "DEMANDE_INFERENCE_AUTORISEE":
        demandesAutorisees += 1;
        break;
      case "DEMANDE_INFERENCE_REFUSEE":
        demandesRefusees += 1;
        bucket.refusees += 1;
        break;
      case "INFERENCE_EXECUTEE": {
        inferencesExecutees += 1;
        bucket.executees += 1;
        const cout = lireMontantOptionnel(
          evenement.chargeUtile,
          "coutFinalMicroUsdc",
        );
        coutCumule += cout;
        bucket.cout += cout;
        if (evenement.numeroCycle === options.numeroCycleCourant) {
          coutCycleCourant += cout;
        }
        const cf = evenement.chargeUtile.coutFournisseurEstimeMicroUsd;
        if (typeof cf === "string" && /^-?\d+$/.test(cf)) {
          coutFournisseur += BigInt(cf);
        }
        break;
      }
      case "INFERENCE_ECHOUEE":
        inferencesEchouees += 1;
        break;
      default:
        break;
    }
    parModele.set(modele, bucket);
  }

  return {
    active: options.active,
    fournisseurSimule: selecteur === "simule",
    fournisseurReel: selecteur === "openai",
    selecteurFournisseur: selecteur,
    libelleFournisseur: libelleFournisseur(selecteur),
    banniereFournisseurReel:
      selecteur === "openai"
        ? "INFÉRENCE IA RÉELLE — environnement économique toujours simulé"
        : null,
    demandesRecues,
    demandesAutorisees,
    demandesRefusees,
    inferencesExecutees,
    inferencesEchouees,
    coutComputeCumule: serialiserMontantApi(coutCumule),
    coutComputeCycleCourant: serialiserMontantApi(coutCycleCourant),
    coutFournisseurEstimeCumuleMicroUsd: coutFournisseur.toString(10),
    repartitionParModele: [...parModele.entries()].map(([modele, stats]) => ({
      modele,
      executees: stats.executees,
      refusees: stats.refusees,
      coutCumule: serialiserMontantApi(stats.cout),
    })),
  };
}

export function projeterXwayAgent(options: {
  readonly evenements: readonly EvenementEsp[];
  readonly identifiantAgent: string;
  readonly selecteurFournisseur?: SelecteurFournisseurXway;
  readonly identifiantFournisseur?: string;
}): ProjectionXwayAgent {
  const selecteur = options.selecteurFournisseur ?? "simule";
  const xway = filtrerEvenementsXway(options.evenements).filter(
    (e) => e.identifiantAgent === options.identifiantAgent,
  );

  let nombreDemandes = 0;
  let inferencesRefusees = 0;
  let inferencesExecutees = 0;
  let jetonsEntree = 0;
  let jetonsSortie = 0;
  let coutCumule = 0n;
  let coutFournisseur = 0n;
  const modeles = new Set<string>();
  let dernier: ProjectionXwayAgent["dernierAppel"] = null;
  let derniereInference: ProjectionInferenceRecente | null = null;
  let budgetDernier: MontantApi | null = null;

  for (const evenement of xway) {
    const modele =
      typeof evenement.chargeUtile.modeleDemande === "string"
        ? evenement.chargeUtile.modeleDemande
        : null;
    if (modele !== null) {
      modeles.add(modele);
    }

    if (evenement.type === "DEMANDE_INFERENCE_RECUE") {
      nombreDemandes += 1;
      const limite = evenement.chargeUtile.limiteDepenseAutoriseeMicroUsdc;
      if (typeof limite === "string") {
        budgetDernier = serialiserMontantApi(
          lireMontantChargeUtile(
            evenement.chargeUtile,
            "limiteDepenseAutoriseeMicroUsdc",
          ),
        );
      }
    }
    if (evenement.type === "DEMANDE_INFERENCE_REFUSEE") {
      inferencesRefusees += 1;
    }
    if (evenement.type === "INFERENCE_EXECUTEE") {
      inferencesExecutees += 1;
      if (typeof evenement.chargeUtile.jetonsEntree === "number") {
        jetonsEntree += evenement.chargeUtile.jetonsEntree;
      }
      if (typeof evenement.chargeUtile.jetonsSortie === "number") {
        jetonsSortie += evenement.chargeUtile.jetonsSortie;
      }
      coutCumule += lireMontantOptionnel(
        evenement.chargeUtile,
        "coutFinalMicroUsdc",
      );
      const cf = evenement.chargeUtile.coutFournisseurEstimeMicroUsd;
      if (typeof cf === "string" && /^-?\d+$/.test(cf)) {
        coutFournisseur += BigInt(cf);
      }
      derniereInference = {
        numeroCycle: evenement.numeroCycle,
        modele,
        jetonsEntree:
          typeof evenement.chargeUtile.jetonsEntree === "number"
            ? evenement.chargeUtile.jetonsEntree
            : null,
        jetonsSortie:
          typeof evenement.chargeUtile.jetonsSortie === "number"
            ? evenement.chargeUtile.jetonsSortie
            : null,
        coutImputeEsp: serialiserMontantApi(
          lireMontantOptionnel(evenement.chargeUtile, "coutFinalMicroUsdc"),
        ),
        coutFournisseurEstimeMicroUsd:
          typeof cf === "string" ? cf : null,
        latenceMs:
          typeof evenement.chargeUtile.latenceMs === "number"
            ? evenement.chargeUtile.latenceMs
            : null,
        statut: "executee",
        propositionResume:
          typeof evenement.chargeUtile.propositionResume === "string"
            ? evenement.chargeUtile.propositionResume
            : null,
        propositionAction:
          typeof evenement.chargeUtile.propositionAction === "string"
            ? evenement.chargeUtile.propositionAction
            : null,
        propositionConfiance:
          typeof evenement.chargeUtile.propositionConfiance === "number"
            ? evenement.chargeUtile.propositionConfiance
            : null,
        propositionValide:
          typeof evenement.chargeUtile.propositionValide === "boolean"
            ? evenement.chargeUtile.propositionValide
            : null,
      };
    }

    dernier = {
      numeroCycle: evenement.numeroCycle,
      type: evenement.type,
      modele,
      resume: resumerXway(evenement),
    };
  }

  return {
    identifiantAgent: options.identifiantAgent,
    fournisseurSimule: selecteur === "simule",
    fournisseurReel: selecteur === "openai",
    selecteurFournisseur: selecteur,
    libelleFournisseur: libelleFournisseur(selecteur),
    nombreDemandes,
    modelesUtilises: [...modeles],
    inferencesRefusees,
    inferencesExecutees,
    jetonsEntreeCumules: jetonsEntree,
    jetonsSortieCumules: jetonsSortie,
    coutCumule: serialiserMontantApi(coutCumule),
    coutFournisseurEstimeCumuleMicroUsd: coutFournisseur.toString(10),
    dernierAppel: dernier,
    derniereInference,
    budgetCognitifDernierCycle: budgetDernier,
  };
}

/** @deprecated préférer reconstruireEtatsDemandesDepuisRegistre */
export function listerIdentifiantsDemandesExecutees(
  evenements: readonly EvenementEsp[],
): string[] {
  const ids: string[] = [];
  for (const evenement of filtrerEvenementsXway(evenements)) {
    if (evenement.type !== "INFERENCE_EXECUTEE") {
      continue;
    }
    const id = evenement.chargeUtile.identifiantDemande;
    if (typeof id === "string") {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Reconstruit les états de demandes Xway depuis le registre (source de vérité).
 */
export function reconstruireEtatsDemandesDepuisRegistre(
  evenements: readonly EvenementEsp[],
): Map<string, EtatPersistantDemandeXway> {
  const faits: FaitEvenementDemandeXway[] = [];
  for (const evenement of filtrerEvenementsXway(evenements)) {
    const identifiantDemande = evenement.chargeUtile.identifiantDemande;
    const identifiantAgent = evenement.identifiantAgent;
    if (
      typeof identifiantDemande !== "string" ||
      typeof identifiantAgent !== "string"
    ) {
      continue;
    }
    const coutMax = lireMontantOptionnelNullable(
      evenement.chargeUtile,
      "coutMaximumEstimeMicroUsdc",
    );
    const coutFinal = lireMontantOptionnelNullable(
      evenement.chargeUtile,
      "coutFinalMicroUsdc",
    );
    const natureBrute = evenement.chargeUtile.natureEchec;
    const natureEchec: NatureEchecInference | undefined =
      natureBrute === "echec_certain" || natureBrute === "resultat_indetermine"
        ? natureBrute
        : undefined;

    faits.push({
      type: evenement.type,
      identifiantDemande,
      identifiantAgent,
      numeroCycle: evenement.numeroCycle,
      ...(coutMax !== undefined
        ? { coutMaximumEstimeMicroUsdc: coutMax }
        : {}),
      ...(coutFinal !== undefined ? { coutFinalMicroUsdc: coutFinal } : {}),
      ...(typeof evenement.chargeUtile.jetonsEntree === "number"
        ? { jetonsEntree: evenement.chargeUtile.jetonsEntree }
        : {}),
      ...(typeof evenement.chargeUtile.jetonsSortie === "number"
        ? { jetonsSortie: evenement.chargeUtile.jetonsSortie }
        : {}),
      ...(typeof evenement.chargeUtile.motifRefus === "string"
        ? { motifRefus: evenement.chargeUtile.motifRefus }
        : {}),
      ...(typeof evenement.chargeUtile.detail === "string"
        ? { detail: evenement.chargeUtile.detail }
        : {}),
      ...(natureEchec !== undefined ? { natureEchec } : {}),
    });
  }
  return reconstruireEtatsDemandesXway(faits);
}

function lireMontantOptionnel(
  chargeUtile: Readonly<Record<string, unknown>>,
  cle: string,
): MicroUsdc {
  return lireMontantOptionnelNullable(chargeUtile, cle) ?? 0n;
}

function lireMontantOptionnelNullable(
  chargeUtile: Readonly<Record<string, unknown>>,
  cle: string,
): MicroUsdc | undefined {
  if (typeof chargeUtile[cle] !== "string") {
    return undefined;
  }
  try {
    return lireMontantChargeUtile(chargeUtile, cle);
  } catch {
    return undefined;
  }
}

function resumerXway(evenement: EvenementEsp): string {
  if (evenement.type === "INFERENCE_EXECUTEE") {
    const jetons = evenement.chargeUtile.jetonsSortie;
    const cout = evenement.chargeUtile.coutFinalMicroUsdc;
    return `${String(jetons ?? "?")} jetons sortie · ${String(cout ?? "?")} µUSDC`;
  }
  if (evenement.type === "DEMANDE_INFERENCE_REFUSEE") {
    return String(evenement.chargeUtile.motifRefus ?? "refus");
  }
  if (evenement.type === "INFERENCE_ECHOUEE") {
    return String(evenement.chargeUtile.natureEchec ?? "echec_certain");
  }
  if (typeof evenement.chargeUtile.modeleDemande === "string") {
    return evenement.chargeUtile.modeleDemande;
  }
  return evenement.type;
}
