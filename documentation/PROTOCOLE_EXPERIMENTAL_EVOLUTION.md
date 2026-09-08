# Protocole expérimental évolution multi-génération ESP v0.1

## Question de recherche

Une population d'agents soumise à une contrainte économique, avec
reproduction, héritage et mutation, produit-elle au fil des générations une
adaptation économique reproductible ?

Ce document décrit l'**instrument** expérimental. Il n'ajoute aucune capacité
comportementale aux agents.

Package : `@esp/campagne-evolution`  
CLI : `pnpm experience:evolution -- --protocole <fichier.json>`

## Matrice A / B / C / D

| Condition | reproductionAutonome | mutation | taux |
|-----------|----------------------|----------|------|
| A — contrôle économique | false | inactive | — |
| B — reproduction seule | true | inactive | — |
| C — sham mutation | true | active | 0 |
| D — évolution complète | true | active | expérimental |

Comparaison primaire : **D versus C**.  
Secondaires : B−A, C−B, D−B.

### Contrôle négatif B / C

À seed égale, B (`mutation` inactive) et C (`mutation` active, taux=0)
doivent produire la même trajectoire économique / reproductive.

Implémentation v0.1 :

- `tauxMutationParGeneBps === 0` est un no-op strict (copie pure, sans
  matérialisation de défauts catalogue) ;
- `identifiantExperience` de run omet la condition pour que le simulateur
  de développement (hash sur l'id agent) reste apparié entre conditions.

## Seeds appariées

Une seed sert les quatre conditions (`A-seed-1001` … `D-seed-1001`).
Ne pas allouer des plages de seeds disjointes par condition.

## Calibration ≠ évaluation

- **Calibration** : régler paramètres ; résultats non conclusifs.
- **Évaluation** : protocole figé (paramètres, conditions, seeds, horizon).

Listes explicites : `seedsCalibration` / `seedsEvaluation`.

## Reproductibilité

Empreintes scientifiques en **SHA-256** (`sha256:<hex>`), sérialisation JSON
canonique (clés triées) :

| Empreinte | Couvre | B vs C sham |
|-----------|--------|-------------|
| `empreinteProtocole` | protocole figé | identique |
| `empreinteExecutionRun` | condition + seed + événements (hors Ed25519) | **peut différer** (`mutation.active`) |
| `empreinteResultatScientifique` | trajectoire / résumé observables | **doit être identique** |

FNV-1a reste réservé aux tirages non sécuritaires du protocole (mutation,
priorités reproductives), pas aux identifiants d'intégrité de campagne.

- `datesEvenementsFixes = 2020-01-01T00:00:00.000Z`.
- Concurrence 1 ou N → mêmes empreintes scientifiques (runs isolés).
- Timestamps muraux / chemins fichiers / clés Ed25519 exclus du résultat scientifique.

### Contrôle négatif B / C

Vérification primaire : `empreinteResultatScientifique(B) === empreinteResultatScientifique(C)`.
Diagnostic secondaire : comparaison structurée résumé / trajectoire.

Un run éteint reste dans l'échantillon (`eteinte`, `cycleExtinction`).
La trajectoire est paddée jusqu'à `cyclesMaximum` (cumulatifs figés,
`populationVivante = 0`) pour éviter le biais des survivants.

## Garde-fous

Mesurés, jamais exclus silencieusement :

- `cyclesPopulationMaximaleAtteinte`
- `cyclesPlafondNaissancesAtteint`
- `runContraintParGardeFou`

## Quartiles (convention v0.1)

Sur tableau trié de longueur `n` :

- Q1 = indice `floor((n−1)×0,25)`
- médiane = indice `floor((n−1)×0,5)` ;
  number pair → moyenne des deux milieux ;
  bigint pair → **médiane basse**
- Q3 = indice `floor((n−1)×0,75)`

## Interdits méthodologiques

Pas de `scoreEvolution`, ranking fitness, anti-fixation, OpenAI réel,
Solana, Live, ni p-values sophistiquées en v0.1.

## Adaptation (prudence)

Un changement de fréquence n'est pas une preuve causale. Un signal prudent
exige au minimum : fréquence, descendance différentielle, avantage économique
associé, réplication multi-seeds — puis parler de **signal expérimental**,
pas de causalité universelle.

## Fichiers

- `experiences/protocoles/evolution-pilote-v01.json` — calibration démo
- `experiences/protocoles/evolution-evaluation-v01.exemple.json` — template
- Résultats : `experiences/resultats/` (gitignored)
