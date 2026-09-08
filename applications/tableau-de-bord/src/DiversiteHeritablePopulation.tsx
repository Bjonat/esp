import type {
  ProjectionDiversiteHeritablePopulation,
  ProjectionGeneDiversite,
} from "./api-client.js";

type Props = {
  readonly diversite: ProjectionDiversiteHeritablePopulation;
};

/**
 * Panneau population — diversité héritable descriptive.
 * Aucune corrélation fitness, aucun « gène gagnant ».
 */
export function DiversiteHeritablePopulation(props: Props) {
  const { diversite } = props;

  return (
    <section
      className="panneau diversite-heritable"
      aria-label="Diversité héritable"
    >
      <div className="titre-section">
        <h2>Diversité héritable</h2>
      </div>
      <p className="banniere-fitness">
        {diversite.avertissement.replaceAll("_", " ")}
      </p>
      <p className="rappel">
        Catalogue {diversite.versionCatalogueGenes} · cycle{" "}
        {String(diversite.cycleCourant)} — observation descriptive uniquement.
      </p>
      <dl className="metriques-compactes">
        <div>
          <dt>Configurations distinctes</dt>
          <dd>{String(diversite.nombreConfigurationsHeritablesDistinctes)}</dd>
        </div>
        <div>
          <dt>Mutations cumulées</dt>
          <dd>{String(diversite.nombreMutationsCumulees)}</dd>
        </div>
        <div>
          <dt>Mutations (cycle courant)</dt>
          <dd>{String(diversite.nombreMutationsCycle)}</dd>
        </div>
        <div>
          <dt>Agents ≥1 mutation depuis parent</dt>
          <dd>
            {String(diversite.nombreAgentsAvecAuMoinsUneMutationDepuisParent)}
          </dd>
        </div>
      </dl>

      <h3>Distribution des paramètres</h3>
      {diversite.genes.length === 0 ? (
        <p className="rappel">Aucune distribution de paramètre disponible.</p>
      ) : (
        <ul className="liste-genes">
          {diversite.genes.map((gene) => (
            <li key={gene.cle} className="ligne-gene">
              <span className="mono cle-gene">{gene.cle}</span>
              <span className="resume mono">{formaterGene(gene)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formaterGene(gene: ProjectionGeneDiversite): string {
  if (gene.type === "categoriel") {
    const comptes = Object.entries(gene.comptesParValeur)
      .map(([valeur, n]) => `${valeur}: ${String(n)}`)
      .join(" · ");
    return comptes.length > 0 ? comptes : "—";
  }
  if (gene.type === "bps") {
    return `min ${fmtNum(gene.min)} · médiane ${fmtNum(gene.mediane)} · max ${fmtNum(gene.max)}`;
  }
  return `min ${gene.min ?? "—"} · médiane ${gene.mediane ?? "—"} · max ${gene.max ?? "—"}`;
}

function fmtNum(valeur: number | null): string {
  return valeur === null ? "—" : String(valeur);
}
