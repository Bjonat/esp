import type {
  ProjectionAgent,
  ProjectionDynamiqueEvolutive,
  ProjectionEvenement,
} from "./api-client.js";

type Props = {
  readonly dynamique: ProjectionDynamiqueEvolutive;
  readonly cycleCourant: number;
  readonly agents: readonly ProjectionAgent[];
  readonly activite: readonly ProjectionEvenement[];
  readonly onSelectionAgent?: (identifiant: string) => void;
};

/**
 * Panneau population — dynamique évolutive descriptive.
 * Sélection émergente sans ranking fitness ; aucun gène causal.
 */
export function DynamiqueEvolutivePopulation(props: Props) {
  const { dynamique } = props;
  const lignesCycle = construireLignesDernierCycle(
    props.activite,
    props.agents,
    props.cycleCourant,
  );

  return (
    <section
      className="panneau dynamique-evolutive"
      aria-label="Dynamique évolutive"
    >
      <div className="titre-section">
        <h2>Dynamique évolutive</h2>
      </div>
      <p className="banniere-fitness">
        {dynamique.avertissement.replaceAll("_", " ")}
      </p>
      <p className="rappel">
        Observation descriptive — aucune sélection par fitness, aucune attribution
        causale de gène.
      </p>

      <dl className="metriques-compactes">
        <div>
          <dt>Population actuelle</dt>
          <dd>{String(dynamique.populationActuelle)}</dd>
        </div>
        <div>
          <dt>Naissances (cycle)</dt>
          <dd>{String(dynamique.naissancesCycle)}</dd>
        </div>
        <div>
          <dt>Générations présentes</dt>
          <dd>
            {dynamique.generationsPresentes.length === 0
              ? "—"
              : dynamique.generationsPresentes.map(String).join(", ")}
          </dd>
        </div>
        <div>
          <dt>Lignées vivantes</dt>
          <dd>{String(dynamique.ligneesVivantes)}</dd>
        </div>
        <div>
          <dt>Candidats</dt>
          <dd>{String(dynamique.candidatsReproduction)}</dd>
        </div>
        <div>
          <dt>Autorisées</dt>
          <dd>{String(dynamique.reproductionsAutorisees)}</dd>
        </div>
        <div>
          <dt>Refus économiques</dt>
          <dd>{String(dynamique.refusEconomiques)}</dd>
        </div>
        <div>
          <dt>Refus capacité</dt>
          <dd>{String(dynamique.refusCapacite)}</dd>
        </div>
        <div>
          <dt>Configs distinctes</dt>
          <dd>{String(dynamique.configurationsHeritablesDistinctes)}</dd>
        </div>
      </dl>

      <h3>Fréquences génotypes</h3>
      {dynamique.frequencesGenotypes.length === 0 ? (
        <p className="rappel">Aucune empreinte de configuration disponible.</p>
      ) : (
        <ul className="liste-genes">
          {dynamique.frequencesGenotypes.map((geno) => (
            <li key={geno.empreinteConfiguration} className="ligne-gene">
              <span className="mono cle-gene" title={geno.empreinteConfiguration}>
                {abregerEmpreinte(geno.empreinteConfiguration)}
              </span>
              <span className="resume mono">
                vivants {String(geno.agentsVivants)} · cumulés{" "}
                {String(geno.agentsCumules)} ·{" "}
                {String(geno.partPopulationVivanteBps)} bps
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3>Lignées</h3>
      {dynamique.lignees.length === 0 ? (
        <p className="rappel">Aucune lignée.</p>
      ) : (
        <div className="table-scroll">
          <table className="table-fitness table-lignees-evolutives">
            <thead>
              <tr>
                <th>Lignée</th>
                <th>Vivants</th>
                <th>Cumulés</th>
                <th>Naissances</th>
                <th>Part bps</th>
              </tr>
            </thead>
            <tbody>
              {dynamique.lignees.map((lignee) => (
                <tr key={lignee.identifiantLignee}>
                  <td className="mono" title={lignee.identifiantLignee}>
                    {abregerIdentifiant(lignee.identifiantLignee)}
                  </td>
                  <td>{String(lignee.membresVivants)}</td>
                  <td>{String(lignee.membresCumules)}</td>
                  <td>{String(lignee.naissancesCumulees)}</td>
                  <td>{String(lignee.partPopulationVivanteBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Dernier cycle reproductif</h3>
      {lignesCycle === null ? (
        <p className="rappel">
          Détail PLANIFIEE absent de l&apos;activité récente — agrégats ci-dessus
          uniquement.
        </p>
      ) : lignesCycle.length === 0 ? (
        <p className="rappel">
          Cycle {String(props.cycleCourant)} — aucune trajectoire reproductible
          exposée.
        </p>
      ) : (
        <ul className="timeline causalite-reproductive">
          {lignesCycle.map((ligne) => (
            <li key={ligne.cle} className="ligne-evt">
              <span className="cycle">Cycle {String(ligne.numeroCycle)}</span>
              {props.onSelectionAgent !== undefined &&
              ligne.identifiantAgent !== null ? (
                <button
                  type="button"
                  className="lien-agent mono agent"
                  onClick={() => {
                    props.onSelectionAgent?.(ligne.identifiantAgent!);
                  }}
                >
                  {abregerIdentifiant(ligne.identifiantAgent)}
                </button>
              ) : (
                <span className="mono agent">
                  {ligne.identifiantAgent !== null
                    ? abregerIdentifiant(ligne.identifiantAgent)
                    : "—"}
                </span>
              )}
              <span className="resume">{ligne.resume}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type LigneCausalite = {
  readonly cle: string;
  readonly numeroCycle: number;
  readonly identifiantAgent: string | null;
  readonly resume: string;
};

function construireLignesDernierCycle(
  activite: readonly ProjectionEvenement[],
  agents: readonly ProjectionAgent[],
  cycleCourant: number,
): readonly LigneCausalite[] | null {
  const plan = trouverPlanPlanifiee(activite, cycleCourant);
  if (plan === null) {
    return null;
  }

  const parId = new Map(agents.map((a) => [a.identifiant, a]));
  const enfantsParParent = new Map<string, string[]>();
  for (const agent of agents) {
    if (
      agent.identifiantParent !== null &&
      agent.cycleNaissance === plan.numeroCycle
    ) {
      const liste = enfantsParParent.get(agent.identifiantParent) ?? [];
      liste.push(agent.identifiant);
      enfantsParParent.set(agent.identifiantParent, liste);
    }
  }

  const lignes: LigneCausalite[] = [];
  const retenus = new Set(plan.identifiantsRetenus);
  const refusCap = new Set(plan.identifiantsRefusCapacite);

  for (const id of plan.identifiantsRetenus) {
    const agent = parId.get(id);
    const ven = agent?.economie.valeurEconomiqueNette.usdc ?? "?";
    const enfants = enfantsParParent.get(id) ?? [];
    const suiteEnfant =
      enfants.length === 0
        ? "reproduction"
        : `reproduction → enfant ${abregerIdentifiant(enfants[0]!)}`;
    lignes.push({
      cle: `retenu-${id}`,
      numeroCycle: plan.numeroCycle,
      identifiantAgent: id,
      resume: `VEN ${ven} → éligible → ${suiteEnfant}`,
    });
  }

  for (const id of plan.identifiantsRefusCapacite) {
    const agent = parId.get(id);
    const ven = agent?.economie.valeurEconomiqueNette.usdc ?? "?";
    lignes.push({
      cle: `capacite-${id}`,
      numeroCycle: plan.numeroCycle,
      identifiantAgent: id,
      resume: `VEN ${ven} → éligible → refus capacité`,
    });
  }

  const limiteRefusEco = 8;
  let refusEcoAjoutes = 0;
  let refusEcoOmises = 0;
  for (const agent of agents) {
    const succes = agent.succesReproductif;
    if (succes === undefined || succes.eligibleReproduction !== false) {
      continue;
    }
    if (retenus.has(agent.identifiant) || refusCap.has(agent.identifiant)) {
      continue;
    }
    if (agent.etatSurvie === "mort") {
      continue;
    }
    if (agent.cycleNaissance === plan.numeroCycle) {
      continue;
    }
    if (refusEcoAjoutes >= limiteRefusEco) {
      refusEcoOmises += 1;
      continue;
    }
    const motif = libelleMotif(succes.motifNonEligibilite);
    lignes.push({
      cle: `refus-eco-${agent.identifiant}`,
      numeroCycle: plan.numeroCycle,
      identifiantAgent: agent.identifiant,
      resume: `VEN ${agent.economie.valeurEconomiqueNette.usdc} → non éligible → ${motif}`,
    });
    refusEcoAjoutes += 1;
  }
  if (refusEcoOmises > 0) {
    lignes.push({
      cle: "refus-eco-trunc",
      numeroCycle: plan.numeroCycle,
      identifiantAgent: null,
      resume: `… et ${String(refusEcoOmises)} autre(s) refus économique(s)`,
    });
  }

  return lignes;
}

type PlanLu = {
  readonly numeroCycle: number;
  readonly identifiantsEligiblesOrdonnes: readonly string[];
  readonly identifiantsRetenus: readonly string[];
  readonly identifiantsRefusCapacite: readonly string[];
};

function trouverPlanPlanifiee(
  activite: readonly ProjectionEvenement[],
  cycleCourant: number,
): PlanLu | null {
  const candidats = activite.filter(
    (e) => e.type === "REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE",
  );
  if (candidats.length === 0) {
    return null;
  }
  const duCycle =
    candidats.find((e) => e.numeroCycle === cycleCourant) ?? candidats[0]!;
  const charge = duCycle.chargeUtile;
  const eligibles = charge.identifiantsEligiblesOrdonnes;
  const retenus = charge.identifiantsRetenus;
  const refus = charge.identifiantsRefusCapacite;
  if (
    !Array.isArray(eligibles) ||
    !Array.isArray(retenus) ||
    !Array.isArray(refus)
  ) {
    return null;
  }
  return {
    numeroCycle:
      typeof charge.numeroCycle === "number"
        ? charge.numeroCycle
        : duCycle.numeroCycle,
    identifiantsEligiblesOrdonnes: eligibles as string[],
    identifiantsRetenus: retenus as string[],
    identifiantsRefusCapacite: refus as string[],
  };
}

function abregerEmpreinte(empreinte: string): string {
  if (empreinte.length <= 14) {
    return empreinte;
  }
  return `${empreinte.slice(0, 12)}…`;
}

function abregerIdentifiant(identifiant: string): string {
  if (identifiant.length <= 18) {
    return identifiant;
  }
  return `${identifiant.slice(0, 10)}…${identifiant.slice(-4)}`;
}

function libelleMotif(motif: string | null): string {
  if (motif === null || motif.length === 0) {
    return "motif inconnu";
  }
  const libelles: Record<string, string> = {
    capital_insuffisant: "capital insuffisant",
    reserve_minimale: "réserve insuffisante",
    population_maximale: "population maximale",
    nombre_enfants_max: "nombre d'enfants max",
    reproductions_cycle_max: "reproductions cycle max",
    cooldown: "cooldown",
    agent_mort: "agent mort",
    etat_survie_non_eligible: "état de survie non éligible",
    naissance_meme_cycle: "naissance même cycle",
    reproduction_desactivee: "reproduction désactivée",
  };
  return libelles[motif] ?? motif.replaceAll("_", " ");
}
