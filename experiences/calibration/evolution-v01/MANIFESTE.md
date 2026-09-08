# Calibration évolutive ESP v0.1 — manifeste

Mode : calibration uniquement (`seedsCalibration` = 101…105).
Aucune seed d'évaluation exécutée.
Aucune sélection sur métriques D−C / VEN / regret / gène dominant.

## Critères figés avant analyse

Voir `documentation/CALIBRATION_EVOLUTION_V01.md`.

## Essais

| Id | Étape | Décision |
|----|-------|----------|
| cal-e1-01 | 1 | candidat_suivant |
| cal-e2-01 | 2 | rejete |
| cal-e2-02 | 2 | candidat_suivant |
| cal-e3-01 | 3 | **retenu** |

Détail JSONL : `journal-calibration.jsonl`  
Vue retenue : `resume-calibration.json`  
Protocole : `experiences/protocoles/evolution-calibree-v01.json`
