import type { ReactNode } from "react";
import type { ProjectionAgent, ProjectionArbre } from "./api-client.js";

type Props = {
  readonly arbre: ProjectionArbre;
  readonly agents: readonly ProjectionAgent[];
  readonly selection: string | null;
  readonly onSelection: (identifiant: string) => void;
};

/**
 * Carte / arbre de population — relations parent→enfant depuis le registre.
 */
export function CartePopulation(props: Props) {
  const venMax = props.agents.reduce((max, agent) => {
    const ven = BigInt(agent.economie.valeurEconomiqueNette.microUsdc);
    return ven > max ? ven : max;
  }, 0n);

  const enfantsParParent = new Map<string, string[]>();
  for (const relation of props.arbre.relations) {
    const liste = enfantsParParent.get(relation.identifiantParent) ?? [];
    liste.push(relation.identifiantEnfant);
    enfantsParParent.set(relation.identifiantParent, liste);
  }

  function renduNoeud(identifiant: string, profondeur: number): ReactNode {
    const agent = props.agents.find((a) => a.identifiant === identifiant);
    if (agent === undefined) {
      return null;
    }
    const ven = BigInt(agent.economie.valeurEconomiqueNette.microUsdc);
    const ratio = venMax > 0n ? Number((ven * 100n) / venMax) / 100 : 0.4;
    const taille = 2.0 + ratio * 1.4;
    const selectionne = props.selection === identifiant;
    const enfants = enfantsParParent.get(identifiant) ?? [];

    return (
      <div
        key={identifiant}
        className="branche-genealogique"
        style={{ marginLeft: profondeur === 0 ? 0 : "1.25rem" }}
      >
        <button
          type="button"
          className={`noeud-agent ${agent.etatSurvie}${selectionne ? " selectionne" : ""}`}
          style={{ ["--taille-noeud" as string]: `${String(taille)}rem` }}
          onClick={() => {
            props.onSelection(identifiant);
          }}
          title={`${identifiant} — gen ${String(agent.generation)} — VEN ${agent.economie.valeurEconomiqueNette.usdc}`}
        >
          <span className="id-court">
            {identifiant.split("-").slice(-1)[0] ?? identifiant}
          </span>
          <span className="ven-mini">
            g{String(agent.generation)} · {agent.economie.valeurEconomiqueNette.usdc}
          </span>
        </button>
        {enfants.map((enfantId) => renduNoeud(enfantId, profondeur + 1))}
      </div>
    );
  }

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
        {props.arbre.racines.map((identifiant) => renduNoeud(identifiant, 0))}
      </div>
      <p className="rappel">
        {props.arbre.racines.length} racines · {props.arbre.relations.length} relation
        {props.arbre.relations.length === 1 ? "" : "s"}
        {props.arbre.reproductionActivee ? " · reproduction active" : ""}
      </p>
    </div>
  );
}
