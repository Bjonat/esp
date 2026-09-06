import type { ProjectionAgent, ProjectionArbre } from "./api-client.js";

type Props = {
  readonly arbre: ProjectionArbre;
  readonly agents: readonly ProjectionAgent[];
  readonly selection: string | null;
  readonly onSelection: (identifiant: string) => void;
};

/**
 * Carte / arbre de population.
 * Accepte déjà les relations parent→enfant pour la future reproduction.
 * En v0.1 : uniquement des racines Genesis — aucun faux enfant.
 */
export function CartePopulation(props: Props) {
  const venMax = props.agents.reduce((max, agent) => {
    const ven = BigInt(agent.economie.valeurEconomiqueNette.microUsdc);
    return ven > max ? ven : max;
  }, 0n);

  return (
    <div className="carte-population">
      <p className="legende-etats">
        <span className="etat sain">sain</span>
        <span className="etat contraint">contraint</span>
        <span className="etat critique">critique</span>
        <span className="etat dormant">dormant</span>
        <span className="etat mort">mort</span>
      </p>
      <div className="racines" role="list">
        {props.arbre.racines.map((identifiant) => {
          const agent = props.agents.find((a) => a.identifiant === identifiant);
          if (agent === undefined) {
            return null;
          }
          const ven = BigInt(agent.economie.valeurEconomiqueNette.microUsdc);
          const ratio =
            venMax > 0n ? Number((ven * 100n) / venMax) / 100 : 0.4;
          const taille = 2.4 + ratio * 1.6;
          const selectionne = props.selection === identifiant;

          return (
            <button
              key={identifiant}
              type="button"
              role="listitem"
              className={`noeud-agent ${agent.etatSurvie}${selectionne ? " selectionne" : ""}`}
              style={{ ["--taille-noeud" as string]: `${String(taille)}rem` }}
              onClick={() => {
                props.onSelection(identifiant);
              }}
              title={`${identifiant} — VEN ${agent.economie.valeurEconomiqueNette.usdc} USDC`}
            >
              <span className="id-court">
                {identifiant.split("-").slice(-1)[0] ?? identifiant}
              </span>
              <span className="ven-mini">
                {agent.economie.valeurEconomiqueNette.usdc}
              </span>
            </button>
          );
        })}
      </div>
      {props.arbre.relations.length === 0 && (
        <p className="rappel">
          {props.arbre.racines.length} racines Genesis · 0 relation
          parent-enfant
        </p>
      )}
    </div>
  );
}
