import { useEffect, useState } from "react";
import type {
  EtatConnexionApi,
  InstantaneEsp,
  ProjectionAgent,
  ProjectionEvenement,
} from "./api-client.js";
import {
  avancerCycle,
  chargerEvenementsAgent,
  chargerInstantane,
  demarrerExperience,
  pauseExperience,
  verifierSante,
} from "./api-client.js";
import { FicheAgent } from "./FicheAgent.js";
import { CartePopulation } from "./CartePopulation.js";
import { HistoriqueVen } from "./HistoriqueVen.js";

const INTERVALLE_POLLING_MS = 2000;

type OngletFiche =
  | "vue"
  | "economie"
  | "activite"
  | "decisions"
  | "recherche"
  | "portefeuille"
  | "descendance";

export function TableauDeBord() {
  const [connexion, setConnexion] = useState<EtatConnexionApi>("chargement");
  const [instantane, setInstantane] = useState<InstantaneEsp | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [agentSelectionne, setAgentSelectionne] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<OngletFiche>("vue");
  const [evenementsAgent, setEvenementsAgent] = useState<
    readonly ProjectionEvenement[]
  >([]);
  const [avanceEnCours, setAvanceEnCours] = useState(false);

  useEffect(() => {
    let annule = false;

    async function rafraichir(): Promise<void> {
      const ok = await verifierSante();
      if (annule) {
        return;
      }
      if (!ok) {
        setConnexion("deconnecte");
        setInstantane(null);
        return;
      }
      try {
        const data = await chargerInstantane();
        if (annule) {
          return;
        }
        setConnexion("connecte");
        setInstantane(data);
      } catch {
        if (!annule) {
          setConnexion("deconnecte");
          setInstantane(null);
        }
      }
    }

    void rafraichir();
    const timer = window.setInterval(() => {
      void rafraichir();
    }, INTERVALLE_POLLING_MS);

    return () => {
      annule = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (agentSelectionne === null || connexion !== "connecte") {
      setEvenementsAgent([]);
      return;
    }
    let annule = false;
    void chargerEvenementsAgent(agentSelectionne).then((evts) => {
      if (!annule) {
        setEvenementsAgent(evts);
      }
    });
    return () => {
      annule = true;
    };
  }, [agentSelectionne, connexion, instantane?.experience.numeroCycleCourant]);

  async function surAvancer(): Promise<void> {
    setErreurAction(null);
    setAvanceEnCours(true);
    try {
      await avancerCycle();
      const data = await chargerInstantane();
      setInstantane(data);
      setConnexion("connecte");
    } catch (erreur) {
      setErreurAction(
        erreur instanceof Error ? erreur.message : "Échec avance cycle",
      );
    } finally {
      setAvanceEnCours(false);
    }
  }

  async function surDemarrer(): Promise<void> {
    setErreurAction(null);
    try {
      await demarrerExperience();
      setInstantane(await chargerInstantane());
    } catch (erreur) {
      setErreurAction(
        erreur instanceof Error ? erreur.message : "Échec démarrage",
      );
    }
  }

  async function surPause(): Promise<void> {
    setErreurAction(null);
    try {
      await pauseExperience();
      setInstantane(await chargerInstantane());
    } catch (erreur) {
      setErreurAction(
        erreur instanceof Error ? erreur.message : "Échec pause",
      );
    }
  }

  const agent: ProjectionAgent | undefined =
    instantane?.agents.find((a) => a.identifiant === agentSelectionne);

  return (
    <div className="page commande">
      <header className="en-tete-commande">
        <div className="bloc-marque">
          <p className="marque">ESP</p>
          <p className="sous-titre">Centre de supervision expérimentale</p>
        </div>
        <div className="meta-experience" aria-live="polite">
          {connexion === "deconnecte" && (
            <>
              <span className="pastille deconnecte" />
              <span>Contrôleur déconnecté</span>
            </>
          )}
          {connexion === "chargement" && (
            <>
              <span className="pastille chargement" />
              <span>Connexion…</span>
            </>
          )}
          {connexion === "connecte" && instantane === null && (
            <>
              <span className="pastille" />
              <span>Aucune expérience active</span>
            </>
          )}
          {connexion === "connecte" && instantane !== null && (
            <>
              <span className="pastille connecte" />
              <span className="mono">
                {instantane.experience.identifiantExperience}
              </span>
              <span className="badge-mode">
                MODE : {instantane.experience.libelleMode}
              </span>
              <span>
                Cycle {String(instantane.experience.numeroCycleCourant)}
              </span>
              <span className="statut-exp">
                {instantane.experience.statut}
              </span>
            </>
          )}
        </div>
      </header>

      {connexion === "deconnecte" && (
        <section className="etat-vide" role="status">
          <h1>Contrôleur déconnecté</h1>
          <p>
            L&apos;API locale (127.0.0.1:3001) est inaccessible. Aucune donnée
            n&apos;est inventée.
          </p>
        </section>
      )}

      {connexion === "connecte" && instantane === null && (
        <section className="etat-vide" role="status">
          <h1>Aucune expérience active</h1>
          <p>Le contrôleur répond mais aucune expérience n&apos;est chargée.</p>
        </section>
      )}

      {connexion === "connecte" && instantane !== null && (
        <main className="grille-commande">
          <section className="bandeau-kpi" aria-label="Indicateurs">
            <Kpi libelle="Population" valeur={String(instantane.population.populationTotale)} />
            <Kpi libelle="Vivants" valeur={String(instantane.population.agentsVivants)} />
            <Kpi libelle="Dormants" valeur={String(instantane.population.agentsDormants)} />
            <Kpi libelle="Morts" valeur={String(instantane.population.agentsMorts)} />
            <Kpi libelle="Cycle" valeur={String(instantane.population.cycleCourant)} />
            <Kpi libelle="VEN population" valeur={`${instantane.population.venTotale.usdc} USDC`} />
            <Kpi
              libelle="Trésorerie propriétaire"
              valeur={`${instantane.tresorerie.soldeNet.usdc} USDC`}
            />
            <Kpi
              libelle="Loyers cumulés"
              valeur={`${instantane.population.loyersCumulesVerses.usdc} USDC`}
            />
            <Kpi
              libelle="Redevances cumulées"
              valeur={`${instantane.population.redevancesCumulees.usdc} USDC`}
            />
          </section>

          <section className="panneau controles" aria-label="Contrôle">
            <h2>Contrôle</h2>
            <p className="rappel">
              La cadence wall-clock ne modifie jamais les règles économiques.
            </p>
            <div className="boutons">
              <button
                type="button"
                className="bouton primaire"
                disabled={avanceEnCours}
                onClick={() => {
                  void surAvancer();
                }}
              >
                {avanceEnCours ? "Avance…" : "Avancer d'un cycle"}
              </button>
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  void surDemarrer();
                }}
              >
                Démarrer
              </button>
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  void surPause();
                }}
              >
                Pause
              </button>
            </div>
            {erreurAction !== null && (
              <p className="erreur-action" role="alert">
                {erreurAction}
              </p>
            )}
          </section>

          <section className="panneau population" aria-label="Population">
            <div className="titre-section">
              <h2>Carte de population</h2>
              <p className="rappel">{instantane.arbre.message}</p>
            </div>
            <CartePopulation
              arbre={instantane.arbre}
              agents={instantane.agents}
              selection={agentSelectionne}
              onSelection={(id) => {
                setAgentSelectionne(id);
                setOnglet("vue");
              }}
            />
          </section>

          <section className="panneau activite" aria-label="Activité récente">
            <h2>Activité récente</h2>
            <ul className="timeline">
              {instantane.activite.length === 0 && (
                <li className="vide">Aucun événement d&apos;activité pour l&apos;instant.</li>
              )}
              {instantane.activite.map((evt) => (
                <li key={evt.identifiant} className="ligne-evt">
                  <span className="mono agent">
                    {evt.identifiantAgent ?? "—"}
                  </span>
                  <span className="cycle">Cycle {String(evt.numeroCycle)}</span>
                  <span className="type">{evt.type}</span>
                  <span className="resume">{evt.resume}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panneau tresorerie" aria-label="Trésorerie">
            <h2>Trésorerie propriétaire</h2>
            <dl className="metriques-compactes">
              <div>
                <dt>Loyers encaissés</dt>
                <dd>{instantane.tresorerie.revenusLoyers.usdc} USDC</dd>
              </div>
              <div>
                <dt>Redevances encaissées</dt>
                <dd>{instantane.tresorerie.revenusRedevances.usdc} USDC</dd>
              </div>
              <div>
                <dt>Dépenses infrastructure</dt>
                <dd>{instantane.tresorerie.depensesInfrastructure.usdc} USDC</dd>
              </div>
              <div>
                <dt>Solde net</dt>
                <dd>{instantane.tresorerie.soldeNet.usdc} USDC</dd>
              </div>
            </dl>
          </section>

          <section className="panneau historique" aria-label="Historique VEN">
            <h2>Historique VEN population</h2>
            <HistoriqueVen points={instantane.historique} />
          </section>

          {agent !== undefined && (
            <FicheAgent
              agent={agent}
              evenements={evenementsAgent}
              onglet={onglet}
              onOnglet={setOnglet}
              onFermer={() => {
                setAgentSelectionne(null);
              }}
            />
          )}
        </main>
      )}
    </div>
  );
}

function Kpi(props: { libelle: string; valeur: string }) {
  return (
    <div className="kpi">
      <span className="kpi-libelle">{props.libelle}</span>
      <span className="kpi-valeur">{props.valeur}</span>
    </div>
  );
}
