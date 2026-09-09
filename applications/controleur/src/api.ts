import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { FenetreEvaluation } from "@esp/protocole";
import type { ControleurExperience } from "./controleur.js";
import { ControleurExperienceErreur } from "./controleur.js";
import { serialiserJsonApi } from "./serialisation-api.js";

export type OptionsServeurApi = {
  readonly hote?: string;
  readonly port?: number;
  readonly controleur: ControleurExperience;
};

export type ServeurApi = {
  readonly hote: string;
  readonly port: number;
  readonly serveur: Server;
  fermer: () => Promise<void>;
};

/**
 * API HTTP locale de lecture / contrôle.
 * Écoute uniquement 127.0.0.1 par défaut — jamais 0.0.0.0.
 */
export async function demarrerServeurApi(
  options: OptionsServeurApi,
): Promise<ServeurApi> {
  const hote = options.hote ?? "127.0.0.1";
  const portDemande = options.port ?? 3001;
  const { controleur } = options;

  if (hote !== "127.0.0.1" && hote !== "localhost") {
    throw new Error(
      `L'API de développement n'écoute que 127.0.0.1 (reçu : ${hote})`,
    );
  }

  const serveur = createServer((requete, reponse) => {
    void gererRequete(requete, reponse, controleur);
  });

  await new Promise<void>((resoudre, rejeter) => {
    serveur.once("error", rejeter);
    serveur.listen(portDemande, hote, () => {
      serveur.off("error", rejeter);
      resoudre();
    });
  });

  const adresse = serveur.address() as AddressInfo;

  return {
    hote,
    port: adresse.port,
    serveur,
    fermer: () =>
      new Promise((resoudre, rejeter) => {
        serveur.close((erreur) => {
          if (erreur) {
            rejeter(erreur);
            return;
          }
          resoudre();
        });
      }),
  };
}

async function gererRequete(
  requete: IncomingMessage,
  reponse: ServerResponse,
  controleur: ControleurExperience,
): Promise<void> {
  const methode = requete.method ?? "GET";
  const url = new URL(requete.url ?? "/", "http://127.0.0.1");
  const chemin = url.pathname;

  try {
    if (methode === "GET" && chemin === "/api/sante") {
      repondreJson(reponse, 200, {
        statut: "ok",
        controleur: "connecte",
        horodatage: new Date().toISOString(),
      });
      return;
    }

    if (methode === "GET" && chemin === "/api/experience") {
      repondreJson(reponse, 200, controleur.projeterExperience());
      return;
    }

    if (methode === "GET" && chemin === "/api/population") {
      repondreJson(reponse, 200, controleur.projeterPopulation());
      return;
    }

    if (methode === "GET" && chemin === "/api/agents") {
      repondreJson(reponse, 200, { agents: controleur.projeterAgents() });
      return;
    }

    if (methode === "GET" && chemin.startsWith("/api/agents/")) {
      const reste = chemin.slice("/api/agents/".length);
      const segments = reste.split("/").filter(Boolean);
      const identifiant =
        segments[0] !== undefined ? decodeURIComponent(segments[0]) : "";
      if (identifiant === "") {
        repondreJson(reponse, 400, { erreur: "identifiant agent manquant" });
        return;
      }

      if (segments[1] === "evenements") {
        const agent = controleur.projeterAgent(identifiant);
        if (agent === undefined) {
          repondreJson(reponse, 404, { erreur: "Agent introuvable" });
          return;
        }
        repondreJson(reponse, 200, {
          identifiant,
          evenements: controleur.projeterEvenementsAgent(identifiant),
        });
        return;
      }

      if (segments[1] === "xway") {
        const xwayAgent = controleur.projeterXwayAgent(identifiant);
        if (xwayAgent === undefined) {
          repondreJson(reponse, 404, { erreur: "Agent introuvable" });
          return;
        }
        repondreJson(reponse, 200, xwayAgent);
        return;
      }

      if (segments[1] === "decisions") {
        const agent = controleur.projeterAgent(identifiant);
        if (agent === undefined) {
          repondreJson(reponse, 404, { erreur: "Agent introuvable" });
          return;
        }
        repondreJson(reponse, 200, {
          identifiant,
          decisions: controleur.projeterDecisionsAgent(identifiant),
          resume: controleur.projeterResumeDecisionAgent(identifiant),
        });
        return;
      }

      if (segments[1] === "fitness") {
        const fenetre = parserFenetre(url);
        const fitness = controleur.projeterFitnessAgent(
          identifiant,
          fenetre,
        );
        if (fitness === undefined) {
          repondreJson(reponse, 404, { erreur: "Agent introuvable" });
          return;
        }
        repondreJson(reponse, 200, fitness);
        return;
      }

      if (segments[1] === "resultat-economique-hors-reproduction-v03") {
        const fenetre = parserFenetre(url);
        if (fenetre === undefined) {
          repondreJson(reponse, 400, {
            erreur:
              "Fenêtre : cycleDebut et cycleFin entiers requis ensemble",
          });
          return;
        }
        try {
          const montant =
            controleur.calculerResultatEconomiqueHorsReproductionV03(
              identifiant,
              fenetre,
            );
          repondreJson(reponse, 200, {
            identifiantAgent: identifiant,
            fenetre,
            resultatEconomiqueHorsReproductionMicroUsdc: montant.toString(10),
            conventionPlage: "[cycleDebut, cycleFin] inclusive",
          });
        } catch (erreur) {
          const message =
            erreur instanceof Error ? erreur.message : String(erreur);
          repondreJson(reponse, 400, { erreur: message });
        }
        return;
      }

      if (segments.length === 1) {
        const agent = controleur.projeterAgent(identifiant);
        if (agent === undefined) {
          repondreJson(reponse, 404, { erreur: "Agent introuvable" });
          return;
        }
        repondreJson(reponse, 200, agent);
        return;
      }

      repondreJson(reponse, 404, { erreur: "Route introuvable" });
      return;
    }

    if (methode === "POST" && chemin.startsWith("/api/agents/")) {
      const reste = chemin.slice("/api/agents/".length);
      const segments = reste.split("/").filter(Boolean);
      const identifiant =
        segments[0] !== undefined ? decodeURIComponent(segments[0]) : "";
      if (identifiant === "") {
        repondreJson(reponse, 400, { erreur: "identifiant agent manquant" });
        return;
      }

      if (segments[1] === "reproduire" && segments.length === 2) {
        const resultat = await controleur.demanderReproduction(identifiant);
        repondreJson(reponse, 200, resultat);
        return;
      }

      if (segments[1] === "inference-test" && segments.length === 2) {
        const resultat = await controleur.executerInferenceTest(identifiant);
        repondreJson(reponse, 200, resultat);
        return;
      }

      repondreJson(reponse, 404, { erreur: "Route introuvable" });
      return;
    }

    if (methode === "GET" && chemin === "/api/arbre-genealogique") {
      repondreJson(reponse, 200, controleur.projeterArbre());
      return;
    }

    if (methode === "GET" && chemin === "/api/tresorerie") {
      repondreJson(reponse, 200, controleur.projeterTresorerie());
      return;
    }

    if (methode === "GET" && chemin === "/api/xway") {
      repondreJson(reponse, 200, controleur.projeterXway());
      return;
    }

    if (methode === "GET" && chemin === "/api/activite-decisionnelle") {
      repondreJson(reponse, 200, controleur.projeterActiviteDecisionnelle());
      return;
    }

    if (methode === "GET" && chemin === "/api/fitness") {
      repondreJson(
        reponse,
        200,
        controleur.projeterFitnessPopulation(parserFenetre(url)),
      );
      return;
    }

    if (
      methode === "GET" &&
      chemin === "/api/observabilite-reproduction-economique-v03"
    ) {
      const cycleBrut = url.searchParams.get("numeroCycle");
      if (cycleBrut === null || !/^\d+$/.test(cycleBrut)) {
        repondreJson(reponse, 400, {
          erreur: "Paramètre numeroCycle entier requis",
        });
        return;
      }
      const projection = controleur.projeterObservabiliteReproductionEconomiqueV03(
        Number(cycleBrut),
      );
      if (projection === null) {
        repondreJson(reponse, 404, {
          erreur: "Aucune planification v0.3 pour ce cycle",
        });
        return;
      }
      repondreJson(reponse, 200, serialiserObservabiliteV03Api(projection));
      return;
    }

    if (methode === "GET" && chemin === "/api/activite-recente") {
      const limiteBrute = url.searchParams.get("limite");
      const limite =
        limiteBrute !== null && /^\d+$/.test(limiteBrute)
          ? Number(limiteBrute)
          : 40;
      repondreJson(reponse, 200, {
        evenements: controleur.projeterActiviteRecente(limite),
      });
      return;
    }

    if (methode === "GET" && chemin === "/api/historique") {
      repondreJson(reponse, 200, {
        points: controleur.projeterHistorique(),
      });
      return;
    }

    if (methode === "POST" && chemin === "/api/experience/avancer") {
      const resultat = await controleur.avancerUnCycle();
      repondreJson(reponse, 200, resultat);
      return;
    }

    if (methode === "POST" && chemin === "/api/experience/demarrer") {
      repondreJson(reponse, 200, controleur.demarrer());
      return;
    }

    if (methode === "POST" && chemin === "/api/experience/pause") {
      repondreJson(reponse, 200, controleur.mettreEnPause());
      return;
    }

    if (methode === "GET" && chemin === "/api/couts-infrastructure-externe") {
      repondreJson(reponse, 200, controleur.projeterCoutsInfrastructureExterne());
      return;
    }

    repondreJson(reponse, 404, { erreur: "Route introuvable" });
  } catch (erreur) {
    if (erreur instanceof ControleurExperienceErreur) {
      repondreJson(reponse, 409, { erreur: erreur.message });
      return;
    }
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    repondreJson(reponse, 500, { erreur: message });
  }
}

function parserFenetre(url: URL): FenetreEvaluation | undefined {
  const debutBrut = url.searchParams.get("cycleDebut");
  const finBrut = url.searchParams.get("cycleFin");
  if (debutBrut === null && finBrut === null) {
    return undefined;
  }
  if (
    debutBrut === null ||
    finBrut === null ||
    !/^\d+$/.test(debutBrut) ||
    !/^\d+$/.test(finBrut)
  ) {
    throw new ControleurExperienceErreur(
      "Fenêtre fitness : cycleDebut et cycleFin entiers requis ensemble",
    );
  }
  return {
    cycleDebut: Number(debutBrut),
    cycleFin: Number(finBrut),
  };
}

/**
 * Sérialise l'agrégat v03-C pour l'API (bigint → chaînes décimales).
 * Aucun score, rang, ni classement.
 */
function serialiserObservabiliteV03Api(
  projection: NonNullable<
    ReturnType<ControleurExperience["projeterObservabiliteReproductionEconomiqueV03"]>
  >,
): Record<string, unknown> {
  return {
    version: projection.version,
    numeroCycle: projection.numeroCycle,
    nombreParentsCandidats: projection.nombreParentsCandidats,
    fenetresOuvertes: projection.fenetresOuvertes,
    fenetresFermeesParMotif: projection.fenetresFermeesParMotif,
    capaciteEconomiqueTheoriqueTotale:
      projection.capaciteEconomiqueTheoriqueTotale.toString(10),
    capaciteApresLimiteEnfantsTotale:
      projection.capaciteApresLimiteEnfantsTotale.toString(10),
    capaciteEconomiqueTheoriqueEligible:
      projection.capaciteEconomiqueTheoriqueEligible.toString(10),
    capaciteBloqueeParPlafondParent:
      projection.capaciteBloqueeParPlafondParent.toString(10),
    capaciteDisponibleApresPlafondParent:
      projection.capaciteDisponibleApresPlafondParent.toString(10),
    capaciteBloqueeParPlafondsGlobaux:
      projection.capaciteBloqueeParPlafondsGlobaux.toString(10),
    tentativesPlanifiees: projection.tentativesPlanifiees,
    tentativesReellementEvaluees: projection.tentativesReellementEvaluees,
    tentativesAutorisees: projection.tentativesAutorisees,
    tentativesRefusees: projection.tentativesRefusees,
    naissancesRealisees: projection.naissancesRealisees,
    refusParMotif: projection.refusParMotif,
    refusEvaluesParMotif: projection.refusEvaluesParMotif,
    refusPropagationParMotif: projection.refusPropagationParMotif,
    placesGlobalesPlanifiees: projection.placesGlobalesPlanifiees,
    placesPlanifieesNonUtilisees: projection.placesPlanifieesNonUtilisees,
    placesGlobalesNonUtilisees: projection.placesGlobalesNonUtilisees,
    placesNonDemandeesParLePlan: projection.placesNonDemandeesParLePlan,
    tentativesPlanifieesNonRealisees:
      projection.tentativesPlanifieesNonRealisees,
    opportunitesEconomiquementFinancables:
      projection.opportunitesEconomiquementFinancables.toString(10),
    opportunitesBloqueesParGardeFous:
      projection.opportunitesBloqueesParGardeFous.toString(10),
    fermeturesNombreEnfantsMax: projection.fermeturesNombreEnfantsMax,
    fermeturesPopulationMaximale: projection.fermeturesPopulationMaximale,
    fermeturesReproductionsCycleMax:
      projection.fermeturesReproductionsCycleMax,
    pressionGardeFous: {
      numerateur: projection.opportunitesBloqueesParGardeFous.toString(10),
      denominateur:
        projection.capaciteEconomiqueTheoriqueEligible.toString(10),
    },
    arretsFenetreParParent: projection.arretsFenetreParParent,
    parents: projection.parents,
  };
}

function repondreJson(
  reponse: ServerResponse,
  code: number,
  corps: unknown,
): void {
  const texte = serialiserJsonApi(corps);
  reponse.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  reponse.end(texte);
}
