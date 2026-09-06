# Noyau économique ESP v0.1

Ce document décrit le premier noyau économique déterministe d'ESP.
Il est indépendant de toute blockchain, de toute IA réelle et de tout
fournisseur externe.

## Unité monétaire — micro-USDC

Le numéraire v0.1 est l'USDC, représenté en **micro-USDC** entiers (`bigint`) :

- `1 USDC = 1_000_000` micro-USDC
- `10 USDC = 10_000_000` micro-USDC
- `0,10 USDC = 100_000` micro-USDC

Invariant **ESP-ECO-005** : aucun montant économique n'utilise de flottant.

Sérialisation stable : chaîne décimale (`"10000000"`), jamais de `number`.

Les taux (redevance) utilisent des **points de base** :

- `10_000` = 100 %
- `1_000` = 10 %
- `100` = 1 %

## Taxonomie d'événements

Les types économiques ne sont plus des chaînes libres. Taxonomie v0.1 :

| Type | Rôle |
|------|------|
| `AGENT_CREE` | Naissance (sans revenu) — payload canonique : génération, indexPopulation, dateNaissance, parent optionnel |
| `CAPITAL_INITIAL_ATTRIBUE` | Endowment (ancre le HWM, pas un revenu) |
| `CYCLE_DEMARRE` / `CYCLE_TERMINE` | Bornes de cycle |
| `REVENU_ACTIVITE` / `PERTE_ACTIVITE` | Activité simulée |
| `DEPENSE_COMPUTE` / `DEPENSE_DONNEES` / `FRAIS_EXECUTION` | Coûts variables agent |
| `LOYER_INFRASTRUCTURE_DU` / `LOYER_INFRASTRUCTURE_PAYE` | Loyer |
| `REDEVANCE_PROPRIETAIRE_DUE` / `REDEVANCE_PROPRIETAIRE_PAYEE` | Redevance HWM |
| `DETTE_CREEE` / `DETTE_REGLEE` | Obligations |
| `ETAT_SURVIE_MODIFIE` / `AGENT_DORMANT` / `AGENT_MORT` | Survie |
| `TRANSFERT_INTERNE` | Transfert sans création de valeur |
| `DEPENSE_INFRASTRUCTURE_PROPRIETAIRE` | Coût réel côté propriétaire |

Chaque événement porte au minimum :

- `identifiant` unique
- `versionSchema`
- `type`
- `identifiantExperience`
- `identifiantAgent` (si applicable)
- `numeroCycle`
- `sequence`
- `chargeUtile` typée
- `dateEnregistrement` (informatif uniquement)

**Vérité expérimentale** = `(numeroCycle, sequence)`.
`numeroCycle` reste une dimension expérimentale distincte.
`sequence` est attribuée exclusivement par le registre, monotone par expérience.
L'horloge système ne détermine aucune règle (**ESP-ECO-013**).

## Contrat économique versionné

`ParametresEconomiquesExperience` (alias `ContratEconomique`) est fourni au
moteur. Rien d'important n'est hardcodé :

- `version`
- `loyerInfrastructureMicroUsdc`
- `periodeLoyerEnCycles`
- `tauxRedevanceProprietairePointsDeBase`
- `coutOperationnelMinimalParCycleMicroUsdc`
- `seuilRunwaySainEnCycles`
- `seuilRunwayContraintEnCycles`
- `cyclesDormanceAvantMort`

## État économique d'un agent

Distinction stricte (**ESP-ECO-014**) :

- `capitalLiquide`
- `obligationsDues`
- totaux d'activité / dépenses / loyers / redevances
- `highWaterMarkProprietaire`
- `etatSurvie`
- `cyclesDormanceConsecutifs`

### Valeur économique nette (v0.1)

```
VEN = capitalLiquide - obligationsDues
```

Calcul isolé dans `calculerValeurEconomiqueNette` pour évoluer plus tard.

## Cycle économique

Ordre déterministe d'un cycle :

1. `CYCLE_DEMARRE`
2. résultat d'activité (`REVENU_ACTIVITE` / `PERTE_ACTIVITE`)
3. coûts variables
4. loyer si échéance (`numeroCycle % periodeLoyerEnCycles === 0`)
5. calcul redevance (high-water mark)
6. paiement ou dette de redevance
7. recalcul VEN
8. recalcul runway
9. recalcul état de survie
10. `CYCLE_TERMINE`

Entrées d'activité : `ResultatActiviteCycle` — simulé, sans IA ni marché.

### Note sur l'ordre comptable

L'ordre place la redevance **après** activité, coûts variables et loyer.
Le HWM est ancré sur la VEN **avant** paiement de la redevance
(ex. pic 120, paiement 2, capital 118, HWM = 120).
Cela évite de retaxer le même profit.

## Loyer d'infrastructure

- Échéance selon le temps expérimental (cycles).
- `LOYER_INFRASTRUCTURE_DU` constate l'échéance.
- Si paiement possible → `LOYER_INFRASTRUCTURE_PAYE` (sortie de valeur agent → trésorerie propriétaire).
- Sinon → `DETTE_CREEE` (obligation, **pas** un encaissement propriétaire).

Le règlement ultérieur (`DETTE_REGLEE` / `reglerDette`) diminue capital et
obligations du **même** montant : la VEN est inchangée (pas de double perte).
La trésorerie propriétaire n'est créditée qu'au paiement réel.

## Redevance propriétaire (high-water mark)

Un même profit n'est jamais taxé deux fois.

Exemple :

1. capital 100 → 120 → redevance sur 20
2. 120 → 110 → aucune redevance
3. 110 → 120 → aucune redevance
4. 120 → 125 → redevance uniquement sur 5

Non taxables : capital initial, endowments, transferts internes,
valeurs déjà sous HWM.

Ajustement symétrique du HWM sur transfert interne :

- entrée : `capital += M` et `HWM += M` (aucun profit taxable) ;
- sortie : `capital -= M` et `HWM = max(0, HWM - M)` (aucune perte d'activité).

Exemple : HWM=120, capital=118, sortie 10 → capital=108, HWM=110.
Remontée à 123 avant redevance → profit taxable = 13.

## Runway et survie

```
runway = floor(max(0, VEN) / coutOperationnelMinimalParCycle)
```

où `VEN = capitalLiquide - obligationsDues` (les obligations ne sont
retirées qu'une fois).

États : `sain` → `contraint` → `critique` → `dormant` → `mort`

- `runway >= seuilSain` → sain
- `runway >= seuilContraint` → contraint
- `runway >= 1` → critique
- `runway = 0` → dormant
- dormance prolongée (`cyclesDormanceAvantMort`) → mort

La mort est irréversible (**ESP-ECO-010**).

## Trésorerie propriétaire

Extérieure à la population :

- `revenusLoyers`
- `revenusRedevances`
- `depensesInfrastructure`
- `soldeNet = loyers + redevances − dépenses`

Les coûts variables déjà facturés à l'agent (compute, données, frais)
**ne sont pas** recomptés comme coût infrastructure propriétaire.

## Registre

- `RegistreEvenementsMemoire` — tests rapides
- `RegistreEvenementsSqlite` — persistance locale append-only (`node:sqlite`)

Propriétés :

- insert only
- refus des identifiants dupliqués
- **attribution monotone de `sequence` par expérience** (1, 2, 3, …) —
  le moteur ne choisit plus la séquence
- ordre préservé
- figement profond de la charge utile
- reconstruction après redémarrage

Le contrat économique est validé **obligatoirement** au début de chaque cycle
(`validerParametresEconomiques`).

## Reconstruction événementielle

`reconstruireEtatEconomique(evenements, identifiantAgent)`

Propriété attendue :

```
état temps réel === état reconstruit depuis le registre
état avant fermeture SQLite === état après réouverture + reconstruction
```

## Invariants couverts

| ID | Règle |
|----|--------|
| ESP-ECO-001 | Un mouvement pertinent → un événement |
| ESP-ECO-002 | Pas de double enregistrement (id unique) |
| ESP-ECO-003 | Immutabilité des événements |
| ESP-ECO-004 | Ordre déterministe / reconstructible |
| ESP-ECO-005 | Pas de flottants monétaires |
| ESP-ECO-006 | Dépense non débitée deux fois (id) |
| ESP-ECO-007 | Transfert interne sans création de valeur |
| ESP-ECO-008 | Sortie propriétaire diminue l'agent |
| ESP-ECO-009 | Naissance sans revenu |
| ESP-ECO-010 | Mort irréversible |
| ESP-ECO-011 | Paramètres versionnés |
| ESP-ECO-012 | Pas de Solana / OpenAI / fournisseur externe |
| ESP-ECO-013 | Temps = cycles expérimentaux |
| ESP-ECO-014 | Valeur ≠ ressources ≠ obligations |

## Hors périmètre v0.1

Wallet, Solana, Jupiter, marchés, OpenAI/Anthropic, Xway réel,
Shadow/Live, reproduction, mutation, héritage, trading, positions SOL.
