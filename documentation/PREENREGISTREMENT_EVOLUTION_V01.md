# Pré-enregistrement — évaluation évolution ESP v0.1

Document figé **avant** toute exécution des `seedsEvaluation`.  
État du freeze : **`gele_non_execute`**.

Artefacts :

- Protocole : `experiences/protocoles/evolution-evaluation-v01.json`
- Freeze : `experiences/protocoles/freeze-evolution-evaluation-v01.json`
- Calibration source : `experiences/protocoles/evolution-calibree-v01.json`
- Rapport calibration : `documentation/CALIBRATION_EVOLUTION_V01.md`

Aucune seed d'évaluation ne doit être lancée tant que ce pré-enregistrement reste gelé non exécuté.

## Paramètres expérimentaux figés

| Paramètre | Valeur |
|-----------|--------|
| cyclesMaximum | 20 |
| populationMaximale | 24 |
| nombreMaxNaissancesParCycle | 4 |
| dotationEnfantMicroUsdc | 800 000 |
| coutReproductionMicroUsdc | 200 000 |
| reserveMinimaleParentMicroUsdc | 400 000 |
| tauxMutationParGeneBps / tauxMutationConditionDBps | 1000 |
| populationInitiale | 3 |
| capitalInitialParAgentMicroUsdc | 8 000 000 |
| fournisseur | `fournisseur-inference-simule` (aucun OpenAI) |

## Hypothèses pré-enregistrées

### H1

La reproduction sous contrainte économique produit une descendance différentielle.

Comparaison principale : **B versus A** (descriptive).

### H2

La mutation héritable modifie les trajectoires économiques/reproductives.

Comparaison principale : **D versus C**.

### H3

Certaines variantes comportementales peuvent augmenter en fréquence au fil des générations sans sélection fitness explicite.

Observation : trajectoires de fréquences génétiques.

H3 est une **association évolutive**. Ne pas conclure automatiquement : « ce gène cause une meilleure performance ».

## Comparaisons pré-enregistrées

| Rôle | Paire |
|------|-------|
| **Primaire** | **D−C** |
| Secondaire | B−A |
| Secondaire | C−B |
| Secondaire | D−B |

Appariement strict par seed (même seed sur les quatre conditions A/B/C/D).

## Seeds d'évaluation (liste exacte)

```
1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010,
1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020
```

20 seeds × 4 conditions = **80 runs** prévus.  
Seeds de calibration (101–105) : **ne pas** les utiliser pour conclure l'évaluation.

## Métriques pré-enregistrées

### Économiques

- VEN population finale
- résultat activité brut cumulé
- résultat après contrat cumulé
- résultat après reproduction cumulé
- compute cumulé
- contribution propriétaire cumulée

### Survie

- population vivante finale
- extinction (`eteinte`)
- `cycleExtinction`

### Reproduction

- naissances cumulées
- génération maximale
- lignées vivantes
- descendants

### Variation

- mutations cumulées
- configurations distinctes finales
- fréquences génotypiques finales

### Cognition / décision

- regret ex ante cumulé
- taux décisions optimales ex ante (BPS)
- demandes d'inférence
- coût cognition

### Interdits

Aucun agrégat du type :

- `scoreEvolution`
- `fitnessGlobale`
- `indiceAdaptationGlobal`
- ranking / classement fitness

L'analyse reste **multidimensionnelle**.

## Traitement des extinctions

- Un run éteint **reste dans l'échantillon**.
- Ne jamais exclure une extinction.
- Stocker `eteinte: true` et `cycleExtinction`.
- Trajectoire paddée jusqu'à `cyclesMaximum` (`populationVivante = 0`, cumulatifs figés).
- Ne pas transformer une extinction en donnée manquante.
- Ne jamais calculer une moyenne « survivants seulement » sans l'étiqueter explicitement.

## Traitement des garde-fous

Mesurés, **jamais exclus** :

- `cyclesPopulationMaximaleAtteinte`
- `cyclesPlafondNaissancesAtteint`
- `runContraintParGardeFou`

Un run contraint par garde-fou reste dans l'échantillon et est signalé.

## Échecs techniques (définis avant exécution)

Sont des **échecs techniques** (instrument) :

- crash processus
- registre corrompu
- empreinte protocole mismatch
- artefact run incomplet non rejouable
- fournisseur interdit (ex. OpenAI réel)
- erreur I/O persistante

**Ne sont pas** des échecs techniques :

- VEN faible / « mauvaise performance »
- regret élevé
- extinction
- garde-fou atteint
- mutation absente
- descendance nulle
- échec du contrôle négatif B/C (invalidation instrumentale de campagne, distincte d'un retry de performance)

## Règle de retry

Retry autorisé **uniquement** si :

1. **même seed** ;
2. **même empreinte protocole** que le freeze ;
3. motif ∈ échecs techniques.

Interdit : relancer une seed parce que D « perd » contre C, ou pour améliorer un résultat économique.

Reprise d'un run **incomplet** : supprimer le partiel et recommencer la **même** seed sous le **même** protocole (comportement runner existant) — ce n'est pas un resampling.

## Contrôle B/C bloquant

Pour chaque seed d'évaluation :

`empreinteResultatScientifique(B) === empreinteResultatScientifique(C)`.

Si une seule seed échoue le contrôle négatif :

→ **campagne d'évaluation INVALIDÉE** (instrument / configuration).  
Ne pas interpréter les hypothèses H1/H2/H3 sur cette campagne.

## Interdiction d'arrêt anticipé selon les résultats

Interdit d'arrêter la campagne parce que :

- D semble gagner ou perdre ;
- une extinction apparaît ;
- un gène se fixe ;
- H1/H2/H3 semblent confirmées ou infirmées.

Exécuter l'intégralité des 80 runs prévus (hors retries techniques légitimes).

## Interdiction de modifier le protocole après vision des résultats

Après gel :

- `empreinteProtocole` du freeze doit rester égale à celle du protocole evaluation ;
- toute modification de paramètres / seeds / horizon / conditions **refuse** la continuité scientifique de ce freeze ;
- un nouveau protocole exige un **nouveau** freeze et un nouveau pré-enregistrement.

Pas de SHA Git stocké dans le protocole ou le freeze (évite l'auto-référence circulaire). Le SHA code pourra être enregistré dans le **manifeste de batch** au lancement réel uniquement.

## Notion d'adaptation (prudence)

Un changement de fréquence ≠ preuve causale.  
Signal prudent minimal : fréquence + descendance différentielle + avantage économique associé + réplication multi-seeds — puis parler de **signal expérimental**, pas de causalité universelle.

## Audit pré-lancement

Avant toute exécution evaluation :

```
nombreSeedsEvaluationExecutees = 0
```

Vérifier l'absence de répertoires `*-seed-1001` … `*-seed-1020` dans `experiences/resultats/`.
