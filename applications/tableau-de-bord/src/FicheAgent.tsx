import type { ProjectionAgent, ProjectionEvenement } from "./api-client.js";

type Onglet =
  | "vue"
  | "economie"
  | "activite"
  | "decisions"
  | "recherche"
  | "portefeuille"
  | "descendance";

type Props = {
  readonly agent: ProjectionAgent;
  readonly evenements: readonly ProjectionEvenement[];
  readonly onglet: Onglet;
  readonly onOnglet: (onglet: Onglet) => void;
  readonly onFermer: () => void;
};

const ONGLET_LIBELLES: Record<Onglet, string> = {
  vue: "Vue d'ensemble",
  economie: "Économie",
  activite: "Activité",
  decisions: "Décisions",
  recherche: "Recherche",
  portefeuille: "Portefeuille",
  descendance: "Descendance",
};

/**
 * Fiche agent — données exclusivement issues de l'API / registre.
 * Placeholders honnêtes pour les modules non connectés.
 */
export function FicheAgent(props: Props) {
  const { agent } = props;

  return (
    <section className="panneau fiche-agent" aria-label="Fiche agent">
      <div className="titre-section">
        <h2>Fiche agent</h2>
        <button type="button" className="bouton fantome" onClick={props.onFermer}>
          Fermer
        </button>
      </div>

      <p className="mono identifiant-fiche">{agent.identifiant}</p>

      <nav className="onglets" aria-label="Sections fiche">
        {(Object.keys(ONGLET_LIBELLES) as Onglet[]).map((cle) => (
          <button
            key={cle}
            type="button"
            className={`onglet${props.onglet === cle ? " actif" : ""}`}
            onClick={() => {
              props.onOnglet(cle);
            }}
          >
            {ONGLET_LIBELLES[cle]}
          </button>
        ))}
      </nav>

      {props.onglet === "vue" && (
        <dl className="metriques-compactes">
          <div>
            <dt>Identifiant</dt>
            <dd className="mono">{agent.identifiant}</dd>
          </div>
          <div>
            <dt>Génération</dt>
            <dd>{String(agent.generation)}</dd>
          </div>
          <div>
            <dt>Parent</dt>
            <dd>{agent.identifiantParent ?? "— (Genesis)"}</dd>
          </div>
          <div>
            <dt>État</dt>
            <dd className={`etat-texte ${agent.etatSurvie}`}>{agent.etatSurvie}</dd>
          </div>
          <div>
            <dt>Naissance (cycle)</dt>
            <dd>{String(agent.cycleNaissance)}</dd>
          </div>
          <div>
            <dt>Dernier cycle actif</dt>
            <dd>{String(agent.dernierCycleActif)}</dd>
          </div>
          <div>
            <dt>Runway</dt>
            <dd>{String(agent.runway)}</dd>
          </div>
        </dl>
      )}

      {props.onglet === "economie" && (
        <dl className="metriques-compactes">
          <LigneMontant libelle="Capital liquide" montant={agent.economie.capitalLiquide.usdc} />
          <LigneMontant libelle="Obligations" montant={agent.economie.obligations.usdc} />
          <LigneMontant libelle="VEN" montant={agent.economie.valeurEconomiqueNette.usdc} />
          <LigneMontant libelle="HWM" montant={agent.economie.highWaterMark.usdc} />
          <LigneMontant libelle="Revenus activité" montant={agent.economie.revenusCumules.usdc} />
          <LigneMontant libelle="Pertes activité" montant={agent.economie.pertesCumulees.usdc} />
          <LigneMontant libelle="Compute" montant={agent.economie.compute.usdc} />
          <LigneMontant libelle="Données" montant={agent.economie.donnees.usdc} />
          <LigneMontant libelle="Frais" montant={agent.economie.fraisExecution.usdc} />
          <LigneMontant libelle="Loyers" montant={agent.economie.loyers.usdc} />
          <LigneMontant libelle="Redevances" montant={agent.economie.redevances.usdc} />
        </dl>
      )}

      {props.onglet === "activite" && (
        <ul className="timeline">
          {props.evenements.length === 0 && (
            <li className="vide">Aucun événement pour cet agent.</li>
          )}
          {[...props.evenements].reverse().map((evt) => (
            <li key={evt.identifiant} className="ligne-evt">
              <span className="cycle">Cycle {String(evt.numeroCycle)}</span>
              <span className="type">{evt.type}</span>
              <span className="resume">{evt.resume}</span>
            </li>
          ))}
        </ul>
      )}

      {props.onglet === "decisions" && (
        <p className="placeholder-honnete">Moteur de décision non connecté</p>
      )}
      {props.onglet === "recherche" && (
        <p className="placeholder-honnete">
          Aucune source de données ou recherche connectée
        </p>
      )}
      {props.onglet === "portefeuille" && (
        <p className="placeholder-honnete">
          Aucun environnement financier connecté
        </p>
      )}
      {props.onglet === "descendance" && (
        <div>
          <p className="placeholder-honnete">Reproduction non activée</p>
          <p className="rappel">
            Enfants : {String(agent.identifiantsEnfants.length)}
          </p>
        </div>
      )}
    </section>
  );
}

function LigneMontant(props: { libelle: string; montant: string }) {
  return (
    <div>
      <dt>{props.libelle}</dt>
      <dd>{props.montant} USDC</dd>
    </div>
  );
}
