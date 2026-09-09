# Environnement d'exposition phénotypique v0.2 — E2

## Identifiant

```text
environnement-exposition-v02-e2
```

## Statut

**Arrêté pour la calibration v0.2.**

Premier candidat satisfaisant les critères de couverture phénotypique
pré-définis (diagnostic E2, seeds 201–205).

Ce n'est **pas** encore un protocole d'évaluation gelé.
La structure d'exposition ne doit plus être ajustée selon D−C.

## Distribution d'enjeux (micro-USDC)

```text
50000
75000
125000
175000
250000
```

## Sélection déterministe

```text
graineSimulation ⊕ identifiantAgent ⊕ numeroCycle ⊕ "profil-enjeu-v02"
```

Indépendante de : condition A/B/C/D, génotype, fitness, VEN, historique économique.

Redimensionnement proportionnel entier des montants de base pour que :

```text
max(gainSiSucces, perteSiEchec) = enjeuCible
```

## Interdictions

Ne pas modifier cette distribution pour :

- augmenter le profit ;
- favoriser certains mutants ;
- augmenter D−C ;
- produire davantage de naissances.

Si la couverture échoue sur `seedsCalibrationV02` (301–305), documenter
avant toute proposition E3.

## Références

- Protocole diagnostic : `experiences/protocoles/evolution-diagnostic-expression-v02-e2.json`
- Implémentation : `selectionnerProfilEnjeuV02` / `redimensionnerMontantsPourEnjeu`
- Calibration : `documentation/CALIBRATION_EVOLUTION_V02.md`
