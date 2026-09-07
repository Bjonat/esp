import type { MicroUsdc, MicroUsd } from "@esp/protocole";
import {
  parserMicroUsdc,
  parserMicroUsd,
  serialiserMicroUsdc,
  serialiserMicroUsd,
} from "@esp/protocole";
import type {
  BaremeCoutInference,
  BaremeCoutInferenceJson,
  ConfigurationXway,
  ConfigurationXwayJson,
  IdentifiantFournisseurInference,
  IdentifiantModeleInference,
  SelecteurFournisseurXway,
  TarifModeleInference,
} from "./types.js";

export const IDENTIFIANT_FOURNISSEUR_INFERENCE_SIMULE =
  "fournisseur-inference-simule" as const;
export const VERSION_FOURNISSEUR_INFERENCE_SIMULE = "0.1.0" as const;

export const IDENTIFIANT_FOURNISSEUR_INFERENCE_OPENAI =
  "fournisseur-inference-openai" as const;
export const VERSION_FOURNISSEUR_INFERENCE_OPENAI = "0.1.0" as const;

export const IDENTIFIANT_POLITIQUE_COGNITIVE_DEVELOPPEMENT =
  "politique-cognitive-developpement" as const;
export const VERSION_POLITIQUE_COGNITIVE_DEVELOPPEMENT = "0.1.0" as const;

export const MODELE_LOGIQUE_LUNA_REEL_V01 = "luna_reel_v01" as const;
export const MODELE_EXTERNE_OPENAI_LUNA = "gpt-5.6-luna" as const;

/**
 * Catalogue de démonstration — NON CANONIQUE.
 * Montants purement expérimentaux pour exercer autorisation / refus.
 */
export const MODELES_DEMONSTRATION_XWAY: readonly TarifModeleInference[] = [
  {
    identifiant: "modele_economique",
    libelle: "Modèle économique (démo)",
    coutParMillionJetonsEntreeMicroUsdc: 500_000n,
    coutParMillionJetonsSortieMicroUsdc: 1_500_000n,
    nombreMaxJetonsSortie: 256,
  },
  {
    identifiant: "modele_standard",
    libelle: "Modèle standard (démo)",
    coutParMillionJetonsEntreeMicroUsdc: 2_000_000n,
    coutParMillionJetonsSortieMicroUsdc: 6_000_000n,
    nombreMaxJetonsSortie: 512,
  },
  {
    identifiant: "modele_premium",
    libelle: "Modèle premium (démo)",
    coutParMillionJetonsEntreeMicroUsdc: 20_000_000n,
    coutParMillionJetonsSortieMicroUsdc: 60_000_000n,
    nombreMaxJetonsSortie: 1024,
  },
];

/**
 * Tarif ESP d'imputation agent pour luna_reel_v01 — distinct du barème USD.
 * VALEURS DE DÉMONSTRATION.
 */
export const TARIF_LUNA_REEL_V01: TarifModeleInference = {
  identifiant: MODELE_LOGIQUE_LUNA_REEL_V01,
  libelle: "Luna réel v0.1 (imputation ESP)",
  coutParMillionJetonsEntreeMicroUsdc: 2_000_000n,
  coutParMillionJetonsSortieMicroUsdc: 6_000_000n,
  nombreMaxJetonsSortie: 256,
};

/**
 * Barème figé d'ESTIMATION fournisseur OpenAI Luna.
 * Référence informative 2026-09 — ne pas interroger l'API de prix.
 * $0.20 / $0.02 cache / $1.20 sortie par million de jetons.
 */
export const BAREME_OPENAI_LUNA_V01: BaremeCoutInference = {
  fournisseur: IDENTIFIANT_FOURNISSEUR_INFERENCE_OPENAI,
  modeleLogique: MODELE_LOGIQUE_LUNA_REEL_V01,
  modeleExterne: MODELE_EXTERNE_OPENAI_LUNA,
  versionBareme: "openai-luna-v01-2026-09",
  deviseReference: "USD",
  coutParMillionJetonsEntreeMicroUsd: 200_000n,
  coutParMillionJetonsSortieMicroUsd: 1_200_000n,
  coutParMillionJetonsEntreeCacheMicroUsd: 20_000n,
  dateReference: "2026-09-01",
};

const MODELES_CONNUS: ReadonlySet<string> = new Set([
  "modele_economique",
  "modele_standard",
  "modele_premium",
  MODELE_LOGIQUE_LUNA_REEL_V01,
]);

export function trouverTarifModele(
  modeles: readonly TarifModeleInference[],
  identifiant: IdentifiantModeleInference,
): TarifModeleInference | undefined {
  return modeles.find((modele) => modele.identifiant === identifiant);
}

export function serialiserBaremeCoutInference(
  bareme: BaremeCoutInference,
): BaremeCoutInferenceJson {
  return {
    fournisseur: bareme.fournisseur,
    modeleLogique: bareme.modeleLogique,
    modeleExterne: bareme.modeleExterne,
    versionBareme: bareme.versionBareme,
    deviseReference: bareme.deviseReference,
    coutParMillionJetonsEntreeMicroUsd: serialiserMicroUsd(
      bareme.coutParMillionJetonsEntreeMicroUsd,
    ),
    coutParMillionJetonsSortieMicroUsd: serialiserMicroUsd(
      bareme.coutParMillionJetonsSortieMicroUsd,
    ),
    coutParMillionJetonsEntreeCacheMicroUsd: serialiserMicroUsd(
      bareme.coutParMillionJetonsEntreeCacheMicroUsd,
    ),
    dateReference: bareme.dateReference,
  };
}

export function parserBaremeCoutInference(
  brut: BaremeCoutInferenceJson,
): BaremeCoutInference {
  if (brut.deviseReference !== "USD") {
    throw new Error("Barème : deviseReference doit être USD");
  }
  if (!MODELES_CONNUS.has(brut.modeleLogique)) {
    throw new Error(`Barème : modèle logique inconnu : ${brut.modeleLogique}`);
  }
  return {
    fournisseur: brut.fournisseur,
    modeleLogique: brut.modeleLogique,
    modeleExterne: brut.modeleExterne,
    versionBareme: brut.versionBareme,
    deviseReference: "USD",
    coutParMillionJetonsEntreeMicroUsd: parserMicroUsd(
      brut.coutParMillionJetonsEntreeMicroUsd,
    ),
    coutParMillionJetonsSortieMicroUsd: parserMicroUsd(
      brut.coutParMillionJetonsSortieMicroUsd,
    ),
    coutParMillionJetonsEntreeCacheMicroUsd: parserMicroUsd(
      brut.coutParMillionJetonsEntreeCacheMicroUsd,
    ),
    dateReference: brut.dateReference,
  };
}

export function serialiserConfigurationXway(
  configuration: ConfigurationXway,
): ConfigurationXwayJson {
  return {
    active: configuration.active,
    plafondComputeParCycleMicroUsdc: serialiserMicroUsdc(
      configuration.plafondComputeParCycleMicroUsdc,
    ),
    modeles: configuration.modeles.map((modele) => ({
      identifiant: modele.identifiant,
      libelle: modele.libelle,
      coutParMillionJetonsEntreeMicroUsdc: serialiserMicroUsdc(
        modele.coutParMillionJetonsEntreeMicroUsdc,
      ),
      coutParMillionJetonsSortieMicroUsdc: serialiserMicroUsdc(
        modele.coutParMillionJetonsSortieMicroUsdc,
      ),
      nombreMaxJetonsSortie: modele.nombreMaxJetonsSortie,
    })),
    politiqueCognitive: configuration.politiqueCognitive,
    fournisseur: {
      identifiant: configuration.fournisseur.identifiant,
      selecteur: configuration.fournisseur.selecteur,
      version: configuration.fournisseur.version,
    },
    ...(configuration.baremeCoutInference !== undefined
      ? {
          baremeCoutInference: serialiserBaremeCoutInference(
            configuration.baremeCoutInference,
          ),
        }
      : {}),
    ...(configuration.plafondDepenseFournisseurReelleMicroUsd !== undefined
      ? {
          plafondDepenseFournisseurReelleMicroUsd: serialiserMicroUsd(
            configuration.plafondDepenseFournisseurReelleMicroUsd,
          ),
        }
      : {}),
    ...(configuration.timeoutInferenceMs !== undefined
      ? { timeoutInferenceMs: configuration.timeoutInferenceMs }
      : {}),
  };
}

export function parserConfigurationXway(
  brut: ConfigurationXwayJson,
): ConfigurationXway {
  if (typeof brut.active !== "boolean") {
    throw new Error("Configuration Xway : active invalide");
  }
  const plafond = parserMicroUsdc(brut.plafondComputeParCycleMicroUsdc);
  if (plafond < 0n) {
    throw new Error("Configuration Xway : plafond négatif");
  }
  if (!Array.isArray(brut.modeles) || brut.modeles.length === 0) {
    throw new Error("Configuration Xway : modeles requis");
  }

  const modeles: TarifModeleInference[] = brut.modeles.map((modele) => {
    if (!MODELES_CONNUS.has(modele.identifiant)) {
      throw new Error(`Modèle Xway inconnu : ${String(modele.identifiant)}`);
    }
    if (
      !Number.isInteger(modele.nombreMaxJetonsSortie) ||
      modele.nombreMaxJetonsSortie < 1
    ) {
      throw new Error("nombreMaxJetonsSortie invalide");
    }
    return {
      identifiant: modele.identifiant,
      libelle: modele.libelle,
      coutParMillionJetonsEntreeMicroUsdc: parserMicroUsdc(
        modele.coutParMillionJetonsEntreeMicroUsdc,
      ),
      coutParMillionJetonsSortieMicroUsdc: parserMicroUsdc(
        modele.coutParMillionJetonsSortieMicroUsdc,
      ),
      nombreMaxJetonsSortie: modele.nombreMaxJetonsSortie,
    };
  });

  const { selecteur, identifiant, version } = resoudreFournisseur(
    brut.fournisseur,
  );

  const bareme =
    brut.baremeCoutInference !== undefined
      ? parserBaremeCoutInference(brut.baremeCoutInference)
      : undefined;

  if (selecteur === "openai" && bareme === undefined) {
    throw new Error(
      "Configuration Xway : baremeCoutInference requis pour fournisseur openai",
    );
  }

  const plafondFournisseur =
    brut.plafondDepenseFournisseurReelleMicroUsd !== undefined
      ? parserMicroUsd(brut.plafondDepenseFournisseurReelleMicroUsd)
      : undefined;

  if (
    brut.timeoutInferenceMs !== undefined &&
    (!Number.isInteger(brut.timeoutInferenceMs) || brut.timeoutInferenceMs < 1)
  ) {
    throw new Error("timeoutInferenceMs invalide");
  }

  return {
    active: brut.active,
    plafondComputeParCycleMicroUsdc: plafond,
    modeles,
    politiqueCognitive: {
      identifiant: "politique-cognitive-developpement",
      version: brut.politiqueCognitive.version,
    },
    fournisseur: { identifiant, selecteur, version },
    ...(bareme !== undefined ? { baremeCoutInference: bareme } : {}),
    ...(plafondFournisseur !== undefined
      ? { plafondDepenseFournisseurReelleMicroUsd: plafondFournisseur }
      : {}),
    ...(brut.timeoutInferenceMs !== undefined
      ? { timeoutInferenceMs: brut.timeoutInferenceMs }
      : {}),
  };
}

function resoudreFournisseur(
  brut: ConfigurationXwayJson["fournisseur"],
): {
  selecteur: SelecteurFournisseurXway;
  identifiant: IdentifiantFournisseurInference;
  version: string;
} {
  if (brut === "simule") {
    return {
      selecteur: "simule",
      identifiant: IDENTIFIANT_FOURNISSEUR_INFERENCE_SIMULE,
      version: VERSION_FOURNISSEUR_INFERENCE_SIMULE,
    };
  }
  if (brut === "openai") {
    return {
      selecteur: "openai",
      identifiant: IDENTIFIANT_FOURNISSEUR_INFERENCE_OPENAI,
      version: VERSION_FOURNISSEUR_INFERENCE_OPENAI,
    };
  }
  if (typeof brut === "object" && brut !== null) {
    const selecteur: SelecteurFournisseurXway =
      brut.selecteur ??
      (brut.identifiant === IDENTIFIANT_FOURNISSEUR_INFERENCE_OPENAI
        ? "openai"
        : "simule");
    const identifiant: IdentifiantFournisseurInference =
      selecteur === "openai"
        ? IDENTIFIANT_FOURNISSEUR_INFERENCE_OPENAI
        : IDENTIFIANT_FOURNISSEUR_INFERENCE_SIMULE;
    return {
      selecteur,
      identifiant,
      version: brut.version,
    };
  }
  throw new Error("Configuration Xway : fournisseur invalide");
}

export function creerConfigurationXwayDemonstration(
  surcharges?: Partial<{
    active: boolean;
    plafondComputeParCycleMicroUsdc: MicroUsdc;
  }>,
): ConfigurationXway {
  return {
    active: surcharges?.active ?? true,
    plafondComputeParCycleMicroUsdc:
      surcharges?.plafondComputeParCycleMicroUsdc ?? 50_000n,
    modeles: MODELES_DEMONSTRATION_XWAY,
    politiqueCognitive: {
      identifiant: IDENTIFIANT_POLITIQUE_COGNITIVE_DEVELOPPEMENT,
      version: VERSION_POLITIQUE_COGNITIVE_DEVELOPPEMENT,
    },
    fournisseur: {
      identifiant: IDENTIFIANT_FOURNISSEUR_INFERENCE_SIMULE,
      selecteur: "simule",
      version: VERSION_FOURNISSEUR_INFERENCE_SIMULE,
    },
  };
}

/**
 * Configuration d'exemple openai — JAMAIS active par défaut.
 * Nécessite OPENAI_API_KEY + activation explicite.
 */
export function creerConfigurationXwayOpenaiDemonstration(surcharges?: {
  readonly plafondDepenseFournisseurReelleMicroUsd?: MicroUsd;
  readonly timeoutInferenceMs?: number;
}): ConfigurationXway {
  return {
    active: true,
    plafondComputeParCycleMicroUsdc: 50_000n,
    modeles: [...MODELES_DEMONSTRATION_XWAY, TARIF_LUNA_REEL_V01],
    politiqueCognitive: {
      identifiant: IDENTIFIANT_POLITIQUE_COGNITIVE_DEVELOPPEMENT,
      version: VERSION_POLITIQUE_COGNITIVE_DEVELOPPEMENT,
    },
    fournisseur: {
      identifiant: IDENTIFIANT_FOURNISSEUR_INFERENCE_OPENAI,
      selecteur: "openai",
      version: VERSION_FOURNISSEUR_INFERENCE_OPENAI,
    },
    baremeCoutInference: BAREME_OPENAI_LUNA_V01,
    plafondDepenseFournisseurReelleMicroUsd:
      surcharges?.plafondDepenseFournisseurReelleMicroUsd ?? 100_000n,
    timeoutInferenceMs: surcharges?.timeoutInferenceMs ?? 30_000,
  };
}
