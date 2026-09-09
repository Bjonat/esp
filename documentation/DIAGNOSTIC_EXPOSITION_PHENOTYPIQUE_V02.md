# Diagnostic d'exposition phénotypique ESP v0.2

## Objectif

Mesurer dans quelle mesure l'environnement v0.2 expose les agents aux
dimensions contrôlées par les quatre gènes héritables.

Ce diagnostic **ne** mesure **pas** l'avantage économique de D.
Il **ne** constitue **pas** l'évaluation v0.2.

## Niveaux d'expression (séparés)

```text
0 mutation génétique
1 occasion d'expression
2 expression cognitive        (choix diverge)
3 expression comportementale  (action diverge)
4 conséquence économique immédiate
```

```text
mutation génétique
≠ présence d'un agent mutant
≠ occasion d'expression
≠ expression cognitive
≠ expression comportementale
≠ conséquence économique
≠ avantage reproductif
```

## Contrefactuels (dry-run)

Pour chaque agent × cycle décisionnel, sans écrire d'événement :

1. **Réversion un-gène** — mutant vs gène rétabli à la valeur parent
2. **Sensibilité ±1 pas** — voisins catalogue immédiats

Contexte strictement figé : même agent, cycle, VEN, observation, environnement.

## Critères de couverture — FIGÉS AVANT EXÉCUTION

Le premier environnement v0.2 est considéré suffisamment exposant pour
passer à la calibration évolutive **seulement si** :

### Intégrité

```text
B/C = 100 % scientifiquement identiques
0 fournisseur réel
0 réseau
0 run techniquement échoué
événements décisionnels présents dans B/C/D
```

### Sensibilité environnementale

Pour **chacun** des quatre gènes :

```text
>= 3 seeds sur 5
```

contiennent au moins un agent-cycle localement sensible à ±1 pas
(ou changement catégoriel).

**ET** :

```text
>= 10 agent-cycles sensibles
```

sur l'ensemble des 5 seeds.

Ces seuils sont des critères de **couverture phénotypique**.
Ils ne dépendent d'aucune performance économique D−C.

Constantes code : `CRITERES_COUVERTURE_DIAGNOSTIC_V02`.

## Critères à NE PAS utiliser

```text
signe de VEN D-C
profit D-C
descendants D-C
génération D-C
succès économique des mutants
```

## Si un gène n'est pas exposé

Ne pas augmenter immédiatement son taux de mutation.

D'abord expliquer (seuil jamais traversé, plafond masqué, part VEN
jamais borne active, aucune situation sans inférence, …).

Puis seulement proposer une modification **minimale** de l'environnement
visant l'exposition causale, pas la performance économique.

## Protocole

```text
experiences/protocoles/evolution-diagnostic-expression-v02.json      — E1
experiences/protocoles/evolution-diagnostic-expression-v02-e2.json   — E2
```

### Candidat E2

Ajoute uniquement `enjeuxPossiblesMicroUsdc` à l'environnement décisionnel :

```text
50000, 75000, 125000, 175000, 250000
```

Sélection déterministe par `(graineSimulation, identifiantAgent, numeroCycle, "profil-enjeu-v02")`.
Indépendante de la condition A/B/C/D, du génotype et de la VEN.
Corrige l'exposition de `seuilEnjeuPourInferenceMicroUsdc` sans toucher aux
taux/pas de mutation ni à la reproduction.

- mode `calibration`
- seeds `201…205` (jamais évaluation)
- 20 cycles, population 3, A/B/C/D
- `decision_simulee`, fournisseur simulé

## Artefacts (hors empreinte scientifique)

```text
diagnostic-exposition/diagnostic-expression-phenotypique.csv
diagnostic-exposition/resume-diagnostic-expression.json
diagnostic-exposition/rapport-diagnostic-expression.md
```

Le registre événementiel reste la source de vérité.

## Sémantique par gène

| Gène | Exposition typique |
|------|--------------------|
| `seuilEnjeuPourInferenceMicroUsdc` | enjeu entre les deux seuils → `utiliserInference` diverge |
| `partMaxVenParCycleBps` | part VEN parfois borne active (sinon masquée) |
| `plafondCognitifMicroUsdc` | plafond parfois borne active |
| `comportementSansInference` | `utiliserInference=false` + comparer attendre / agir_si_favorable |

## Voir aussi

- `documentation/COUPLAGE_GENOTYPE_PHENOTYPE_V02.md`
- `documentation/POSTMORTEM_EVOLUTION_V01.md`
