# Couplage causal génotype → phénotype ESP v0.2

## Défaut v0.1

L'évaluation évolution v0.1 a été techniquement valide mais
**H2 / adaptation non interprétables** : la campagne forçait

```text
mode = "simulation"
```

Conséquences observées (80 runs) :

- mutations génétiques bien produites (132 en D) ;
- configurations héritables bien différentes ;
- **0** événement décision agent ;
- Xway piloté par `politique-cognitive-developpement` (hash de seed),
  indépendante des gènes héritables.

Chaîne rompue :

```text
mutation
→ génotype différent                  OUI
→ politique décisionnelle exprimée    NON
→ décision différente                 NON TESTABLE
→ trajectoire économique différente   NON TESTABLE
```

Voir `documentation/POSTMORTEM_EVOLUTION_V01.md`.  
La v0.1 et le tag `esp-evolution-evaluation-v01-freeze` restent historiquement
intacts.

## Voie causale corrigée (v0.2)

Le protocole `protocole-experience-evolution-v02` exige :

| Élément | Rôle |
|---------|------|
| `environnementDecision` | obligatoire (fail closed) |
| `politiqueBudgetCognitif` | génotype genesis |
| `mode: decision_simulee` | forcé à la fabrication du run |
| `fournisseur-inference-simule` | seul fournisseur autorisé |

Chaîne active par agent :

```text
configurationHeritableAgent
  → resoudrePolitiqueDepuisConfigurationHeritable(...)
  → politique effective
  → executerCycleDecisionAgent(...)
  → executerMoteurDecision(...)
  → CHOIX_COGNITIF_EFFECTUE / DECISION_AGENT_VALIDEE / ACTION_ENVIRONNEMENT_EXECUTEE
```

La politique cognitive de développement historique peut subsister pour les
anciens modes `simulation`, mais **ne pilote pas** une campagne évolution v0.2.

## Mutation génétique vs expression phénotypique

```text
mutation génétique effective
≠
mutation phénotypiquement exprimée
```

- Une mutation est **génétiquement effective** si l'empreinte /
  `configurationHeritable` de l'enfant diffère de celle du parent.
- Une mutation est **phénotypiquement exprimée** uniquement si la politique
  effective ou un choix / une action qu'elle gouverne **diffère** dans un
  contexte où cette différence peut être attribuée au génotype.

Changer un fingerprint sans divergence de choix/action n'est **pas** une
preuve d'expression phénotypique.

## Contrôles positifs obligatoires

Module : `controle-sensibilite-phenotypique-v02` (+ contrôle campagne).

| Contrôle | Gène | Preuve attendue |
|----------|------|-----------------|
| A | `comportementSansInference` | `agir` vs `attendre` sur décision/action |
| B | `seuilEnjeuPourInferenceMicroUsdc` | `CHOIX_COGNITIF_EFFECTUE.utiliserInference` diverge |
| C | `plafondCognitifMicroUsdc` | `limiteDepenseAutoriseeMicroUsdc` diverge |
| D | `partMaxVenParCycleBps` | `limiteDepenseAutoriseeMicroUsdc` diverge (VEN basse) |

Contrôle campagne : même seed / environnement / économie ; seule la config
héritable diffère (mutation `comportementSansInference` à 10000 bps) →
actions divergentes du descendant.

Ces contrôles **ne** cherchent **pas** `VEN_D > VEN_C`.

## Conditions d'expression des quatre gènes

Pour qu'un gène soit parfois causalement actif en campagne :

| Gène | Condition d'expression |
|------|------------------------|
| `seuilEnjeuPourInferenceMicroUsdc` | enjeu près du seuil (de part et d'autre) |
| `partMaxVenParCycleBps` | part de VEN parfois **borne active** (VEN assez basse vs plafond) |
| `plafondCognitifMicroUsdc` | plafond parfois **borne active** (part × VEN > plafond) |
| `comportementSansInference` | situations sans inférence doivent exister |

Attention : avec VEN = 8 000 000 et plafond = 10 000, `partMaxVenParCycleBps`
peut être **masqué** par le plafond. Les fixtures de contrôle choisissent
volontairement une VEN où le gène est observable.

Cette information servira à la **calibration v0.2** (hors scope de cette PR).

## Matrice A/B/C/D

Inchangée :

| Condition | reproductionAutonome | mutation | taux |
|-----------|----------------------|----------|------|
| A | OFF | OFF | — |
| B | ON | OFF | — |
| C | ON | active | 0 (sham) |
| D | ON | active | > 0 |

Contrôle négatif : pour une même seed,
`empreinteResultatScientifique(B) === empreinteResultatScientifique(C)`.

## Préflight bloquant

Avant démarrage d'une campagne v0.2 :

- version = `protocole-experience-evolution-v02`
- mode run fabriqué = `decision_simulee`
- `environnementDecision` + `politiqueBudgetCognitif` présents
- fournisseur simulé uniquement

## Instrumentation

Événements existants (pas de duplication) :

```text
OBSERVATION_AGENT_RECUE
CHOIX_COGNITIF_EFFECTUE
PROPOSITION_DECISION_PRODUITE
DECISION_AGENT_VALIDEE / REFUSEE
ACTION_ENVIRONNEMENT_EXECUTEE
RESULTAT_ACTION_OBSERVE
```

Vue d'audit : `extraireTracePhenotypiqueCycle` relie agent / empreinte /
cycle / choix / décision / action / résultat. Aucun chain-of-thought.

## Non-objectifs de cette PR

- calibrer v0.2 / seeds d'évaluation finales
- exécuter une évaluation
- modifier résultats ou protocole v0.1
- rendre D « meilleur » que C
- OpenAI réel / Solana / sélection explicite / anti-fixation
