# Calibration évolution multi-génération ESP v0.2

## Statut

Calibration **terminée** — candidat `e1-01` **SATISFAISANT** → STOP.

Critères figés avant exécution. Environnement d'exposition retenu :
`environnement-exposition-v02-e2`
(voir `documentation/ENVIRONNEMENT_EXPOSITION_V02_E2.md`).

Batch : `evolution-calibration-v02-e1-01-ee0c4ae31543-calibration-2020-01-01T00:00:00.000Z`

## Objectif

Trouver une zone opératoire où :

```text
variation → expression → économie → reproduction → plusieurs générations
```

est observable sans saturation expérimentale excessive.

La calibration **ne** détermine **pas** si les mutations sont bénéfiques.
Elle **n'optimise pas** D vs C.
Elle **ne** sélectionne **pas** selon le résultat économique D−C.

## Seeds

```text
seedsCalibrationV02 = 301, 302, 303, 304, 305
```

Jamais `1001..1020` (histoire v0.1). Aucune seed d'évaluation v0.2.

## Matrice

A / B / C / D inchangée. B/C = contrôle négatif bloquant.

## Critères (A–G) — FIGÉS AVANT EXÉCUTION

### A — intégrité

```text
0 run techniquement échoué
0 fournisseur réel / réseau / Solana
B/C = 100 % scientifiquement identiques
mode = decision_simulee
événements décisionnels présents (B/C/D)
```

Échec B/C → candidat invalidé immédiatement.

### B — couverture phénotypique

Pour chacun des quatre gènes (indépendant des mutations) :

```text
>= 3 seeds / 5 avec sensibilité locale
ET
>= 10 agent-cycles sensibles
```

(Constantes : `CRITERES_COUVERTURE_DIAGNOSTIC_V02`.)

### C — portée multi-génération

Sur B∪C∪D :

```text
médiane(générationMaximale) >= 3
```

Et pour chacune de B, C, D :

```text
au moins une naissance dans 5/5 runs
```

### D — descendance différentielle possible

Pour chacune de B, C, D :

```text
>= 3 seeds / 5
```

avec `max(membresCumules) - min(membresCumules) > 0` sur les lignées
du dernier point de trajectoire.

Mesure l'espace de sélection — **pas** le fitness.

### E — mutations réellement présentes (D)

```text
>= 3 runs D / 5 avec mutationsCumulees > 0
```

(mutation effective : valeur enfant ≠ parent.)

### F — mutations phénotypiquement exprimées (D)

```text
>= 3 runs D / 5
```

avec au moins une expression cognitive (niveau ≥ 2) attribuable au génotype
(`utiliserInference` / `modeleLogique` / `limiteDepenseAutoriseeMicroUsdc` / `motif`).

### G — traversée comportement / économie (D)

```text
>= 2 runs D / 5
```

avec expression comportementale **ou** conséquence économique immédiate.
La **direction** économique est ignorée.

## Garde-fous

Sur cycles B∪C∪D :

```text
mean(cyclesPopulationMax / cyclesMaximum) < 10 %
mean(cyclesPlafondNaissances / cyclesMaximum) < 10 %
fraction runs contraints < 20 %
```

## Extinction

Ne jamais exclure une extinction. Rejeter si **100 %** des runs B∪C∪D
s'éteignent avec `générationMaximale < 2`.

## Interdit pour sélectionner

```text
VEN D-C, profit D-C, naissances D-C, descendants D-C, survie D-C, …
```

## Premier candidat

```text
evolution-calibration-v02-e1-01
```

Paramètres : hérités du dernier opératoire (E2) sans modification.
Règle : premier candidat satisfaisant → **STOP**.

## Ordre d'ajustement si échec

1. Portée générationnelle (`cyclesMaximum`, `populationMaximale`, `nombreMaxNaissancesParCycle`)
2. Pression reproductive (dotation / coût / réserve)
3. Variation exprimée (`tauxMutationParGeneBps`) — pas les pas de gènes ; pas E2 pour D−C

## Journal des candidats

<!-- Rempli après chaque exécution. Aucun candidat rejeté ne disparaît. -->

### E1-01

Paramètres modifiés : aucun (premier candidat — héritage E2).

| Critère | Résultat |
|---------|----------|
| A intégrité | OK — 20/20, B/C identiques |
| B couverture | OK — 4/4 gènes |
| C générations | OK — médiane gen=3 ; naissances 5/5 B/C/D |
| D descendance différentielle | OK — 5/5/5 seeds |
| E mutations | OK — 5/5 runs D |
| F expression cognitive | OK — 5/5 runs D |
| G comportement/économie | OK — 5/5 runs D |
| Garde-fous | OK — 0 % contraintes |
| Extinction précoce totale | non |

Décision : **SATISFAISANT → STOP CALIBRATION**

Aucune métrique D−C n'a été utilisée.
