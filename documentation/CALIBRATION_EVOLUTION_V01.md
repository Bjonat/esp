# Calibration évolutive ESP v0.1

Document de calibration — zone dynamique informative.
**Aucune conclusion scientifique H1/H2/H3.** Simulation uniquement (pas d'OpenAI).

## Pilote initial

Protocole : `experiences/protocoles/evolution-pilote-v01.json`

| Paramètre | Valeur pilote |
|-----------|---------------|
| cyclesMaximum | 8 |
| populationMaximale | 12 |
| nombreMaxNaissancesParCycle | 2 |
| dotationEnfantMicroUsdc | 2 500 000 |
| coutReproductionMicroUsdc | 800 000 |
| reserveMinimaleParentMicroUsdc | 1 500 000 |
| tauxMutationConditionDBps | 2500 |
| seedsCalibration | 101…105 |
| seedsEvaluation | 1001…1020 (non exécutées) |

Résultat pilote : 20 runs ; B/C 5/5 OK ; **15/20** runs contraints par garde-fou ; horizon trop court pour multi-génération.

## Critères figés avant calibration

| Id | Critère | Seuil |
|----|---------|-------|
| A | fractionRunsContraintsParGardeFou | < 20 % |
| B | fractionCyclesPopulationMaxAtteinte | < 10 % |
| C | fractionCyclesPlafondNaissancesAtteint | < 10 % |
| D | contrôle négatif B/C | 100 % |
| E | génération max. médiane B/C/D | ≥ 3 |
| F | runs D avec ≥1 mutation | > 50 % |
| G | extinction quasi immédiate | à éviter |
| H | immortalité structurelle totale | à éviter |
| I | saturation population précoce | à éviter |

## Informations interdites pour choisir la calibration

Pendant la sélection des paramètres, **ne pas utiliser** :

- signe de l'effet D−C ;
- taille de l'effet D−C (VEN, regret, etc.) ;
- gène dominant ou fréquence d'un allèle précis comme critère de choix ;
- fitness économique relative D/C ;
- trajectoire « préférée » ou « meilleure » configuration économique ;
- contribution propriétaire D−C ;
- descendance comparative D−C.

Le runner peut calculer ces champs automatiquement ; la vue `resume-calibration.json` et ce rapport **ne les utilisent pas** pour décider.
Une calibration n'est **pas** une optimisation du résultat que l'évaluation doit mesurer.

## Candidats testés

### Étape 1 — horizon et garde-fous

Critères décisifs : A, B, C, D, G, I.

| Id | Paramètres | B/C | Garde-fous runs | Décision |
|----|------------|-----|-----------------|----------|
| cal-e1-01 | cycles=20, popMax=24, naiss/cycle=4 | OK 100 % | 0 % | **candidat_suivant** (premier satisfaisant) |

Aucun autre candidat étape 1 (arrêt au premier satisfaisant).

### Étape 2 — économie reproductive

Caps figés : 20 / 24 / 4.

| Id | Dotation / coût / réserve | B/C | Gén. médiane BCD | Décision |
|----|---------------------------|-----|------------------|----------|
| cal-e2-01 | 1.5M / 0.4M / 0.8M | OK | 2 | **rejete** (E) |
| cal-e2-02 | 0.8M / 0.2M / 0.4M | OK | 3 | **candidat_suivant** |

### Étape 3 — mutation observable

Économie + caps figés. Variation : `tauxMutationConditionDBps`.

| Id | Taux bps | B/C | Fraction D mutée | Décision |
|----|----------|-----|------------------|----------|
| cal-e3-01 | 1000 | OK | 100 % | **retenu** |

Aucun essai 2500 / 5000 (arrêt au premier satisfaisant).

## Paramètres finalement retenus

Protocole : `experiences/protocoles/evolution-calibree-v01.json` (mode `calibration`).

| Paramètre | Valeur |
|-----------|--------|
| cyclesMaximum | 20 |
| populationMaximale | 24 |
| nombreMaxNaissancesParCycle | 4 |
| dotationEnfantMicroUsdc | 800 000 |
| coutReproductionMicroUsdc | 200 000 |
| reserveMinimaleParentMicroUsdc | 400 000 |
| tauxMutationConditionDBps | 1000 |

Empreinte candidat cal-e3-01 (dérivé pilote, même surcharge) : `sha256:b72737610a43701b6a569362423312f7d4aedc1e6ae2618cbf5816e5089ee6ac`  
Empreinte fichier `evolution-calibree-v01.json` : `sha256:bc24e4dc147349fa9b77d26b4c9e399f03eeec4e3a7495fe477f97a0208bcfdd` (différente via `identifiantProtocole` / version param. éco. — paramètres dynamiques identiques).

### Raisons du choix (autorisées)

- Garde-fous non dominants (A/B/C/I à 0 %).
- Contrôle négatif B/C = 100 % sur tous les candidats exécutés.
- Génération médiane B/C/D = 3 (E).
- Mutations effectives présentes sur 100 % des runs D (F), sans jugement de bénéfice.
- Naissances présentes ; pas d'extinction immédiate universelle (G).
- Premier candidat satisfaisant à chaque étape (pas d'optimisation).

### Métriques explicitement NON utilisées pour choisir

- différence / signe / taille D−C (VEN, regret, activité) ;
- contribution propriétaire D−C ;
- fréquences génotypiques comme critère de sélection ;
- « D gagne » / « mutation rentable » / « meilleure performance ».

## Synthèse instrumentale finale (cal-e3-01)

| Métrique autorisée | Valeur |
|--------------------|--------|
| Contrôle B/C | OK |
| fractionRunsContraintsParGardeFou | 0 |
| fractionCyclesPopulationMax / plafond naissances | 0 / 0 |
| génération maximale médiane BCD | 3 |
| fraction runs éteints (BCD) | 0 |
| fraction D avec mutation | 1.0 |
| naissances présentes | oui |

Note G/H : extinction absente sur cet horizon calibré, mais générations ≥ 3 + garde-fous non saturés → H soft satisfait (pas d'immortalité artificielle par caps). Extinction reste économiquement possible (coûts opérationnels / runway).

**Extinction atteignable, non observée sur les seeds de calibration.**  
Vérification déterministe (test H) avec les seuils économiques calibrés (`coutOperationnelMinimal` 20 000, runway sain 20 / contraint 5, dormance avant mort 3) : en réduisant le capital, un agent traverse bien `sain → contraint → critique → dormant → mort`. Une population à 0 vivant est bien marquée `eteinte = true` avec `cycleExtinction` défini (test I). Aucune nouvelle mécanique de mort.

## Coût d'exécution

| Essai | Runs | Durée |
|-------|------|-------|
| cal-e1-01 | 20 | ~215 s |
| cal-e2-01 | 20 | ~433 s |
| cal-e2-02 | 20 | ~521 s |
| cal-e3-01 | 20 | ~493 s |
| **Total** | **80** | **~1661 s (~27,7 min)** |

Coût OpenAI : 0 (fournisseur simulé).

## Freeze d'évaluation

Fichier préparé (non exécuté) : `experiences/protocoles/evolution-evaluation-v01.json`  
Seeds d'évaluation **non lancées**. SHA Git au freeze : `333d800761e0e9bc4e21cae4351bcdbbb18fc4ce`.

## Artefacts

- Journal : `experiences/calibration/evolution-v01/journal-calibration.jsonl`
- Manifeste : `experiences/calibration/evolution-v01/MANIFESTE.md`
- Vue : `experiences/calibration/evolution-v01/resume-calibration.json`
- Outillage : `pnpm calibration:evolution`

## Preuve anti p-hacking (choix du candidat)

Le journal `experiences/calibration/evolution-v01/journal-calibration.jsonl` ne contient, pour chaque décision, que :

- paramètres changés (whitelist étape) ;
- hypothèse opérationnelle (garde-fous / générations / mutations présentes) ;
- `resultatCriteres` (A–I instrumentaux) ;
- décision `rejete | candidat_suivant | retenu`.

Aucune entrée de décision ne cite signe D−C, magnitude D−C, VEN comparative, regret, contribution propriétaire, ni génotype gagnant.  
La vue `resume-calibration.json` est whitelistée (assert `assertVueCalibrationSansDC`).
