import type { PointHistorique } from "./api-client.js";

type Props = {
  readonly points: readonly PointHistorique[];
};

/**
 * Mini historique VEN — sans framework de dataviz.
 */
export function HistoriqueVen(props: Props) {
  if (props.points.length === 0) {
    return <p className="rappel">Pas encore d&apos;historique de cycle.</p>;
  }

  const recent = props.points.slice(-24);
  let max = 0n;
  for (const point of recent) {
    const ven = BigInt(point.venTotale.microUsdc);
    const absolu = ven < 0n ? -ven : ven;
    if (absolu > max) {
      max = absolu;
    }
  }

  return (
    <div className="historique-ven">
      <div className="barres" role="img" aria-label="VEN population par cycle">
        {recent.map((point) => {
          const ven = BigInt(point.venTotale.microUsdc);
          const absolu = ven < 0n ? -ven : ven;
          const hauteur =
            max === 0n ? 8 : Math.max(8, Number((absolu * 64n) / max));
          return (
            <div
              key={point.numeroCycle}
              className={`barre${ven < 0n ? " negative" : ""}`}
              style={{ height: `${String(hauteur)}px` }}
              title={`Cycle ${String(point.numeroCycle)} : ${point.venTotale.usdc} USDC`}
            />
          );
        })}
      </div>
      <p className="rappel">
        Dernier point : cycle {String(recent[recent.length - 1]?.numeroCycle)} ·{" "}
        {recent[recent.length - 1]?.venTotale.usdc} USDC
      </p>
    </div>
  );
}
