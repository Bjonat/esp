import type {
  ProjectionAgent,
  ProjectionDecisionAgent,
  ProjectionEvenement,
  ProjectionFitnessAgent,
  ProjectionXwayAgent,
} from "./api-client.js";

type Onglet =
  | "vue"
  | "economie"
  | "activite"
  | "identite"
  | "xway"
  | "decisions"
  | "fitness"
  | "heritage"
  | "recherche"
  | "portefeuille"
  | "descendance";

type Props = {
  readonly agent: ProjectionAgent;
  readonly evenements: readonly ProjectionEvenement[];
  readonly xway: ProjectionXwayAgent | null;
  readonly decisions: readonly ProjectionDecisionAgent[];
  readonly fitness: ProjectionFitnessAgent | null;
  readonly onglet: Onglet;
  readonly onOnglet: (onglet: Onglet) => void;
  readonly onFermer: () => void;
};

const ONGLET_LIBELLES: Record<Onglet, string> = {
  vue: "Vue d'ensemble",
  economie: "Économie",
  activite: "Activité",
  identite: "Identité ESP",
  xway: "Cognition / Xway",
  decisions: "Décisions",
  fitness: "Performance",
  heritage: "Héritage / variation",
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
            <dt>Lignée</dt>
            <dd className="mono">{agent.identifiantLignee ?? agent.identifiant}</dd>
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

      {props.onglet === "identite" && (
        <div className="identite-agent">
          <p className="rappel">
            Identité cryptographique ESP (Ed25519) — distincte de tout wallet financier.
            Aucune clé privée n&apos;est affichée.
          </p>
          {props.agent.identite === undefined ? (
            <p className="rappel">Identité non configurée pour cette expérience.</p>
          ) : (
            <dl className="metriques-compactes">
              <div>
                <dt>Algorithme</dt>
                <dd>{props.agent.identite.algorithme ?? "—"}</dd>
              </div>
              <div>
                <dt>Statut</dt>
                <dd className="mono">
                  {libelleStatutIdentite(props.agent.identite.statut)}
                </dd>
              </div>
              <div>
                <dt>Empreinte publique</dt>
                <dd className="mono">
                  {props.agent.identite.empreinteClePublique ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Clé publique (abrégée)</dt>
                <dd className="mono">
                  {props.agent.identite.clePubliqueAbregee ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{props.agent.identite.versionIdentite ?? "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {props.onglet === "xway" && (
        <div className="xway-agent">
          <p className="badge-mode">{props.xway?.libelleFournisseur ?? "FOURNISSEUR : SIMULÉ"}</p>
          {props.xway?.fournisseurReel === true && (
            <p className="banniere-reel">
              INFÉRENCE IA RÉELLE — environnement économique toujours simulé
            </p>
          )}
          {props.xway === null ? (
            <p className="rappel">Aucune donnée Xway pour cet agent.</p>
          ) : (
            <dl className="metriques-compactes">
              <div>
                <dt>Demandes</dt>
                <dd>{String(props.xway.nombreDemandes)}</dd>
              </div>
              <div>
                <dt>Exécutées</dt>
                <dd>{String(props.xway.inferencesExecutees)}</dd>
              </div>
              <div>
                <dt>Refusées</dt>
                <dd>{String(props.xway.inferencesRefusees)}</dd>
              </div>
              <div>
                <dt>Modèles</dt>
                <dd>{props.xway.modelesUtilises.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Jetons entrée</dt>
                <dd>{String(props.xway.jetonsEntreeCumules)}</dd>
              </div>
              <div>
                <dt>Jetons sortie</dt>
                <dd>{String(props.xway.jetonsSortieCumules)}</dd>
              </div>
              <LigneMontant libelle="Coût imputé ESP" montant={props.xway.coutCumule.usdc} />
              <div>
                <dt>Coût fournisseur estimé (µUSD)</dt>
                <dd className="mono">{props.xway.coutFournisseurEstimeCumuleMicroUsd}</dd>
              </div>
              <div>
                <dt>Budget cognitif (dernier)</dt>
                <dd>
                  {props.xway.budgetCognitifDernierCycle?.usdc ?? "—"} USDC
                </dd>
              </div>
              {props.xway.derniereInference !== null && (
                <>
                  <div>
                    <dt>Dernière latence</dt>
                    <dd>
                      {props.xway.derniereInference.latenceMs !== null
                        ? `${String(props.xway.derniereInference.latenceMs)} ms`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Proposition</dt>
                    <dd>
                      {props.xway.derniereInference.propositionValide === false
                        ? "[invalide] "
                        : ""}
                      {props.xway.derniereInference.propositionResume ?? "—"}
                      {props.xway.derniereInference.propositionAction !== null
                        ? ` → ${props.xway.derniereInference.propositionAction}`
                        : ""}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>Dernier appel</dt>
                <dd>
                  {props.xway.dernierAppel === null
                    ? "—"
                    : `Cycle ${String(props.xway.dernierAppel.numeroCycle)} · ${props.xway.dernierAppel.type}`}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {props.onglet === "decisions" && (
        <div className="liste-decisions">
          {props.decisions.length === 0 ? (
            <p className="rappel">Aucune décision enregistrée pour cet agent.</p>
          ) : (
            <ul className="timeline decisions">
              {[...props.decisions].reverse().map((decision) => (
                <li key={decision.identifiantDecision} className="carte-decision">
                  <p className="cycle">
                    Cycle {String(decision.numeroCycle)} ·{" "}
                    <span className="mono">{decision.identifiantDecision}</span>
                  </p>
                  <dl className="metriques-compactes">
                    <div>
                      <dt>Opportunité</dt>
                      <dd>
                        p=
                        {decision.observation.probabiliteSuccesBps === null
                          ? "—"
                          : `${String(decision.observation.probabiliteSuccesBps)} bps`}
                        {" · "}
                        gain{" "}
                        {decision.observation.gainSiSucces?.usdc ?? "—"} / perte{" "}
                        {decision.observation.perteSiEchec?.usdc ?? "—"} / frais{" "}
                        {decision.observation.fraisAction?.usdc ?? "—"} USDC
                      </dd>
                    </div>
                    <div>
                      <dt>Cognition</dt>
                      <dd>
                        {decision.choixCognitif === null
                          ? "—"
                          : decision.choixCognitif.utiliserInference
                            ? `inférence (${decision.choixCognitif.modeleLogique ?? "?"}) · limite ${decision.choixCognitif.limiteDepense?.usdc ?? "—"} USDC`
                            : `sans inférence · ${decision.choixCognitif.motif ?? ""}`}
                        {" · coût "}
                        {decision.coutCognitif.usdc} USDC
                      </dd>
                    </div>
                    <div>
                      <dt>Décision</dt>
                      <dd>
                        {decision.decision === null
                          ? "—"
                          : `${decision.decision.action} · confiance ${String(decision.decision.confianceBps)} bps · ${decision.decision.sourceDecision}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Résultat</dt>
                      <dd>
                        {/* Jamais de résultat futur avant action exécutée. */}
                        {decision.action === null || decision.resultat === null
                          ? "en attente (aucune action exécutée)"
                          : `${decision.resultat.issue} · revenu ${decision.resultat.revenuActivite.usdc} / perte ${decision.resultat.perteActivite.usdc} / frais ${decision.resultat.fraisExecution.usdc} USDC`}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {props.onglet === "fitness" && (
        <div className="fitness-agent">
          <p className="banniere-fitness">
            FITNESS DESCRIPTIVE — aucune sélection active
          </p>
          {props.fitness === null ? (
            <p className="rappel">Chargement des mesures…</p>
          ) : (
            <>
              <h3>Économie</h3>
              <dl className="metriques-compactes">
                <LigneMontant libelle="VEN début" montant={props.fitness.economie.venDebut.usdc} />
                <LigneMontant libelle="VEN fin" montant={props.fitness.economie.venFin.usdc} />
                <LigneMontant libelle="Variation VEN" montant={props.fitness.economie.variationVen.usdc} />
                <LigneMontant
                  libelle="Variation neutralisée exogènes"
                  montant={props.fitness.economie.variationVenNeutraliseeExogenes.usdc}
                />
                <LigneMontant
                  libelle="Résultat opérationnel"
                  montant={props.fitness.economie.resultatOperationnelAvantContrat.usdc}
                />
                <LigneMontant
                  libelle="Résultat après contrat"
                  montant={props.fitness.economie.resultatApresContrat.usdc}
                />
              </dl>
              <h3>Décision</h3>
              <dl className="metriques-compactes">
                <div>
                  <dt>Décisions</dt>
                  <dd>{String(props.fitness.decision.nombreDecisions)}</dd>
                </div>
                <div>
                  <dt>Optimales ex ante</dt>
                  <dd>
                    {props.fitness.decision.tauxDecisionsOptimalesExAnteBps === null
                      ? "—"
                      : `${String(props.fitness.decision.tauxDecisionsOptimalesExAnteBps)} bps`}
                  </dd>
                </div>
                <LigneMontant
                  libelle="Regret ex ante cumulé (affichage)"
                  montant={
                    props.fitness.decision.regretExAnteCumule
                      .microUsdcArrondiAffichage.usdc
                  }
                />
                <div>
                  <dt>Regret exact (numérateur BPS)</dt>
                  <dd className="mono">
                    {props.fitness.decision.regretExAnteCumule.numerateurMicroUsdcBps}
                    /
                    {String(
                      props.fitness.decision.regretExAnteCumule.denominateurBps,
                    )}
                  </dd>
                </div>
                <LigneMontant
                  libelle="Résultat activité réalisé"
                  montant={props.fitness.decision.resultatActiviteRealise.usdc}
                />
                <div>
                  <dt>Succès / échecs</dt>
                  <dd>
                    {String(props.fitness.decision.nombreSuccesRealises)} /{" "}
                    {String(props.fitness.decision.nombreEchecsRealises)}
                  </dd>
                </div>
              </dl>
              <h3>Cognition</h3>
              <dl className="metriques-compactes">
                <div>
                  <dt>Demandes / exécutées / refus</dt>
                  <dd>
                    {String(props.fitness.cognition.nombreDemandesInference)} /{" "}
                    {String(props.fitness.cognition.nombreInferencesExecutees)} /{" "}
                    {String(props.fitness.cognition.nombreRefusXway)}
                  </dd>
                </div>
                <LigneMontant
                  libelle="Coût cognitif total"
                  montant={props.fitness.cognition.coutCognitifTotal.usdc}
                />
                <div>
                  <dt>Ratio op./cognitif (non causal)</dt>
                  <dd className="mono">
                    {props.fitness.cognition.ratioResultatOperationnelSurCoutCognitif ===
                    null
                      ? "—"
                      : props.fitness.cognition.ratioResultatOperationnelSurCoutCognitif
                          .quotientEchelleMillion}
                  </dd>
                </div>
              </dl>
              <h3>Risque / résilience</h3>
              <dl className="metriques-compactes">
                <LigneMontant libelle="Drawdown max" montant={props.fitness.risque.drawdownMax.usdc} />
                <div>
                  <dt>Runway min</dt>
                  <dd>
                    {props.fitness.risque.runwayMinimumObserve === null
                      ? "—"
                      : String(props.fitness.risque.runwayMinimumObserve)}
                  </dd>
                </div>
                <div>
                  <dt>Cycles S/Co/Cr/D</dt>
                  <dd>
                    {String(props.fitness.resilience.nombreCyclesSain)}/
                    {String(props.fitness.resilience.nombreCyclesContraint)}/
                    {String(props.fitness.resilience.nombreCyclesCritique)}/
                    {String(props.fitness.resilience.nombreCyclesDormant)}
                  </dd>
                </div>
              </dl>
              <h3>Contribution</h3>
              <dl className="metriques-compactes">
                <LigneMontant libelle="Loyers" montant={props.fitness.contribution.loyersPayes.usdc} />
                <LigneMontant
                  libelle="Redevances"
                  montant={props.fitness.contribution.redevancesPayees.usdc}
                />
                <LigneMontant
                  libelle="Contribution totale"
                  montant={props.fitness.contribution.contributionProprietaireTotale.usdc}
                />
              </dl>
            </>
          )}
        </div>
      )}

      {props.onglet === "heritage" && (
        <div className="heritage-agent">
          <p className="rappel">
            GÉNOTYPE COMPORTEMENTAL — paramètres expérimentaux
          </p>
          <p className="banniere-fitness">
            Configuration héritable descriptive — aucune sélection active
          </p>
          {agent.heritageVariation === undefined ? (
            <p className="rappel">Aucune projection d&apos;héritage pour cet agent.</p>
          ) : (
            <>
              <dl className="metriques-compactes">
                <div>
                  <dt>Empreinte configuration</dt>
                  <dd className="mono">
                    {agent.heritageVariation.empreinteConfiguration}
                  </dd>
                </div>
                <div>
                  <dt>Parent</dt>
                  <dd className="mono">
                    {agent.heritageVariation.identifiantParent ?? "— (Genesis)"}
                  </dd>
                </div>
                <div>
                  <dt>Version configuration</dt>
                  <dd>
                    {agent.heritageVariation.configurationHeritable.version}
                  </dd>
                </div>
              </dl>

              <h3>Configuration héritable (paramètres)</h3>
              <dl className="metriques-compactes">
                {Object.entries(
                  agent.heritageVariation.configurationHeritable.parametres,
                ).length === 0 ? (
                  <div>
                    <dt>Paramètres</dt>
                    <dd>—</dd>
                  </div>
                ) : (
                  Object.entries(
                    agent.heritageVariation.configurationHeritable.parametres,
                  ).map(([cle, valeur]) => (
                    <div key={cle}>
                      <dt className="mono">{cle}</dt>
                      <dd className="mono">{String(valeur)}</dd>
                    </div>
                  ))
                )}
              </dl>

              <h3>Différences avec parent</h3>
              {agent.heritageVariation.differencesAvecParent === null ? (
                <p className="rappel">Agent Genesis — pas de parent.</p>
              ) : agent.heritageVariation.differencesAvecParent.length === 0 ? (
                <p className="rappel">Aucune différence de paramètre avec le parent.</p>
              ) : (
                <ul className="timeline">
                  {agent.heritageVariation.differencesAvecParent.map((diff) => (
                    <li key={diff.cle} className="ligne-evt">
                      <span className="type mono">{diff.cle}</span>
                      <span className="resume mono">
                        {diff.parent} → {diff.enfant}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3>Mutations à la naissance</h3>
              {agent.heritageVariation.mutationsALaNaissance.length === 0 ? (
                <p className="rappel">Aucune mutation enregistrée à la naissance.</p>
              ) : (
                <ul className="timeline">
                  {agent.heritageVariation.mutationsALaNaissance.map((mut, index) => (
                    <li
                      key={`${mut.identifiantReproduction}-${mut.cleGene}-${String(index)}`}
                      className="ligne-evt"
                    >
                      <span className="type mono">{mut.cleGene}</span>
                      <span className="resume mono">
                        {String(mut.valeurParent)} → {String(mut.valeurEnfant)}
                        {" · "}
                        {mut.operateur}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
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
        <div className="succes-reproductif-agent">
          <p className="rappel">
            Reproduction mécanique v0.1 — aucune sélection par fitness.
          </p>
          <h3>Succès reproductif / éligibilité</h3>
          <p className="banniere-fitness">
            Descriptif uniquement — pas un score de fitness
          </p>
          {agent.succesReproductif === undefined ? (
            <p className="rappel">
              Aucune projection de succès reproductif pour cet agent.
            </p>
          ) : (
            <dl className="metriques-compactes">
              <div>
                <dt>Éligible</dt>
                <dd>
                  {agent.succesReproductif.eligibleReproduction === null
                    ? "—"
                    : agent.succesReproductif.eligibleReproduction
                      ? "oui"
                      : "non"}
                </dd>
              </div>
              <div>
                <dt>Motif</dt>
                <dd>
                  {agent.succesReproductif.eligibleReproduction === true
                    ? "—"
                    : libelleMotifEligibilite(
                        agent.succesReproductif.motifNonEligibilite,
                      )}
                </dd>
              </div>
              <div>
                <dt>Coût nécessaire</dt>
                <dd>
                  {formaterMicroUsdcAffichage(
                    agent.succesReproductif.coutNecessaireMicroUsdc,
                  )}{" "}
                  USDC
                </dd>
              </div>
              <div>
                <dt>Réserve après reproduction</dt>
                <dd>
                  {agent.succesReproductif.reserveApresReproductionMicroUsdc ===
                  null
                    ? "—"
                    : `${formaterMicroUsdcAffichage(
                        agent.succesReproductif.reserveApresReproductionMicroUsdc,
                      )} USDC`}
                </dd>
              </div>
              <div>
                <dt>Enfants</dt>
                <dd>{String(agent.succesReproductif.nombreEnfants)}</dd>
              </div>
              <div>
                <dt>Descendants totaux</dt>
                <dd>{String(agent.succesReproductif.nombreDescendantsTotaux)}</dd>
              </div>
              <div>
                <dt>Dernier cycle reproduction</dt>
                <dd>
                  {agent.succesReproductif.dernierCycleReproduction === null
                    ? "—"
                    : String(agent.succesReproductif.dernierCycleReproduction)}
                </dd>
              </div>
              <div>
                <dt>Âge première reproduction</dt>
                <dd>
                  {agent.succesReproductif.agePremiereReproduction === null
                    ? "—"
                    : String(agent.succesReproductif.agePremiereReproduction)}
                </dd>
              </div>
              <div>
                <dt>Intervalle moyen</dt>
                <dd>
                  {agent.succesReproductif.intervalleMoyenReproductions === null
                    ? "—"
                    : String(
                        agent.succesReproductif.intervalleMoyenReproductions,
                      )}
                </dd>
              </div>
            </dl>
          )}

          <h3>Généalogie / compteurs</h3>
          <dl className="metriques-compactes">
            <div>
              <dt>Génération</dt>
              <dd>{String(agent.generation)}</dd>
            </div>
            <div>
              <dt>Parent</dt>
              <dd className="mono">{agent.identifiantParent ?? "— (Genesis)"}</dd>
            </div>
            <div>
              <dt>Lignée</dt>
              <dd className="mono">{agent.identifiantLignee ?? agent.identifiant}</dd>
            </div>
            <div>
              <dt>Cycle naissance</dt>
              <dd>{String(agent.cycleNaissance)}</dd>
            </div>
            <div>
              <dt>Enfants (liens)</dt>
              <dd>{String(agent.identifiantsEnfants.length)}</dd>
            </div>
            <div>
              <dt>Demandées / autorisées / refusées / terminées</dt>
              <dd>
                {String(agent.reproduction?.reproductionsDemandees ?? 0)} /{" "}
                {String(agent.reproduction?.reproductionsAutorisees ?? 0)} /{" "}
                {String(agent.reproduction?.reproductionsRefusees ?? 0)} /{" "}
                {String(agent.reproduction?.reproductionsTerminees ?? 0)}
              </dd>
            </div>
            <div>
              <dt>Dotations cumulées</dt>
              <dd>
                {agent.reproduction?.dotationsCumulees.usdc ?? "0"} USDC
              </dd>
            </div>
            <div>
              <dt>Coûts reproductifs</dt>
              <dd>
                {agent.reproduction?.coutsReproductifsCumules.usdc ?? "0"} USDC
              </dd>
            </div>
          </dl>
          {agent.identifiantsEnfants.length > 0 ? (
            <ul className="liste-enfants">
              {agent.identifiantsEnfants.map((id) => (
                <li key={id} className="mono">
                  {id}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rappel">Aucun enfant.</p>
          )}
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

function libelleMotifEligibilite(motif: string | null): string {
  if (motif === null || motif.length === 0) {
    return "—";
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

/** Affiche un micro-USDC (string entier) en USDC décimal. */
function formaterMicroUsdcAffichage(micro: string): string {
  try {
    const brut = BigInt(micro);
    const negatif = brut < 0n;
    const abs = negatif ? -brut : brut;
    const entier = abs / 1_000_000n;
    const reste = abs % 1_000_000n;
    const frac = reste.toString().padStart(6, "0").replace(/0+$/, "");
    const corps =
      frac.length === 0 ? entier.toString() : `${entier.toString()}.${frac}`;
    return negatif ? `-${corps}` : corps;
  } catch {
    return micro;
  }
}

function libelleStatutIdentite(
  statut: "disponible" | "cle_privee_indisponible" | "non_configuree",
): string {
  switch (statut) {
    case "disponible":
      return "disponible";
    case "cle_privee_indisponible":
      return "clé privée indisponible";
    case "non_configuree":
      return "non configurée";
  }
}
