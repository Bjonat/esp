import type { MicroUsdc } from "@esp/protocole";
import { parserMicroUsdc, serialiserMicroUsdc } from "@esp/protocole";
import type {
  ConfigurationXway,
  ConfigurationXwayJson,
  IdentifiantModeleInference,
  TarifModeleInference,
} from "./types.js";

export const IDENTIFIANT_FOURNISSEUR_INFERENCE_SIMULE =
  "fournisseur-inference-simule" as const;
export const VERSION_FOURNISSEUR_INFERENCE_SIMULE = "0.1.0" as const;

export const IDENTIFIANT_POLITIQUE_COGNITIVE_DEVELOPPEMENT =
  "politique-cognitive-developpement" as const;
export const VERSION_POLITIQUE_COGNITIVE_DEVELOPPEMENT = "0.1.0" as const;

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

export function trouverTarifModele(
  modeles: readonly TarifModeleInference[],
  identifiant: IdentifiantModeleInference,
): TarifModeleInference | undefined {
  return modeles.find((modele) => modele.identifiant === identifiant);
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
    fournisseur: configuration.fournisseur,
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
    if (
      modele.identifiant !== "modele_economique" &&
      modele.identifiant !== "modele_standard" &&
      modele.identifiant !== "modele_premium"
    ) {
      throw new Error(`Modèle Xway inconnu : ${String(modele.identifiant)}`);
    }
    if (!Number.isInteger(modele.nombreMaxJetonsSortie) || modele.nombreMaxJetonsSortie < 1) {
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

  return {
    active: brut.active,
    plafondComputeParCycleMicroUsdc: plafond,
    modeles,
    politiqueCognitive: {
      identifiant: "politique-cognitive-developpement",
      version: brut.politiqueCognitive.version,
    },
    fournisseur: {
      identifiant: "fournisseur-inference-simule",
      version: brut.fournisseur.version,
    },
  };
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
      version: VERSION_FOURNISSEUR_INFERENCE_SIMULE,
    },
  };
}
