# Pré-enregistrement — évaluation évolution ESP v0.2

Document figé **avant** toute exécution des `seedsEvaluation` `2001..2020`.  
État du freeze : **`gele_non_execute`**.

Artefacts :

- Protocole : `experiences/protocoles/evolution-evaluation-v02.json`
- Freeze : `experiences/protocoles/freeze-evolution-evaluation-v02.json`
- Calibration source : `experiences/protocoles/evolution-calibration-v02-e1-01.json`
- Environnement d'exposition : `environnement-exposition-v02-e2`
- Rapport calibration : `documentation/CALIBRATION_EVOLUTION_V02.md`
- Environnement E2 : `documentation/ENVIRONNEMENT_EXPOSITION_V02_E2.md`

Version protocole : `protocole-experience-evolution-v02`  
Identifiant : `evolution-evaluation-v02`

Aucune seed d'évaluation ne doit être lancée tant que ce pré-enregistrement reste gelé non exécuté.

```text
AUCUNE EVALUATION V02 EXECUTEE
nombreSeedsEvaluationExecutees = 0
```

---

## Paramètres expérimentaux figés

Hérités **sans modification** du candidat calibré `evolution-calibration-v02-e1-01`
(dérivation déterministe — pas de recopie manuelle des paramètres scientifiques).

| Paramètre | Valeur |
|-----------|--------|
| cyclesMaximum | 20 |
| populationInitiale | 3 |
| populationMaximale | 24 |
| capitalInitialParAgentMicroUsdc | 8 000 000 |
| nombreMaxNaissancesParCycle | 4 |
| dotationEnfantMicroUsdc | 800 000 |
| coutReproductionMicroUsdc | 200 000 |
| reserveMinimaleParentMicroUsdc | 400 000 |
| tauxMutationParGeneBps / tauxMutationConditionDBps | 1000 |
| mode run | `decision_simulee` |
| fournisseur | `fournisseur-inference-simule` (aucun OpenAI / réseau / Solana) |

### Environnement décisionnel E2

Distribution d'enjeux (micro-USDC) :

```text
50000
75000
125000
175000
250000
```

Sélection de profil : `profil-enjeu-v02` (déterministe, indépendante de la condition,
du génotype, de la fitness, de la VEN et de la performance historique).

---

## Matrice expérimentale

| Condition | Reproduction autonome | Mutation | Taux mutation |
|-----------|----------------------|----------|---------------|
| **A** | OFF | OFF | — |
| **B** | ON | OFF | — |
| **C** | ON | active | **0** (sham) |
| **D** | ON | active | calibré non nul (1000 bps) |

### Comparaisons pré-enregistrées

| Rôle | Paire |
|------|-------|
| **Primaire** | **D−C** |
| Secondaire | B−A |
| Secondaire | C−B |
| Secondaire | D−B |

Appariement strict par seed (même seed sur les quatre conditions).

### Contrôle négatif B/C (bloquant)

Pour chaque seed :

```text
empreinteResultatScientifique(B) == empreinteResultatScientifique(C)
```

Exigence : **20 / 20** paires scientifiquement identiques.

Si une paire diverge → **campagne INVALIDÉE** (problème technique/expérimental).  
Ne pas interpréter D−C avant diagnostic.

---

## Hypothèses pré-enregistrées

### H1 — reproduction différentielle

> Sous contrainte économique, la reproduction autonome produit une descendance différentielle entre agents/lignées.

Comparaison principale : **B − A**.

Indicateurs : naissances, descendants, génération maximale, succès reproductif des lignées, population vivante.

**Interdit** : score fitness global.

### H2 — variation héritable exprimée

> Les mutations comportementales héritables, lorsqu'elles sont causalement exprimées par la chaîne décisionnelle v0.2, modifient les trajectoires cognitives, comportementales, économiques ou reproductives.

Comparaison principale : **D − C**.

La simple présence de mutations **ne suffit pas** à soutenir H2.

Évidence pertinente : expression cognitive, expression comportementale, conséquence économique, trajectoire économique, trajectoire reproductive.

### H3 — dynamique évolutive

> Des variantes héritables peuvent augmenter ou diminuer en fréquence à travers les générations sans mécanisme explicite de ranking fitness.

Mesurer : fréquences génotypiques, descendants par génotype/lignée, apparition, propagation, régression, extinction, fixation éventuelle.

Une hausse de fréquence seule **ne constitue pas** une preuve d'adaptation.

### H4 — signal d'adaptation économique

Distinction explicite pré-enregistrée :

```text
variation ≠ sélection différentielle ≠ adaptation
```

Un signal **prudent** d'adaptation requiert la convergence d'au moins :

1. variante héritable réellement exprimée ;
2. changement reproductif / descendance différentielle associé ;
3. changement de fréquence de la variante ;
4. avantage économique associé ;
5. réplication sur plusieurs seeds indépendantes.

Aucun élément isolé ne suffit.  
Ne jamais appeler cela **causalité universelle**.

---

## Seeds d'évaluation (liste exacte)

```text
2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010,
2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020
```

20 seeds × 4 conditions = **80 runs** prévus.

### Réserves disjointes (intersections vides)

| Plage | Usage |
|-------|--------|
| 201–205 | Diagnostic expression E1/E2 |
| 301–305 | Calibration v0.2 |
| 1001–1020 | Évaluation v0.1 (historique) |
| **2001–2020** | **Évaluation v0.2 (cette campagne)** |

---

## Métriques pré-enregistrées

### Économie

- VEN population finale
- résultat activité brut cumulé
- résultat après contrat cumulé
- résultat après reproduction cumulé
- compute cumulé
- coût cognition
- contribution propriétaire

### Survie

- population vivante finale
- extinction
- cycle extinction
- état de survie

### Reproduction

- naissances cumulées
- génération maximale
- lignées vivantes
- descendants
- descendance par lignée
- âge première reproduction
- intervalle reproduction

### Variation

- mutations cumulées
- configurations distinctes
- fréquences génotypiques
- mutations par gène

### Expression phénotypique (nouveau v0.2)

- agent-cycles mutants
- occasions d'expression
- expressions cognitives
- expressions comportementales
- conséquences économiques immédiates

Par gène :

- `seuilEnjeuPourInferenceMicroUsdc`
- `partMaxVenParCycleBps`
- `plafondCognitifMicroUsdc`
- `comportementSansInference`

### Cognition / décision

- demandes inference
- coût cognitif
- regret ex ante
- taux décisions optimales lorsque défini
- choix `utiliserInference`
- actions agir / attendre

### Interdits

Aucun agrégat du type :

- `scoreEvolution`
- `fitnessGlobale`
- `indiceAdaptationGlobal`
- ranking / classement fitness

L'analyse reste **multidimensionnelle**. Pas de moyenne comme statistique principale. Pas de score global.

---

## Analyse primaire D−C

Toutes les 20 seeds **doivent** être appariées.

Pour chaque métrique pré-enregistrée :

```text
différence = D(seed) − C(seed)
```

Montants monétaires : **bigint exact**.

Résumé par métrique :

```text
n, médiane, Q1, Q3, min, max, nPos, nNul, nNeg
```

---

## Extinctions et garde-fous

- Toutes les extinctions **conservées** dans l'échantillon.
- Aucun run exclu pour mauvaise performance scientifique.
- Cycles contraints par `populationMax` / `plafondNaissances` **enregistrés et rapportés**.
- Jamais supprimés des statistiques.

---

## Échec technique vs résultat scientifique défavorable

### Échec technique (instrument)

Exemples : exception, SQLite corrompu, artefact manquant, empreinte impossible, violation B/C.

### Résultat scientifique défavorable (conservé)

Exemples : D < C, extinction, aucune adaptation, mutation délétère, aucune fixation, aucun avantage économique.

Ces cas **ne sont pas** des échecs techniques. Ils **doivent** être conservés.

---

## Règle de retry

Retry autorisé **uniquement** pour un échec **technique** documenté, avec :

```text
même condition
même seed
même protocole
même empreinte protocole
même code
```

La raison du retry doit être enregistrée.  
Interdit de changer de seed pour remplacer une mauvaise performance.

Une violation B/C invalide la **campagne** entière — ce n'est pas un retry de seed isolé.

---

## Interdiction d'arrêt précoce

Une fois l'évaluation lancée :

```text
20 seeds × 4 conditions = 80 runs
```

doivent être exécutés. Pas d'arrêt parce que le résultat paraît évident, D mauvais, D bon, ou absence apparente d'effet.

---

## Empreintes scientifiques

Mécanismes SHA-256 existants conservés :

- `empreinteProtocole`
- `empreinteExecutionRun`
- `empreinteResultatScientifique`

### Choix figé — expression phénotypique et `empreinteResultatScientifique`

Les **observables cognitives / décisionnelles de trajectoire** déjà canoniques
(`demandesInference`, `coutCognitifMicroUsdc`, regret, taux décisions optimales, etc.)
**font partie** de `empreinteResultatScientifique`.

Les **agrégats diagnostiques contrefactuels** produits sous `diagnostic-exposition/`
(occasions d'expression, expressions par gène via réversion un-gène, etc.)
**ne font pas partie** de `empreinteResultatScientifique`.

Raison : ce sont des artefacts d'analyse post-hoc ; les inclure risquerait de
contaminer le contrôle négatif B≡C et de mélanger sorties de run et diagnostics dérivés.
Ils restent rapportés et analysés séparément selon les métriques pré-enregistrées ci-dessus.

N'influencent **pas** l'empreinte scientifique :

- timestamps wall-clock
- chemins filesystem
- clés Ed25519
- ordre non scientifique
- concurrency

---

## Interdiction de modifier le protocole après vision des résultats

Après gel, `empreinteProtocole` du freeze doit rester égale à celle du protocole evaluation.
Toute modification refuse la continuité scientifique de ce freeze.
Un nouveau protocole exige un **nouveau** freeze et un nouveau pré-enregistrement.

### Identité Git (non auto-référentielle)

Le freeze v0.2 **n'enregistre pas** le SHA du commit canonique (impossible :
ce SHA est celui du commit qui contient le freeze).

Champs figés :

| Champ | Sémantique |
|-------|------------|
| `gitShaPreparation` | HEAD observé **pendant la préparation** du freeze |
| `gitRefFreezeCanonique` | tag prévu `esp-evolution-evaluation-v02-freeze` |

`gitShaPreparation` **ne constitue pas** l'identité canonique du code v0.2.

Le SHA code **canonique** sera le commit vers lequel pointera le tag
`esp-evolution-evaluation-v02-freeze` **après merge**.

---

## Audit pré-lancement

Avant toute exécution evaluation :

```text
nombreSeedsEvaluationExecutees = 0
```

Vérifier l'absence de batch `evolution-evaluation-v02*` et de runs `*-seed-2001` …
`*-seed-2020` dans `experiences/resultats/`.

**INTERDICTION** à ce stade :

```bash
pnpm experience:evolution -- \
  --protocole experiences/protocoles/evolution-evaluation-v02.json
```
