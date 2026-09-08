# Reproduction autonome ESP v0.1

## Objectif

Activer une **phase de reproduction post-économie** dans `avancerUnCycle`,
sans sélection par fitness.

Chaîne :

```
CYCLE économique (agents vivants hors nés ce cycle)
→ snapshot population figé
→ éligibilité économique (même garde-fous que la reproduction mécanique)
→ priorité neutre (hash déterministe)
→ naissances retenues via le chemin mécanique canonique
→ REPRODUCTION_AUTONOME_CYCLE_TERMINEE
```

Invariant méthodologique :

> **sélection émergente ≠ ranking fitness**

Les agents qui accumulent plus de VEN peuvent *émerger* comme parents plus
souvent, uniquement parce que l'éligibilité est économique. Aucun score de
fitness, rang ou tournoi n'entre dans la planification.

## Opt-in

Absent de `EXPERIENCE_CREEE` → **inactif** (comportement historique inchangé).

Bloc `reproductionAutonome` :

| Champ | Rôle |
|-------|------|
| `version` | `politique-reproduction-autonome-v01` |
| `active` | opt-in |
| `etatsSurvieEligibles` | défaut `["sain","contraint"]` |
| `nombreMaxNaissancesParCycle` | plafond politique (≥ 0) |

**`cycleMaximum` n'appartient pas à cette politique.** Il vit dans
`criteresArret` (`criteres-arret-experience-v01`) — contrôle expérimental du
contrôleur (« l'expérience continue-t-elle ? »), indépendant de la reproduction.

Prérequis : `reproduction.active === true`. Sinon la phase est un no-op.

## Séparation des responsabilités

| Contrat | Décide |
|---------|--------|
| `PolitiqueReproductionAutonome` | cet agent peut-il tenter de se reproduire ? |
| `ParametresReproduction` | coûts, dotation, `populationMaximale`, caps cycle/enfants |
| `CriteresArretExperience` | l'expérience s'arrête-t-elle après ce cycle ? |

La **diversité génotypique** reste une **mesure descriptive** uniquement.
Aucun garde-fou anti-fixation, aucune réinjection, aucun bonus aux génotypes
rares en v0.1.

## Séparation des couches

| Couche | Fait |
|--------|------|
| `@esp/protocole` | éligibilité, priorité neutre, plan, taxonomie événements |
| Contrôleur | orchestration cycle, idempotence reprise, exécution naissances |
| Dashboard | projections descriptives (`dynamiqueEvolutive`, succès reproductif) |

## Éligibilité

`evaluerEligibiliteReproductionAutonome` :

1. politique inactive → refus ;
2. `cycleNaissance === numeroCycle` → refus (`naissance_meme_cycle`) ;
3. état de survie hors `etatsSurvieEligibles` → refus ;
4. sinon `evaluerAutorisationReproduction` (capital, réserve, population max,
   max enfants, cooldown, max reproductions cycle).

**Aucun** champ fitness / VEN ranking / score.

## Priorité neutre

`calculerPrioriteReproductionNeutre` hashe :

```
versionPolitique + graineExperience + numeroCycle + identifiantAgent + "priorite-reproduction"
```

Indépendant de l'ordre mémoire, de la VEN et de toute fitness descriptive.
Départage rare : ordre lexicographique d'identifiant.

## Capacité (places)

```
places = min(
  populationMaximale − populationAuSnapshot,
  nombreMaxReproductionsParCycle − reproductionsDejaAuSnapshot,
  politique.nombreMaxNaissancesParCycle
)
```

Retenus = premiers `places` des éligibles ordonnés.
Surplus → `identifiantsRefusCapacite` (pas un refus économique).

## Événements

| Type | Rôle |
|------|------|
| `REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE` | plan figé (éligibles, retenus, refus capacité) |
| `REPRODUCTION_AUTONOME_CYCLE_TERMINEE` | clôture phase (naissances effectuées, refus capacité) |

Les naissances elles-mêmes réutilisent la taxonomie mécanique :

`REPRODUCTION_DEMANDEE` → `AUTORISEE` → `AGENT_CREE` → `TRANSFERT_INTERNE` →
`COUT_REPRODUCTION_PAYE` → `REPRODUCTION_TERMINEE` (+ héritage / mutation).

## Ordre du cycle

1. Détecter cycle incomplet (économie **ou** phase autonome) ;
2. `CYCLE_EXPERIENCE_AVANCE` si nouveau cycle ;
3. Boucle économique — agents nés ce cycle exclus ;
4. Phase reproduction autonome ;
5. Historique / `numeroCycleCourant` ;
6. `EXPERIENCE_TERMINEE` si `criteresArret.cycleMaximum` atteint
   (indépendamment de la reproduction autonome).

Un enfant né en N n'agit qu'en N+1 et ne candidate pas en N.

## Idempotence / reprise

| Situation | Comportement |
|-----------|--------------|
| Économie complète, pas de `PLANIFIEE` | reprise → planifie puis naît |
| `PLANIFIEE` + naissances partielles | skip parents déjà `DEMANDEE`/`TERMINEE`/`REFUSEE` |
| `TERMINEE` présente | phase no-op ; prochain `avancerUnCycle` → N+1 |

Cooldown et max enfants se reconstruisent depuis le registre (enfants /
`cycleNaissance`), y compris après redémarrage SQLite.

## Héritage + mutation

Chemin unique `executerReproductionPreparee` — manuel API et autonome.

Si `mutation.active` : `CONFIGURATION_HERITEE` + éventuelles `MUTATION_APPLIQUEE`.
Voir [`HERITAGE_MUTATION.md`](./HERITAGE_MUTATION.md).

## Fitness

La fitness descriptive reste **uniquement observable**.

Interdit v0.1 :

- fitness → éligibilité ;
- fitness → priorité ;
- fitness → capacité.

Voir [`FITNESS_DESCRIPTIVE.md`](./FITNESS_DESCRIPTIVE.md).

## Projections dashboard

`ProjectionDynamiqueEvolutive` (bannière
`SELECTION_EMERGENTE_SANS_RANKING_FITNESS`) :

- candidats / retenus / refus économiques / refus capacité ;
- lignées (`partPopulationVivanteBps`) ;
- fréquences de génotypes ;
- gènes (même source que diversité héritable).

Fiche agent : `succesReproductif` (enfants, descendants, éligibilité descriptive).

## Démo non canonique

`experiences/developpement-evolution-v01.json`

- **VALEURS DE DÉMONSTRATION / NON CANONIQUES / NON PRÉENREGISTRÉES**
- mode `simulation` (divergence via profils simulateur) ;
- petite population, graine fixe ;
- reproduction + `reproductionAutonome` + mutation ;
- fournisseur Xway **simulé** — aucun réseau OpenAI.

## Tests

- Unité protocole : `paquets/protocole/tests/reproduction-autonome-v01.test.ts`
- Intégration contrôleur A–AH :
  `applications/controleur/tests/reproduction-autonome-v01.test.ts`

## Hors périmètre

Sélection explicite par fitness ; tournois ; quotas par lignée ; Solana /
Shadow / Live ; appels OpenAI dans la phase autonome.

Protocole expérimental multi-génération (matrice A/B/C/D, contrôle négatif B/C) :
[`PROTOCOLE_EXPERIMENTAL_EVOLUTION.md`](./PROTOCOLE_EXPERIMENTAL_EVOLUTION.md).
