# Protocole expérimental évolution ESP v0.3

Contrat et runner de campagne (`protocole-experience-evolution-v03`).
Cette PR (**v03-D**) produit le contrat expérimental et l'exécution — **aucun
verdict scientifique**, aucun freeze, aucune seed officielle.

Références :

- Conception : `documentation/CONCEPTION_EVOLUTION_V03.md`
- Mécanisme : `documentation/REPRODUCTION_ECONOMIQUE_V03.md`
- Observabilité : `documentation/OBSERVABILITE_EVOLUTION_V03.md`
- Clôture v0.2 : `documentation/RESULTATS_EVOLUTION_V02.md`

---

## Version

```text
protocole-experience-evolution-v03
```

Un protocole v0.1 / v0.2 **ne peut pas** activer les règles v0.3.
Parseur fail-closed : version inconnue, condition inconnue, paramètre invalide,
mécanisme reproduction incompatible, provider réel, mode non `decision_simulee`.

---

## Matrice A/B/C/D

| Condition | Reproduction autonome | Mécanisme | Mutation |
|-----------|----------------------|-----------|----------|
| **A** | inactive | (présent mais inactif) | inactive |
| **B** | active | `reproduction-economique-v03` | inactive |
| **C** | active | `reproduction-economique-v03` | active, taux = 0 (sham) |
| **D** | active | `reproduction-economique-v03` | active, taux = `tauxMutationConditionDBps` (> 0) |

Comparaison **primaire** (future) : `D − C`  
Comparaisons **secondaires** : `B − A`, `C − B`, `D − B`

---

## Différences structurelles autorisées

Les quatre conditions sont dérivées d'un **socle commun**.

| Paire | Différences autorisées |
|-------|------------------------|
| A ↔ B | Uniquement `reproductionAutonome.active` (activation économique) |
| B ↔ C | Uniquement le sham mutation : `inactive` vs `active + taux 0` |
| C ↔ D | Uniquement `tauxMutationParGeneBps` |

Toute autre divergence → préflight invalide.

---

## Chemin causal obligatoire

```text
decision_simulee
  + environnement décisionnel déterministe
  + politique cognitive issue du génotype héritable
  + provider simulé uniquement
  + reproduction-economique-v03 (B/C/D)
```

Interdits (échec preflight) : OpenAI réel, provider réseau, Solana, Live,
exécution non déterministe, mode `simulation`.

Anti-régression v0.1 : un gène héritable doit pouvoir alimenter la politique
consommée par `decision_simulee` (test structurel de branchement).

---

## Contrôle B ≡ C

Invariant bloquant **dans le runner** (pas seulement dans les tests) :

```text
empreinteResultatScientifique(B, seed X)
  ≡ empreinteResultatScientifique(C, seed X)
```

Échec → `CAMPAGNE_INVALIDE.json` + throw `ControlegeNegatifBcEchoueErreur`.

Les différences purement déclaratives du sham (`mutation.active`) n'entrent
pas dans l'empreinte scientifique.

---

## Même seed = même monde

Pour chaque seed expérimentale, A/B/C/D partagent :

- graine environnementale (`graineSimulation = seed`) ;
- opportunités / contextes économiques exogènes ;
- configuration fondatrice (hors traitement) ;
- politique cognitive fondatrice ;
- limites expérimentales communes.

La condition **ne contamine pas** la génération des opportunités exogènes.

Domaine RNG documenté dans `environnementExposition.domaineRng`.

---

## Séparation des seeds

Usages distincts et **étanches** :

| Mode | Seeds utilisées |
|------|-----------------|
| `diagnostic` | uniquement `seedsDiagnostic` |
| `calibration` | uniquement `seedsCalibration` |
| `evaluation` | uniquement `seedsEvaluation` |

- Les trois listes **doivent être disjointes** (fail-closed).
- **Pas de `seedsExplicites`** — interdit en v0.3 (empêche de contourner
  la liste canonique du mode, notamment pour une future évaluation gelée).
- Aucun argument CLI ne peut substituer les seeds.
- Pas de réutilisation automatique des seeds v0.1 / v0.2.
- **Aucune valeur officielle figée** dans v03-D.

## Contrôle B ≡ C (bloquant runner)

Pour chaque seed, après exécution complète :

```text
empreinteScientifique(B, seed) === empreinteScientifique(C, seed)
```

Si divergence :

1. marqueur `CONTROLE_NEGATIF_ECHOUE` ;
2. fichier `CAMPAGNE_INVALIDE.json` ;
3. artefacts diagnostiques conservés ;
4. **throw** `ControlegeNegatifBcEchoueErreur` (processus en échec) ;
5. aucun verdict / agrégat scientifique valide.

Le sham déclaratif `mutation.active` (B inactive vs C active taux 0) est
exclu de l'empreinte scientifique uniquement parce qu'il est causalement
neutre.

## Ordre des conditions

L'ensemble exact `{A,B,C,D}` est exigé (une fois chacune).
L'ordre d'entrée JSON est **normalisé** vers l'ordre canonique
`[A, B, C, D]` — l'ordre d'exécution des cellules n'influence pas les
résultats (runs isolés, RNG par domaines).

## Domaines RNG (même seed = même monde)

| Domaine | Entrées | Indépendant de |
|---------|---------|----------------|
| Observation / opportunité | `graineSimulation`, `identifiantAgent`, `numeroCycle`, sels fixes | condition, mutation, reproduction, population |
| Mutation | hash par (reproduction, gène, domaine) | opportunité |
| Priorité reproduction | hash neutre (version, graine, cycle, agent) | VEN, génotype |

Aucun PRNG séquentiel global : une mutation ou naissance ne décale pas
l'environnement futur.

## Empreinte protocole vs scientifique

| Empreinte | Inclut | Exclut |
|-----------|--------|--------|
| Protocole | mode, seeds, env, éco, repro, mutation, cycles, fondateur, règles | chemin, date, concurrence |
| Scientifique | trajectoire causale, obs. reproductive, hors-repro | chemin, date, concurrence, labels, sham déclaratif B/C |

## Clés d'appariement H4

Module `cles-appariement-h4-v03.ts` : extraction / structuration uniquement.
Artefact run : `cles-appariement-h4.json`.
Pas de ranking, score, gagnant, ni conclusion D/C.

## Signaux exploratoires v0.2

Les observations post-hoc v0.2 (ex. `seuilEnjeu 100000→150000`) **ne
servent pas** à optimiser v0.3. La configuration fondatrice peut reprendre
une référence neutre historique pour continuité.

---

## Paramètres configurables (non figés)

Le contrat accepte sans sélectionner de valeurs finales :

- cycles, population maximale ;
- max reproductions/cycle, max enfants/agent, max naissances politique/cycle ;
- cooldown, dotation enfant, coût reproduction, réserve minimale parent ;
- taux mutation D ;
- environnement d'exposition ;
- seeds.

Pas d'optimiseur. Pas de recherche automatique.

---

## Environnement d'exposition

Figé dans l'artefact :

- `identifiant` / `version` ;
- paramètres déterministes (`environnementDecision`) ;
- enjeux si pertinents ;
- graine (via seed expérimentale).

---

## Preflight bloquant

Avant tout run : version v03, mode `decision_simulee`, provider simulé,
mécanisme B/C/D = `reproduction-economique-v03`, matrice A/B/C/D correcte,
même environnement A/B/C/D, différences structurelles autorisées seulement,
aucun réseau réel. Échec **avant** résultat partiel.

---

## Empreintes

| Empreinte | Format | Rôle |
|-----------|--------|------|
| Protocole / campagne | SHA-256 canonique (`empreinte-protocole-sha256-v01`) | intégrité paramètres |
| Exécution | SHA-256 | peut différer B vs C (sham) |
| Résultat scientifique v03 | SHA-256 (`…-v03`) | B ≡ C ; trajectoire + obs. reproductive |

Stable hors ordre JSON, chemin filesystem, date système.

---

## Métriques consommées (v03-C)

Le runner **importe** les projections protocole :

- `calculerResultatEconomiqueHorsReproductionV03`
- `projeterObservabiliteReproductionEconomiqueV03`

Agrégats exposés (sans recalcul divergent) :

```text
capaciteEconomiqueTheoriqueEligible
capaciteBloqueeParPlafondParent
capaciteBloqueeParPlafondsGlobaux
opportunitesBloqueesParGardeFous
tentativesPlanifiees
naissancesRealisees
placesGlobalesNonUtilisees
placesNonDemandeesParLePlan
tentativesPlanifieesNonRealisees
```

Pression garde-fous = numérateur / dénominateur exacts (pas de float, critère
`< 5 %` **non figé**).

---

## Hypothèses H1–H4 (déclarations)

Documentées dans le protocole. **Aucun verdict automatique.**

`D > C global` n'est **ni nécessaire ni suffisant** pour H4.
Les données individuelles C/D sont conservées pour matching futur
(`matching-h4.json` : seed, agent, parent, cycles, génotypes, mutations,
enfants, descendants).

Fenêtre d'exposition `E` : **non fixée** ; fenêtres arbitraires calculables
depuis les événements.

---

## CLI

```bash
pnpm experience:evolution -- --protocole experiences/protocoles/evolution-campagne-v03.exemple.json
```

Compatible v0.1 / v0.2 inchangés.

---

## Étapes suivantes

| PR | Contenu |
|----|---------|
| **v03-E** | Diagnostic d'exposition + contrôle positif mécaniste |
| **v03-F** | Calibration + fixation procédure `E` |
| **v03-G** | Pré-enregistrement + freeze (seuil garde-fous, `E`, seeds, `R=5`) |
| **v03-H** | Évaluation officielle |
