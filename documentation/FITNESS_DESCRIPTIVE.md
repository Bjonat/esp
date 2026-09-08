# Fitness descriptive ESP v0.1

## Pourquoi pas de score unique

ESP étudie l'évolution économique sous contraintes. Un scalaire
`fitness = 0.73` écraserait des phénomènes distincts :

- performance opérationnelle vs après contrat (loyer/redevance) ;
- qualité de décision **ex ante** vs tirage **réalisé** ;
- coût cognitif vs résultat ;
- survie / drawdown / contribution propriétaire.

Cette phase **mesure** uniquement. Elle ne sélectionne pas, ne classe pas,
ne déclenche ni reproduction, ni mutation, ni héritage.

Bannière méthodologique :

> FITNESS DESCRIPTIVE — aucune sélection active

`versionMesuresFitness = "fitness-descriptive-v01"`

## Structure `MesuresFitnessAgent`

Bundle multidimensionnel (pas de champ `score` / `rang`) :

| Bloc | Contenu |
|------|---------|
| `economie` | VEN, flux, résultats opérationnel / après contrat, exogènes |
| `decision` | optimalité ex ante, regret, réalisé, avec/sans inférence |
| `cognition` | appels, coûts, ratio descriptif non causal |
| `risque` | pic VEN, drawdown max, runway min |
| `survie` | naissance, cycles vécus, mort |
| `resilience` | temps par état, transitions |
| `contribution` | loyers + redevances (pas « fitness propriétaire ») |
| `historiqueParCycle` | VEN, drawdown, cumuls |

## Formules économiques

```
resultatActiviteBrut = revenus − pertes
resultatOperationnelAvantContrat =
  brut − compute − données − fraisExecution
resultatApresContrat =
  opérationnel − loyersPayes − redevancesPayees
```

Les loyers/redevances du contrat économique **ne sont pas** neutralisés :
ils restent dans la performance après contrat.

## Flux exogènes

Séparé explicitement :

- capitalisation Genesis / injections ;
- transferts internes reçus / envoyés.

```
variationVenNeutraliseeExogenes =
  variationVen − capitalisation − reçus + envoyés
```

Une injection de capital n'est **pas** de la création de valeur.

## EV et regret ex ante

Rationnel entier exact (aucun float, aucune division avant comparaison) :

```
numerateurAgir =
  p×gain − (10000−p)×perte − 10000×frais
denominateur = 10000

EV_agir = numerateurAgir / 10000   (exact)
EV_attendre = 0 / 10000
```

Meilleure action : comparaison sur le **numérateur** :
- `numerateurAgir > 0` → `agir`
- `numerateurAgir < 0` → `attendre`
- `numerateurAgir === 0` → `attendre` (convention)

```
numerateurRegret = numerateurEV(meilleure) − numerateurEV(choisie) ≥ 0
```

Agrégation : somme des numérateurs (dénominateur commun 10_000).
Arrondi µUSDC éventuel **uniquement** en projection d'affichage
(`microUsdcArrondiAffichage`).

Bonne décision + mauvais tirage → regret 0.
Mauvaise décision + bon tirage → regret > 0.

## Cognition

Compteurs Xway + coût cognitif. Ratio :

`ratioResultatOperationnelSurCoutCognitif`

- `null` si coût = 0 ;
- rationnel entier + `quotientEchelleMillion` ;
- annoté **descriptif_non_causal** — ne prouve pas qu'1 USDC de compute « cause » X USDC.

Stats **avec / sans inférence** séparées (biais de sélection possible).

## Drawdown

Sur VEN reconstruite historiquement : pic, drawdown max, BPS vs pic, cycle.

## Survie / résilience

Naissance, cycles vécus, état, mort. Compteurs par état, transitions,
passages critique→sain. « Vivant ≠ performant ».

## Contribution propriétaire

`loyers + redevances` par agent — financement infrastructure / surplus.

## Fenêtres

`FenetreEvaluation { cycleDebut, cycleFin }` — naissance→courant par défaut,
ou intervalle explicite. API : `?cycleDebut=&cycleFin=`.

## Agrégats population

Par dimension : min, médiane, max, Q1, Q3.
Médiane paire : moyenne tronquée vers zéro des deux centrales `((a+b)/2)`.

Tri dashboard **par colonne** uniquement — jamais « #1 meilleur agent ».

## Complexité

Une passe O(n) sur les événements de l'agent (+ reconstruction bornée
début/fin de fenêtre). Pas de O(cycles²) pour l'historique.

## API

- `GET /api/fitness`
- `GET /api/agents/:id/fitness`

DTO sans secret. EV / regret exposés en rationnel canonique :

```json
{
  "numerateurMicroUsdcBps": "5000",
  "denominateurBps": 10000,
  "microUsdcArrondiAffichage": { "microUsdc": "0", "usdc": "0.000000" }
}
```

`microUsdcArrondiAffichage` est une troncature vers zéro pour le dashboard ;
la donnée canonique reste le rationnel.

## Futur (hors périmètre v0.1)

Avant reproduction / sélection, il faudra décider :

- quelles dimensions entrent dans une politique de sélection ;
- pondérations éventuelles (versionnées) ;
- fenêtres / cohortes ;
- traitement des agents morts ;
- interaction avec héritage / mutation.

Cette phase ne tranche **aucune** de ces questions.
