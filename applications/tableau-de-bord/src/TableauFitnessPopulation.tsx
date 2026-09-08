import { useMemo, useState } from "react";
import type { ProjectionLigneFitnessPopulation } from "./api-client.js";

type CleTri =
  | "identifiantAgent"
  | "etatSurvie"
  | "venFin"
  | "resultatApresContrat"
  | "depensesCompute"
  | "tauxDecisionsOptimalesExAnteBps"
  | "regretExAnteCumule"
  | "drawdownMax"
  | "runwayMinimumObserve"
  | "contributionProprietaire";

type Props = {
  readonly agents: readonly ProjectionLigneFitnessPopulation[];
  readonly avertissement: string;
  readonly onSelection: (identifiant: string) => void;
};

/**
 * Tableau comparatif multidimensionnel — tri par colonne uniquement.
 * Aucun classement synthétique / score global.
 */
export function TableauFitnessPopulation(props: Props) {
  const [cleTri, setCleTri] = useState<CleTri>("venFin");
  const [croissant, setCroissant] = useState(false);

  const lignes = useMemo(() => {
    const copie = [...props.agents];
    copie.sort((a, b) => {
      const sens = croissant ? 1 : -1;
      const va = valeurTri(a, cleTri);
      const vb = valeurTri(b, cleTri);
      if (va < vb) {
        return -1 * sens;
      }
      if (va > vb) {
        return 1 * sens;
      }
      return a.identifiantAgent.localeCompare(b.identifiantAgent);
    });
    return copie;
  }, [props.agents, cleTri, croissant]);

  function basculer(cle: CleTri): void {
    if (cle === cleTri) {
      setCroissant(!croissant);
      return;
    }
    setCleTri(cle);
    setCroissant(false);
  }

  return (
    <section className="panneau fitness-population" aria-label="Fitness descriptive">
      <div className="titre-section">
        <h2>Fitness descriptive — population</h2>
      </div>
      <p className="banniere-fitness">{props.avertissement.replaceAll("_", " ")}</p>
      <p className="rappel">
        Tri par colonne explicite uniquement — aucune sélection active.
      </p>
      <div className="table-scroll">
        <table className="table-fitness">
          <thead>
            <tr>
              <Th cle="identifiantAgent" actuel={cleTri} onTri={basculer} libelle="Agent" />
              <Th cle="etatSurvie" actuel={cleTri} onTri={basculer} libelle="État" />
              <Th cle="venFin" actuel={cleTri} onTri={basculer} libelle="VEN" />
              <Th
                cle="resultatApresContrat"
                actuel={cleTri}
                onTri={basculer}
                libelle="Après contrat"
              />
              <Th cle="depensesCompute" actuel={cleTri} onTri={basculer} libelle="Compute" />
              <Th
                cle="tauxDecisionsOptimalesExAnteBps"
                actuel={cleTri}
                onTri={basculer}
                libelle="Opt. ex ante %"
              />
              <Th cle="regretExAnteCumule" actuel={cleTri} onTri={basculer} libelle="Regret" />
              <Th cle="drawdownMax" actuel={cleTri} onTri={basculer} libelle="Drawdown" />
              <Th cle="runwayMinimumObserve" actuel={cleTri} onTri={basculer} libelle="Runway min" />
              <Th
                cle="contributionProprietaire"
                actuel={cleTri}
                onTri={basculer}
                libelle="Loyers+redev."
              />
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.identifiantAgent}>
                <td>
                  <button
                    type="button"
                    className="lien-agent"
                    onClick={() => {
                      props.onSelection(ligne.identifiantAgent);
                    }}
                  >
                    {ligne.identifiantAgent}
                  </button>
                </td>
                <td className={`etat-texte ${ligne.etatSurvie}`}>{ligne.etatSurvie}</td>
                <td className="mono">{ligne.venFin.usdc}</td>
                <td className="mono">{ligne.resultatApresContrat.usdc}</td>
                <td className="mono">{ligne.depensesCompute.usdc}</td>
                <td className="mono">
                  {ligne.tauxDecisionsOptimalesExAnteBps === null
                    ? "—"
                    : `${String(ligne.tauxDecisionsOptimalesExAnteBps)} bps`}
                </td>
                <td className="mono">
                  {ligne.regretExAnteCumule.microUsdcArrondiAffichage.usdc}
                </td>
                <td className="mono">{ligne.drawdownMax.usdc}</td>
                <td className="mono">
                  {ligne.runwayMinimumObserve === null
                    ? "—"
                    : String(ligne.runwayMinimumObserve)}
                </td>
                <td className="mono">{ligne.contributionProprietaire.usdc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th(props: {
  readonly cle: CleTri;
  readonly actuel: CleTri;
  readonly libelle: string;
  readonly onTri: (cle: CleTri) => void;
}) {
  return (
    <th>
      <button
        type="button"
        className={`tri-colonne${props.actuel === props.cle ? " actif" : ""}`}
        onClick={() => {
          props.onTri(props.cle);
        }}
      >
        {props.libelle}
      </button>
    </th>
  );
}

function valeurTri(
  ligne: ProjectionLigneFitnessPopulation,
  cle: CleTri,
): string | number | bigint {
  switch (cle) {
    case "identifiantAgent":
      return ligne.identifiantAgent;
    case "etatSurvie":
      return ligne.etatSurvie;
    case "venFin":
      return BigInt(ligne.venFin.microUsdc);
    case "resultatApresContrat":
      return BigInt(ligne.resultatApresContrat.microUsdc);
    case "depensesCompute":
      return BigInt(ligne.depensesCompute.microUsdc);
    case "tauxDecisionsOptimalesExAnteBps":
      return ligne.tauxDecisionsOptimalesExAnteBps ?? -1;
    case "regretExAnteCumule":
      return BigInt(ligne.regretExAnteCumule.numerateurMicroUsdcBps);
    case "drawdownMax":
      return BigInt(ligne.drawdownMax.microUsdc);
    case "runwayMinimumObserve":
      return ligne.runwayMinimumObserve ?? -1;
    case "contributionProprietaire":
      return BigInt(ligne.contributionProprietaire.microUsdc);
    default:
      return 0;
  }
}
