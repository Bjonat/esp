# Conception — évolution ESP v0.3

Document de **conception uniquement**. Aucun mécanisme métier v0.3 n'est
implémenté ici. Les artefacts, protocoles, freezes, tags et résultats
v0.1 / v0.2 restent **inchangés**.

Références :

- Clôture v0.2 : `documentation/RESULTATS_EVOLUTION_V02.md`
- Roadmap : `documentation/ROADMAP.md`
- Pré-enregistrement v0.2 : `documentation/PREENREGISTREMENT_EVOLUTION_V02.md`
- Reproduction mécanique : `documentation/REPRODUCTION.md`
- Reproduction autonome : `documentation/REPRODUCTION_AUTONOME.md`

---

## 0. Question scientifique

> Quand les ressources économiques deviennent quantitativement déterminantes
> pour la capacité reproductive, les variants qui génèrent un avantage
> économique obtiennent-ils davantage de descendants et augmentent-ils leur
> fréquence ?

Couplage à tester explicitement :

```text
performance économique
  → ressources disponibles
  → capacité à financer la reproduction
  → descendants
  → fréquences génotypiques
```

### Invariant fondamental (non négociable)

ESP **ne doit pas** introduire :

- score global de fitness ;
- classement des agents ;
- fonction choisissant le « meilleur agent » ;
- bonus reproductif parce qu'une métrique est meilleure ;
- bonus / malus lié directement à un gène ;
- connaissance de l'identité d'un génotype dans la règle reproductive ;
- probabilité reproductive calculée depuis un score synthétique.

La sélection **doit** émerger exclusivement de contraintes économiques
réellement comptabilisées.

#### Contrôle anti-fitness (ordre entre parents)

Aucune des valeurs suivantes **ne peut** influencer l'ordre entre parents :

- VEN relatif des parents ;
- résultat économique relatif ;
- fitness descriptive ;
- nombre de descendants ;
- génotype ;
- fréquence génotypique.

La seule influence économique permise est **locale** :

```text
cet agent peut-il effectivement financer cette naissance maintenant ?
```

L'ordre inter-parents reste la **priorité neutre** (hash déterministe).

Les observations exploratoires v0.2 (ex. `seuilEnjeuPourInferenceMicroUsdc:
100000 → 150000`) **ne doivent pas** être utilisées pour favoriser
volontairement un gène. Elles éclairent uniquement le problème expérimental.

---

## 1. Audit exact de la reproduction v0.2

### 1.1 Chaîne réelle observée

```text
état économique agent (capitalLiquide, obligationsDues, VEN, étatSurvie)
        ↓
éligibilité autonome
        ↓
autorisation économique (seuil binaire)
        ↓
arbitrage de places (priorité neutre + plafonds)
        ↓
rétention 0|1 naissance par parent retenu
        ↓
exécution mécanique atomique (1 naissance)
```

Paramètres d'évaluation v0.2 (référence, non modifiés) :

| Paramètre | Valeur |
|-----------|--------|
| `dotationEnfantMicroUsdc` | 800 000 |
| `coutReproductionMicroUsdc` | 200 000 |
| `reserveMinimaleParentMicroUsdc` | 400 000 |
| `populationMaximale` | 24 |
| `nombreMaxReproductionsParCycle` | 3 |
| `nombreMaxEnfantsParAgent` | 3 |
| `cooldownCycles` | 1 |
| `nombreMaxNaissancesParCycle` (politique) | 4 |

Coût unitaire d'une naissance financée :

```text
besoin = dotation + coûtReproduction = 1 000 000 micro-USDC
```

### 1.2 Étape par étape

#### A. État économique

| Élément | Emplacement |
|---------|-------------|
| Type | `EtatEconomiqueAgent` — `paquets/protocole/src/etat-economique.ts` |
| VEN | `calculerValeurEconomiqueNette` = `capitalLiquide − obligationsDues` |
| Dépendances | capital liquide, obligations dues, état de survie |

La VEN et le capital **ne sont pas** des scores de fitness. Ce sont des
soldes comptables.

#### B. Éligibilité autonome

| Élément | Emplacement |
|---------|-------------|
| Fonction | `evaluerEligibiliteReproductionAutonome` |
| Fichier | `paquets/protocole/src/politique-reproduction-autonome.ts` |
| Politique | `PolitiqueReproductionAutonome` — `parametres-reproduction-autonome.ts` |

Règles exactes (ordre) :

1. politique inactive → refus `reproduction_desactivee` ;
2. `cycleNaissance === numeroCycle` → refus `naissance_meme_cycle` ;
3. `etatSurvie ∉ etatsSurvieEligibles` → refus `etat_survie_non_eligible` ;
4. sinon délégation à `evaluerAutorisationReproduction`.

Dépendances économiques : via l'autorisation (étape C). Aucune VEN relative,
aucun ranking.

#### C. Autorisation économique (seuil binaire)

| Élément | Emplacement |
|---------|-------------|
| Fonction | `evaluerAutorisationReproduction` |
| Fichier | `paquets/protocole/src/reproduction.ts` |
| Paramètres | `ParametresReproductionExperience` — `parametres-reproduction.ts` |

Règles exactes (ordre) :

1. `parametres.active` ;
2. parent non mort ;
3. `populationTotale + 1 ≤ populationMaximale` ;
4. `nombreEnfantsParent < nombreMaxEnfantsParAgent` ;
5. `reproductionsDejaCeCycle < nombreMaxReproductionsParCycle` ;
6. cooldown : si `cooldownCycles > 0` et dernière naissance trop récente → refus ;
7. `capitalLiquide ≥ dotation + coût` sinon `capital_insuffisant` ;
8. `VEN − (dotation + coût) ≥ réserveMinimale` sinon `reserve_minimale` ;
9. sinon `{ autorisee: true }`.

**Point critique :** le résultat est **booléen**. Un parent qui dépasse le
seuil de 1 micro-USDC et un parent qui le dépasse de 10 000 000 micro-USDC
obtiennent la **même** autorisation : une seule tentative possible dans le
plan autonome courant.

#### D. Planification / arbitrage

| Élément | Emplacement |
|---------|-------------|
| Fonction | `planifierReproductionsAutonomes` |
| Priorité | `calculerPrioriteReproductionNeutre` / `ordonnerCandidatsParPrioriteNeutre` |
| Fichier | `paquets/protocole/src/politique-reproduction-autonome.ts` |
| Orchestration | `ControleurExperience.executerPhaseReproductionAutonome` — `applications/controleur/src/controleur.ts` |

Capacité globale (places) :

```text
places = max(0, min(
  populationMaximale − populationAuSnapshot,
  nombreMaxReproductionsParCycle − reproductionsDejaAuSnapshot,
  politique.nombreMaxNaissancesParCycle
))
```

Retenus = premiers `places` des éligibles ordonnés par hash neutre
(`versionPolitique + graine + cycle + identifiantAgent + "priorite-reproduction"`).
Départage rare : ordre lexicographique d'identifiant.

**Indépendant** de la VEN, du surplus, du génotype et de la fitness descriptive.

Chaque parent retenu apparaît **au plus une fois** dans `identifiantsRetenus`
→ **au plus une naissance** par parent et par cycle autonome.

#### E. Exécution / naissance

| Élément | Emplacement |
|---------|-------------|
| Méthode | `executerReproductionPreparee` — contrôleur |
| Préparation | `preparerReproduction` / lot atomique — `reproduction.ts` |
| Événements | `REPRODUCTION_DEMANDEE` → `AUTORISEE` → `AGENT_CREE` → `TRANSFERT_INTERNE` → `COUT_REPRODUCTION_PAYE` → `REPRODUCTION_TERMINEE` (+ héritage / mutation) |

Atomicité : lot unique `registre.ajouterPlusieurs`. Idempotence via
`REPRODUCTION_TERMINEE` / analyse par `identifiantReproduction`.

#### F. Événements de phase et projections

| Type | Fichier |
|------|---------|
| `REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE` | `evenements-reproduction-autonome.ts` |
| `REPRODUCTION_AUTONOME_CYCLE_TERMINEE` | idem |
| Stats agent | `projections-reproduction.ts` |
| Dynamique évolutive | `projections-evolution.ts` |

Le plan figé expose `placesDisponibles`, éligibles, retenus, refus capacité.
Il **n'expose pas** de surplus reproductif ni de capacité multi-naissances.

### 1.3 Pourquoi deux agents économiquement différents peuvent avoir la même descendance

| Facteur | Effet égalisateur |
|---------|-------------------|
| **Seuil d'éligibilité binaire** | Tout agent au-dessus du seuil est « aussi éligible » qu'un agent beaucoup plus riche. |
| **Une seule rétention par parent / cycle** | Le surplus ne finance pas une 2ᵉ naissance dans le même plan. |
| **`cooldownCycles = 1`** | Au mieux une naissance tous les deux cycles, indépendamment du surplus. |
| **`nombreMaxEnfantsParAgent = 3`** | Plafond absolu : au-delà, le surplus est reproductivement mort. |
| **Plafonds globaux** | `populationMaximale`, `nombreMaxReproductionsParCycle`, `nombreMaxNaissancesParCycle` tronquent avant que le surplus ne s'exprime. |
| **Priorité neutre** | Entre éligibles, l'arbitrage n'utilise pas le surplus économique. |

Conséquence empirique v0.2 (cohérente avec cet audit) :

- petites différences économiques répétées (ex. médiane ≈ +1 562 micro-USDC)
  sans différence de descendance ;
- 0/100 paires contrefactuelles avec avantage économique **et** avantage de
  descendance simultanés ;
- H4 non soutenue.

Formulation de travail (hypothèse, non démontrée comme seule cause) :

> v0.2 convertit surtout les ressources en **éligibilité discrète**. Une fois
> le seuil franchi, le mécanisme normal de sélection n'est plus le surplus
> économique mais les plafonds / cooldown / priorité neutre.

---

## 2. Mécanisme v0.3 proposé

### 2.1 Principe

Transformer la reproduction autonome pour que le **nombre de naissances
effectivement financées** dépende quantitativement des ressources
économiquement mobilisables du parent, via les primitives du noyau :

```text
ressources économiquement disponibles du parent
        ↓
coût économique complet d'une naissance
        ↓
nombre de naissances effectivement finançables
```

Sans inventer de `fitnessScore` ni de `scoreReproductif`.

### 2.2 Coût économique complet d'une naissance

Réutiliser les montants déjà comptabilisés :

```text
coutNaissance =
    dotationEnfantMicroUsdc
  + coutReproductionMicroUsdc
```

Après chaque naissance, le parent doit encore respecter :

```text
VEN_après ≥ reserveMinimaleParentMicroUsdc
capitalLiquide_après ≥ 0   (garanti si les débits sont atomiques)
```

Obligations déjà dues : elles réduisent la VEN canonique
(`VEN = capitalLiquide − obligationsDues`) et **restreignent** donc le
nombre de naissances finançables. Ne pas les soustraire une seconde fois
hors de la VEN.

**Interdit de double-compte :**

- ne pas additionner capital **et** VEN comme deux stocks indépendants ;
- ne pas traiter les totaux d'activité (`totalRevenusActivite`, etc.) comme
  ressources disponibles ;
- ne pas utiliser HWM, fitness descriptive, ni fréquences génotypiques.

### 2.3 Option A — capacité calculée

Idée :

```text
surplusReproductif =
  max(0, VEN_canonique − reserveMinimaleParent)

capaciteTheorique =
  floor(surplusReproductif / coutNaissance)
```

Puis plafonner par garde-fous locaux / globaux.

#### Avantages

- Formule explicite, auditable, déterministe au snapshot.
- Observabilité directe (`capaciteTheorique` dans le plan).

#### Risques

- La capacité calculée peut **ressembler** à un score si elle est utilisée
  pour classer les agents (interdit).
- Si on exécute N naissances sans revalider l'état après chaque débit, on
  risque une divergence avec le moteur économique réel.

### 2.4 Option B — autorisations successives (retenue)

Idée :

1. figer un ordre déterministe des parents candidats (priorité neutre
   inchangée — **pas** un ranking économique) ;
2. ouvrir / figer une **fenêtre reproductive** par parent éligible ;
3. pour chaque tentative du plan, revalider l'autorisation économique sur
   l'état courant et exécuter une naissance atomique ;
4. après chaque naissance réussie, l'état parent / population / compteurs
   sont ceux du registre.

#### Avantages

- Mécanisme le plus économiquement direct : chaque naissance est autorisée
  par le moteur économique réel.
- Pas de nouvelle grandeur « fitness reproductive ».
- Atomicité / reprise : réutilise le chemin mécanique + idempotence.
- Les obligations, débits et réserve restent cohérents après coup.

#### Risque architectural explicite (v0.2)

Réutiliser **naïvement** `evaluerAutorisationReproduction` v0.2 après la
première naissance du cycle ferait échouer **toutes** les tentatives
suivantes via `cooldown` (`numeroCycle − cycleDerniereNaissance <
cooldownCycles`). Cela **détruirait** le couplage quantitatif recherché.
D'où le contrat fenêtre / naissance du §2.6.

### 2.5 Comparaison et décision

| Critère | Option A | Option B |
|---------|----------|----------|
| Simplicité conceptuelle | formule claire | boucle sur autorisation |
| Traçabilité économique | bonne si recalculée | excellente (chaque débit réel) |
| Déterminisme | bon au snapshot | bon si plan de tentatives figé |
| Reprise crash | nécessite rejeu de N | naissance par naissance |
| Absence de score | attention (capacité ≠ score) | naturelle |
| Invariants noyau | doit revalider à l'exécution | natifs |

**Décision de conception : Option B — autorisations successives avec plan
déterministe figé.**

La capacité théorique (formule de l'option A) est **conservée comme
observable et borne haute de planification**, jamais comme clé de tri ni
comme score.

```text
capaciteTheorique  →  observabilité + borne haute du plan
autorisation réelle successive  →  décision économique effective
```

### 2.6 Contrat conceptuel final du mécanisme reproductif v0.3

#### A. Coût et capacité (non classants)

```text
coutNaissance = dotationEnfant + coutReproduction

surplusReproductif =
  max(0, VEN_canonique − reserveMinimaleParent)

capaciteTheorique =
  floor(surplusReproductif / coutNaissance)
```

`VEN_canonique` = `calculerValeurEconomiqueNette` =
`capitalLiquide − obligationsDues`. Les obligations, loyers, dettes ou
redevances **ne sont pas** soustraits une deuxième fois hors de cette VEN.

Rôles de `capaciteTheorique` :

| Autorisé | Interdit |
|----------|----------|
| observable / rapportée | score |
| borner / planifier les tentatives | classer les parents |
| diagnostic d'exposition | modifier l'ordre neutre |

L'**autorité finale** reste l'autorisation économique successive de chaque
naissance.

#### B. Séparation fenêtre reproductive / naissance

Deux autorisations conceptuellement distinctes (à implémenter en v03-A/B,
non codées ici) :

| Contrat | Décide | Inclut le cooldown ? |
|---------|--------|----------------------|
| **Ouverture de fenêtre reproductive** | ce parent peut-il entrer dans un épisode reproductif **ce cycle** ? | **oui** — cooldown entre cycles / épisodes |
| **Autorisation économique de naissance** | cette tentative `k` est-elle finançable **maintenant** ? | **non** — ressources, réserve, garde-fous restants, état de survie |

Séquence conceptuelle obligatoire :

```text
1. critères d'accès à la fenêtre reproductive (dont cooldown inter-cycles)
2. plan de tentatives du cycle figé (ordre neutre + capacités)
3. plusieurs tentatives PEUVENT s'exécuter dans le même cycle
4. après chaque naissance : recalcul / revalidation économique
5. le cooldown NE DOIT PAS invalider artificiellement la tentative suivante
   du même plan
6. au cycle suivant, le cooldown normal v0.3 s'applique à nouveau
```

Après la première naissance du cycle, `cycleDerniereNaissanceParent` devient
le cycle courant **pour les cycles futurs** uniquement ; il ne ferme pas la
fenêtre déjà ouverte.

#### C. Planification des tentatives

```text
tentativesParent = min(
  capaciteTheorique,
  nombreMaxEnfantsParAgent − nombreEnfantsParent,  // garde-fou seulement
  placesGlobalesRestantesAuMomentDuParent
)
```

Pas de tri par `capaciteTheorique`.

#### D. Exécution atomique (Option B)

Pour chaque parent dans l'ordre neutre, pour `k = 1 .. tentativesParent` :

1. revalider les contraintes économiques (sans cooldown intra-fenêtre) ;
2. si refus → arrêt explicite avec motif ;
3. si OK → lot atomique de naissance (`identifiantReproduction` déterministe
   distinct) ;
4. naissance déjà commitée → ne jamais rejouer ;
5. naissance non commitée → reprise exacte possible ;
6. décrémenter les places globales restantes ;
7. tentative `k+1` ou passage au parent suivant.

#### E. `nombreMaxEnfantsParAgent`

Conservé **uniquement comme garde-fou**.

Il **ne doit pas** être normalement le facteur limitant en v0.3. La
calibration choisit une valeur **suffisamment haute** pour que la contrainte
économique soit généralement atteinte avant ce plafond.

#### F. Garde-fous globaux

Conservés comme **sécurités expérimentales**, non comme pression de
sélection :

- `populationMaximale` ;
- plafond absolu de naissances par cycle ;
- éventuel plafond absolu par parent (`nombreMaxEnfantsParAgent`).

Critère de calibration proposé (seuil exact à pré-enregistrer avant
évaluation) :

```text
blocages_imputables_aux_garde_fous_de_securite
  / opportunites_reproductives_theoriquement_financables
  < 5 %
```

Si ce seuil est régulièrement dépassé, la calibration **masque** le
mécanisme économique et doit être rejetée / retunée.

Arbitrage sous saturation globale : priorité neutre uniquement
(contrôle anti-fitness du §0).

### 2.7 Versionnement

Nouvelle version de protocole / politique, par exemple :

- `politique-reproduction-autonome-v03` (ou équivalent nommé sans ambigüité) ;
- `protocole-experience-evolution-v03`.

Les chemins `parametres-reproduction-v01` + politique v01 restent
disponibles et testés pour v0.1/v0.2. Aucune bascule silencieuse.

---

## 3. Garde-fous, observabilité des arrêts et calibration d'exposition

Le diagnostic puis la calibration v0.3 doivent vérifier que des écarts de
surplus se traduisent en écarts de naissances **avant** saturation des
garde-fous, et que le ratio de blocages de sécurité reste sous le seuil
pré-enregistré (candidat : 5 %).

L'observabilité **doit** distinguer les motifs d'arrêt :

| Motif | Signification |
|-------|----------------|
| `ressources_insuffisantes` | contrainte économique (mécanisme normal) |
| `nombre_enfants_max` | garde-fou parent |
| `population_maximale` | garde-fou global |
| `naissances_cycle_max` | garde-fou de cycle |
| `fenetre_refusee_cooldown` | accès fenêtre refusé (inter-cycles) |

Si plusieurs agents dépassent simultanément un garde-fou global, l'ordre
reste neutre (cf. §2.6 / contrôle anti-fitness).
---

## 4. Matrice expérimentale v0.3

Conserver A / B / C / D :

| Condition | Reproduction v0.3 | Mutation |
|-----------|-------------------|----------|
| **A** | OFF | OFF |
| **B** | ON | OFF |
| **C** | ON | active, taux = 0 (sham) |
| **D** | ON | active, taux non nul gelé après calibration |

Contrôle négatif bloquant :

```text
empreinteResultatScientifique(B) ≡ empreinteResultatScientifique(C)
```

à seed égale.

| Rôle | Comparaison |
|------|-------------|
| Primaire | **D − C** |
| Secondaires | B − A, C − B, D − B |

Ne pas ajouter de conditions sans justification scientifique forte.

---

## 5. Hypothèses v0.3 (propositions pré-enregistrables)

### H1 — dynamique multi-générationnelle financée

> La reproduction financée économiquement (capacité quantitative) produit une
> dynamique multi-générationnelle différenciée sous contrainte de ressources.

Comparaison principale : **B − A**.  
Indicateurs : naissances, génération maximale, population vivante, descendance
par lignée.  
Interdit : score fitness global.

### H2 — expression causale des mutations

> Les mutations héritables restent causalement exprimées dans les décisions
> et les résultats économiques (et éventuellement reproductifs).

Comparaison principale : **D − C**.  
Évidence : expressions cognitives / comportementales / conséquences
économiques immédiates (comme v0.2). La seule présence de mutations ne
suffit pas.

### H3 — dynamique des fréquences

> Les fréquences génotypiques évoluent sur plusieurs générations sans ranking
> fitness.

Mesures : apparition, part mutante, persistence, extinction éventuelle du
fondateur, descendants par génotype.  
Une hausse de fréquence seule ≠ adaptation.

### H4 — couplage avantage économique → avantage reproductif

> Parmi les variants héritables **exprimés**, ceux qui présentent un avantage
> économique **hors reproduction** obtiennent également un avantage en
> **enfants directs** et augmentent leur représentation, de façon réplicable.

#### Statut scientifique de H4

H4 **ne cherche pas** `D > C` globalement.

- D peut rester globalement moins performant que C tout en contenant un
  **signal adaptatif local** répliqué.
- Inversement, une hausse globale D−C **ne suffit pas** à soutenir H4 sans
  convergence au niveau des variants.

H4 exige une **convergence booléenne** au niveau variant, pas un score
global ni un verdict populationnel unique.

#### Métrique économique primaire — `resultatEconomiqueHorsReproduction`

**Interdit comme primaire H4 :** le VEN final de l'agent (circularité :
une reproduction réussie consomme des ressources et dégrade le VEN).

**Primaire :**

```text
resultatEconomiqueHorsReproduction (fenêtre d'exposition E)
  = revenus activité
  − pertes activité
  − compute
  − données
  − frais exécution
  − loyers
  − redevances
```

**Exclus explicitement :**

- dotations aux enfants ;
- coûts de reproduction (`COUT_REPRODUCTION_PAYE`) ;
- transferts internes liés à la naissance.

Le VEN reste une **métrique secondaire** (descriptive).

##### Reconstructibilité

Cette grandeur correspond conceptuellement au
`resultatApresContratMicroUsdc` déjà produit par la fitness descriptive
(`paquets/protocole/src/mesures-fitness.ts`, documentation
`FITNESS_DESCRIPTIVE.md`) :

```text
resultatActiviteBrut = revenus − pertes
resultatOperationnelAvantContrat =
  brut − compute − données − fraisExecution
resultatApresContrat =
  opérationnel − loyers − redevances
```

Les coûts de reproduction et les dotations **ne sont pas** inclus dans
`resultatApresContrat` (ils sont suivis à part :
`coutsReproductionPayesMicroUsdc`, transferts internes).

**Besoin d'observabilité v0.3 :** exposer / figer cette métrique sous le
nom canonique `resultatEconomiqueHorsReproduction` sur la fenêtre
`[cycleNaissance, cycleNaissance + E − 1]` (ou équivalent inclusif pré-
enregistré), pour les paires contrefactuelles et les rapports H4 — sans
créer de score.

#### Métrique reproductive primaire — enfants directs

| Rôle | Mesure |
|------|--------|
| **Primaire** | nombre d'**enfants directs** |
| Secondaires | descendants cumulés ; génération maximale de la branche ; représentation génotypique |

Raison : les enfants directs mesurent le couplage immédiat
`ressources → capacité reproductive`. Les descendants cumulés incorporent
ensuite les performances des générations suivantes.

#### Fenêtre d'exposition `E` (procédure, pas valeur arbitraire ici)

`E` **n'est pas** fixée numériquement dans ce document de conception.

Procédure pré-enregistrable :

1. `E` est figée **après calibration** et **avant** toute évaluation
   officielle ;
2. déterminée **uniquement** à partir de la mécanique temporelle du
   protocole calibré ;
3. règle : choisir la **plus petite** fenêtre entière de cycles permettant
   à un agent de référence, dans les conditions reproductives calibrées et
   **sans mutation**, de disposer d'au moins **une opportunité complète de
   reproduction financée** ;
4. cette détermination **peut** utiliser les conditions de contrôle B/C de
   **calibration** ;
5. elle **ne doit pas** utiliser : avantage économique des mutants,
   fréquence d'un génotype, H4, seeds d'évaluation.

Pour le test primaire H4, seules les paires disposant d'au moins `E`
cycles complets d'exposition sont éligibles. Les mutations plus tardives
restent dans les résultats descriptifs mais sont classées
`exposition_insuffisante` pour H4 primaire.

#### Couches de mesure

1. **Traitement agrégé D−C** (descriptif populationnel, non suffisant pour
   H4 seul) : VEN secondaire, résultat hors reproduction, naissances,
   fréquences.
2. **Paires contrefactuelles propres** (couplage individuel) — appariement
   au moins aussi strict que v0.2 post-hoc :
   - même seed, même identifiant enfant, même parent, même cycle de
     naissance, même génération ;
   - parent encore génotypiquement identique C/D avant mutation ;
   - enfant C = héritage non muté ;
   - exposition ≥ `E`.

Pour chaque paire éligible :

- Δ `resultatEconomiqueHorsReproduction` ;
- Δ enfants directs ;
- (population) Δ représentation du génotype mutant.

**H4 n'est soutenue** que si la synthèse du §6 est atteinte.
---

## 6. Critère de sélection adaptative (signal convergent)

Un mutant **ne suffit pas** s'il :

- gagne seulement plus d'argent, **ou**
- a seulement plus d'enfants, **ou**
- augmente seulement en fréquence.

### Chaîne pré-enregistrée (tous les booléens requis par cas)

```text
mutation héritée
  → expression phénotypique démontrée
  → avantage économique hors reproduction
      (Δ resultatEconomiqueHorsReproduction > 0 sur E)
  → avantage en enfants directs
      (Δ enfants directs > 0 à exposition ≥ E)
  → augmentation de représentation génotypique (sur la seed)
  → réplication indépendante
```

Aucun score global n'additionne ces critères.

### Réplication — `R = 5`

Décision de conception (indépendante des occurrences favorables v0.2) :

```text
R = 5 seeds indépendantes
```

pour une **même direction de mutation** ou un **même variant précisément
défini**.

| Situation | Classification |
|-----------|----------------|
| `< 5` seeds éligibles pour le variant | `preuves_insuffisantes_pour_replication` (ni positif ni négatif) |
| `≥ 5` seeds où la chaîne complète est vraie | signal adaptatif **répliqué** |
| seeds avec chaîne incomplète / sens opposé | rapportées ; empêchent la sur-interprétation |

### Règle de synthèse stricte (sans score)

Soit un variant `V` précisément défini.

1. Construire `S_elig` : seeds d'évaluation où au moins une paire
   contrefactuelle propre de `V` a exposition ≥ `E` et expression
   phénotypique démontrée.
2. Si `|S_elig| < 5` → `preuves_insuffisantes_pour_replication` pour `V`.
3. Soit `S_pos` ⊆ `S_elig` les seeds où **toutes** les conditions suivantes
   sont vraies pour au moins une paire éligible de `V` :
   - Δ `resultatEconomiqueHorsReproduction` > 0 ;
   - Δ enfants directs > 0 ;
   - représentation du génotype de `V` en hausse (règle de mesure figée au
     pré-enregistrement).
4. `V` est un **signal adaptatif répliqué** si et seulement si
   `|S_pos| ≥ 5`.
5. H4 campagne **soutenue** ssi il existe ≥ 1 variant signal adaptatif
   répliqué.
6. Sinon H4 **non soutenue** ; si aucun variant n'atteint `|S_elig| ≥ 5`,
   qualifier aussi la campagne de
   `preuves_insuffisantes_pour_replication` (éviter un faux négatif
   rhétorique).

Le traitement D−C agrégé reste rapporté pour le contexte ; il ne tranche
pas H4 à lui seul.

---

## 7. Diagnostics avant calibration

Phase distincte : `diagnostic-exposition-v03` (seeds disjointes).

Objectifs (exposition du mécanisme, **pas** recherche de D > C) :

1. les quatre gènes restent exprimables (sensibilité locale) ;
2. une différence économique peut provoquer une différence de
   `capaciteTheorique` **et** de naissances effectuées ;
3. les garde-fous ne saturent pas systématiquement (critère < 5 % candidat) ;
4. agents identiques → trajectoires identiques (déterminisme) ;
5. B ≡ C lorsque `tauxMutation = 0` ;
6. audit anti-fitness : aucun score, ranking, ou branche génotype → bonus
   reproductif ; l'ordre inter-parents ignore VEN / résultat / descendants /
   génotype / fréquences.

### Contrôle positif mécaniste (diagnostic uniquement)

Deux agents **identiques** en tout point (même génotype, même comportement),
mais disposant de **ressources reproductives différentes**, DOIVENT pouvoir
obtenir une capacité de naissance différente lorsque leurs ressources
franchissent des multiples du `coutNaissance`.

Ce test vérifie uniquement :

```text
ressources → capacité reproductive
```

Il **ne doit pas** :

- favoriser un gène ;
- être inclus dans A/B/C/D officiel ;
- être utilisé comme résultat d'évaluation ;
- injecter une fitness artificielle.

Contrast recommandé : sous politique v01 (binaire), la même différence de
surplus au-dessus du seuil ne produit souvent **aucune** différence de
naissances.

---

## 8. Calibration

Fenêtre opératoire uniquement :

- plusieurs générations ;
- mutations présentes en D ;
- expression phénotypique ;
- **différences de capacité reproductive observables** ;
- pas d'explosion systématique ;
- pas d'extinction systématique ;
- garde-fous de sécurité < seuil pré-enregistré (candidat 5 % des
  opportunités théoriquement finançables) ;
- `nombreMaxEnfantsParAgent` assez haut pour ne pas être le frein normal ;
- durée d'exécution raisonnable ;
- après calibration : figer `E` via la procédure du §5 (B/C calibration
  seulement).

**Interdit d'optimiser :** VEN(D), D−C, fréquence d'un variant, réussite de H4.

Seeds disjointes obligatoires (proposition de plages, à figer) :

| Usage | Plage candidate |
|-------|-----------------|
| Diagnostic v0.3 | 401–410 (exemple) |
| Calibration v0.3 | 501–510 (exemple) |
| Évaluation v0.3 | 3001–3020 (exemple) |

Intersection vide avec `201–205`, `301–305`, `1001–1020`, `2001–2020`.

---

## 9. Atomicité et reprise — modèle Option B figé

Exigences :

| Propriété | Règle v0.3 |
|-----------|------------|
| Déterminisme | même protocole + seed + condition → mêmes empreintes scientifiques |
| Idempotence | analyse par `identifiantReproduction` déterministe distinct |
| Rejouabilité | reconstruction registre → même état |
| Atomicité | une naissance = un lot ; jamais parent débité sans enfant durable |
| Crash | reprise sans naissance double |

### Séquence attendue

```text
1.  ordre des parents = priorité neutre existante
2.  ouverture / fixation de la fenêtre reproductive (cooldown ici)
3.  calcul descriptif de capaciteTheorique
4.  plan de tentatives stable (figé dans PLANIFIEE)
5.  tentative n
6.  revalidation économique après naissances précédentes
    (sans cooldown intra-fenêtre)
7.  lot atomique de naissance
8.  reprise déterministe si crash
9.  tentative n+1
10. arrêt explicite avec raison
```

**Politique d'arbitrage v03-B (implémentée)** : round-robin déterministe
entre parents dans l'ordre neutre (`A1, B1, C1, A2, …`), afin qu'un plafond
global ne soit pas monopolisé par le premier hash. Détail :
`documentation/REPRODUCTION_ECONOMIQUE_V03.md`.

Règles d'idempotence :

- chaque naissance a un `identifiantReproduction` déterministe distinct ;
- une naissance **déjà commitée** ne doit pas être rejouée ;
- une naissance **non commitée** doit pouvoir être reprise exactement ;
- ordre des enfants d'un parent : `e001`, `e002`, … strictement croissant ;
- clôture `TERMINEE` seulement lorsque toutes les tentatives planifiées sont
  consumées (succès, refus économique, ou places globales épuisées).

---

## 10. Événements et observabilité

Préférer l'enrichissement des charges existantes à une inflation de types.

### Enrichissements proposés

`REPRODUCTION_AUTONOME_CYCLE_PLANIFIEE` (champs additionnels versionnés) :

- par parent : `fenetreOuverte`, `surplusReproductif`, `capaciteTheorique`,
  `tentativesPlanifiees`, `bornePar`
  (`economie` | `max_enfants` | `population_maximale` |
  `naissances_cycle_max` | `fenetre_refusee_cooldown` | …) ;
- totaux : `placesGlobalesInitiales`.

`REPRODUCTION_AUTONOME_CYCLE_TERMINEE` :

- `naissancesEffectuees` ;
- `tentativesPlanifiees` / `tentativesExecutees` ;
- `arretsParMotif` (distinction obligatoire des quatre familles du §3) ;
- compteurs de contrainte par garde-fou vs économie.

Événements mécaniques unitaires : taxonomie actuelle conservée ; motif
d'arrêt explicite si une tentative planifiée est refusée en réévaluation.

### Reconstruction a posteriori obligatoire

Le registre doit permettre de retrouver :

- ressources reproductives disponibles avant décision ;
- coût total d'une naissance ;
- capacité théorique ;
- tentatives planifiées vs effectuées ;
- raison d'arrêt (économie vs garde-fou) ;
- `resultatEconomiqueHorsReproduction` sur fenêtre E (via événements
  économiques existants / `resultatApresContrat`, nom canonique H4).

**Interdit :** stocker `fitnessScore`, rang, ou score synthétique.

---

## 11. Compatibilité

| Exigence | Règle |
|----------|-------|
| Version protocole | nouvelle (`protocole-experience-evolution-v03`) |
| v0.1 / v0.2 | comportements **inchangés**, tests conservés |
| Artefacts gelés | **aucune modification** |
| Tag `esp-evolution-evaluation-v02-freeze` | intact |
| Seeds évaluation v0.1 / v0.2 | ne pas relancer |

Activation v0.3 : opt-in via version de politique / protocole, pas de bascule
silencieuse des expériences historiques.

### Contradiction architecturale assumée (non régressive)

La fonction unique `evaluerAutorisationReproduction` v0.1/v0.2 mélange
cooldown et autorisation économique unitaire. En v0.3, ce mélange est
**incompatible** avec des naissances successives dans une même fenêtre.
La séparation contrat « fenêtre » / « naissance » (§2.6) est donc une
**évolution de protocole versionnée**, pas une modification silencieuse
du comportement v0.2.

---

## 12. Plan de PR v0.3

Séquence adaptée à l'architecture réelle (`@esp/protocole` → contrôleur →
campagne → diagnostics → freeze) :

| PR | Contenu | Hors périmètre |
|----|---------|----------------|
| **v03-0** | Conception documentaire | code métier |
| **v03-A** | Contrat protocole : fenêtre vs naissance, capacité théorique, types/plan enrichis, tests unitaires purs — primitives dans `reproduction-economique-v03.ts` | contrôleur |
| **v03-B** | Intégration `executerPhaseReproductionAutonome` : tentatives successives, atomicité, reprise | campagne |
| **v03-C** | Observabilité : charges, motifs d'arrêt, `resultatEconomiqueHorsReproduction`, projections sans score | évaluation |
| **v03-D** | Package campagne : `protocole-experience-evolution-v03`, matrice A/B/C/D, empreintes, contrôle B≡C | exécution seeds eval |
| **v03-E** | Diagnostic d'exposition + contrôle positif mécaniste | calibration |
| **v03-F** | Calibration (fenêtre opératoire, journal, STOP) + fixation procédure `E` | évaluation |
| **v03-G** | Pré-enregistrement + freeze evaluation v0.3 (dont seuil garde-fous, `E`, `R=5`) | lancement eval |
| **v03-H** | Évaluation officielle uniquement après freeze auditée | — |

Chaque PR conserve les tests v0.1/v0.2 verts. Aucune PR ne doit optimiser H4.

---

## 13. Décisions de conception tranchées

Les questions anciennement ouvertes sont **closes** comme suit.

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Cooldown | Contrôle l'**ouverture de fenêtre reproductive** inter-cycles ; **ne bloque pas** les tentatives successives du même plan. Réutiliser naïvement la règle v0.2 après la 1ʳᵉ naissance détruirait le couplage. |
| 2 | Capacité | `coutNaissance = dotation + coût` ; `surplus = max(0, VEN_canonique − réserve)` ; `capaciteTheorique = floor(surplus / cout)`. Observable / borne de plan ; jamais score ni classement. Autorité finale = autorisation successive. Pas de double-soustraction des obligations. |
| 3 | `nombreMaxEnfantsParAgent` | Garde-fou uniquement ; calibration assez haute pour que l'économie soit le frein normal. Motifs d'arrêt distingués. |
| 4 | Garde-fous globaux | Sécurités, pas pression de sélection. Critère candidat : < 5 % des opportunités théoriquement finançables ; seuil exact pré-enregistré avant évaluation. |
| 5 | Métrique éco H4 | Primaire : `resultatEconomiqueHorsReproduction` (= conceptuellement `resultatApresContrat` sur E). VEN secondaire. Pas de VEN final (circularité). |
| 6 | Métrique repro H4 | Primaire : **enfants directs**. Secondaires : descendants cumulés, génération max de branche, représentation. |
| 7 | Fenêtre `E` | Non fixée ici. Procédure : plus petite fenêtre entière permettant ≥ 1 opportunité reproductive financée complète pour un agent de référence sans mutation (B/C calibration). Figée après calibration / avant évaluation. Paires < E → `exposition_insuffisante` pour H4 primaire. |
| 8 | Réplication | `R = 5`. Moins de 5 seeds éligibles → `preuves_insuffisantes_pour_replication`. Synthèse booléenne stricte (§6), sans score. |
| 9 | Contrôle positif | Diagnostic v0.3 uniquement ; clones à ressources différentes ; hors A/B/C/D et hors évaluation. |
| 10 | Atomicité | Option B confirmée : plan déterministe figé + autorisations successives + idempotence par `identifiantReproduction`. |
| 11 | Statut H4 | Cherche des variants à chaîne causale complète répliquée ; **pas** `D > C` global. |
| 12 | Anti-fitness | Ordre inter-parents indépendant de VEN / résultat / fitness / descendants / génotype / fréquences. Seule question locale : financement immédiat de **cette** naissance. |
