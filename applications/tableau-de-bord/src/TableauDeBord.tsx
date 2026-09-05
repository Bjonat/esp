/**
 * Données statiques de fondation — aucune source réelle branchée.
 */
export const OBSERVATION_FONDATIONS = {
  titre: "ESP",
  statut: "Fondations",
  population: 0,
  generation: 0,
  environnement: "Non démarré",
  mode: "Développement",
} as const;

export function TableauDeBord() {
  const observation = OBSERVATION_FONDATIONS;

  return (
    <div className="page">
      <header className="en-tete">
        <p className="marque">{observation.titre}</p>
        <p className="sous-titre">Observation expérimentale</p>
      </header>

      <main className="contenu">
        <section className="statut" aria-label="Statut de l'expérience">
          <span className="indicateur" aria-hidden="true" />
          <span className="libelle-statut">{observation.statut}</span>
        </section>

        <dl className="metriques">
          <div className="metrique">
            <dt>Population</dt>
            <dd>{observation.population}</dd>
          </div>
          <div className="metrique">
            <dt>Génération</dt>
            <dd>{observation.generation}</dd>
          </div>
          <div className="metrique">
            <dt>Environnement</dt>
            <dd>{observation.environnement}</dd>
          </div>
          <div className="metrique">
            <dt>Mode</dt>
            <dd>{observation.mode}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
