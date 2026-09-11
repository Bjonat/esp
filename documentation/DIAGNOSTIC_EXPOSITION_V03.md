# Diagnostic d'exposition évolution ESP v0.3 (v03-E)

Étape **diagnostic uniquement**. Aucun freeze. Aucune calibration.
Aucune sélection fondée sur la performance D−C.

Références :

- Conception : `documentation/CONCEPTION_EVOLUTION_V03.md` §7
- Protocole campagne : `documentation/PROTOCOLE_EVOLUTION_V03.md`
- Observabilité : `documentation/OBSERVABILITE_EVOLUTION_V03.md`
- Exposition v0.2 E2 : `documentation/ENVIRONNEMENT_EXPOSITION_V02_E2.md`

---

## Questions autorisées

1. L'environnement expose-t-il réellement les quatre gènes héritables
   au chemin décisionnel et économique ?
2. Une différence économique réelle peut-elle mécaniquement produire
   une différence de capacité reproductive (`reproduction-economique-v03`) ?

## Interdits

- « D est-il meilleur que C ? »
- classement de mutations / génotypes ;
- optimisation d'environnement via VEN(D), D−C, descendants, fréquences.

---

## Seeds diagnostiques

```text
401, 402, 403, 404, 405
```

- Plage conception diagnostic v0.3 : 401–410
- Disjointes de v0.1/v0.2 et des plages calibration (501–510) /
  évaluation (3001–3020)
- Consommées par le diagnostic → interdites ensuite en calibration /
  évaluation officielle

---

## Provenance de E0

```text
origine: exposition héritée du diagnostic mécaniste v0.2
```

La grille d'enjeux E0 :

```text
50_000, 75_000, 125_000, 175_000, 250_000
```

est **identique** à `ENJEUX_ENVIRONNEMENT_EXPOSITION_V02_E2`
(`documentation/ENVIRONNEMENT_EXPOSITION_V02_E2.md`,
`documentation/DIAGNOSTIC_EXPOSITION_PHENOTYPIQUE_V02.md`).

Ce n'est **pas** une exposition découverte indépendamment en v0.3.

Précisions :

- elle avait été identifiée en v0.2 pour exposer les frontières
  phénotypiques (seuils cognitifs) ;
- aucun résultat D−C positif n'a été utilisé pour la sélectionner en v0.3 ;
- aucune direction de mutation favorable observée en v0.2 n'a été utilisée ;
- v0.3 lui applique ses propres critères diagnostiques indépendants (A–E).

E1/E2 restent prédéfinis mais **non exécutés** après succès de E0
(`non_executes_apres_succes_e0`).

---

## Règle de voisin contrefactuel (AVANT exécution)

```text
premier voisin valide de voisinsUnPasGene(cle, valeurFondatrice)
```

Ordre canonique du domaine :

- micro_usdc / bps : `moins` puis `plus` (si dans les bornes) ;
- catégoriel : ordre `valeursAutorisees` du catalogue, filtrées ≠ courant.

Fondateur (référence neutre historique) :

| Gène | Valeur | Premier voisin |
|------|--------|----------------|
| `seuilEnjeuPourInferenceMicroUsdc` | 100000 | 50000 |
| `partMaxVenParCycleBps` | 50 | 25 |
| `plafondCognitifMicroUsdc` | 10000 | 5000 |
| `comportementSansInference` | agir_si_favorable | attendre |

---

## Définition de sensibilité

Un contexte est **sensible** si modifier **un seul** gène produit une
différence causale **après** le génotype :

| Niveau | Critère |
|--------|---------|
| 1 — politique | politique résolue différente |
| 2 — cognition/décision | choix sec divergent (inférence, limite, action, motif) |
| 3 — économique | conséquence d'action différente |

Différence de configuration seule, sans effet aval → **non sensible**.

Le rapport conserve séparément, pour chaque gène :

```text
expositionPolitique
expositionCognitiveOuDecisionnelle
expositionEconomiqueObservee
```

### Silence économique des gènes numériques (observation E0)

Sous E0, les trois gènes numériques ont
`expositionEconomiqueObservee = false` malgré 200 contextes sensibles.

Cause exacte (motif principal **D**, secondaire **A**) :

1. `differenceEconomique` n'est positionné que si les deux actions dry-run
   sont non-nulles **et** divergent, puis si le replay d'activité diverge ;
2. sur la voie inférence, `evaluerChoixSec` renvoie `action = null`
   (pas d'exécution Xway) → le CF s'arrête avant l'étape économique qui
   pourrait diverger (**D**) ;
3. les gènes numériques divergent surtout via `utiliserInference` ou
   `limiteDepenseAutorisee` sans action résolue — différence
   d'autorisation/budget non comptabilisée en coût dans ce dry-run (**A**).

`comportementSansInference` produit des actions sans-inférence non-nulles
→ décision et économie observables.

```text
E0 satisfait les critères d'exposition pré-enregistrés, mais aucune
divergence économique n'a été observée pour les trois gènes numériques
dans ce diagnostic.
```

→ **point à surveiller en calibration v03-F**, pas un rejet post-hoc de E0.
Critères A–E **non modifiés** après observation.

---

## Critères d'exposition suffisante (AVANT exécution)

| Critère | Règle |
|---------|-------|
| **A** | Les 4 gènes ont ≥ 1 contexte sensible |
| **B** | 5/5 seeds sensibles par gène |
| **C** | ≥ 10 contextes sensibles agrégés par gène |
| **D** | Au moins un effet cognition **ou** décision par gène |
| **E** | Effet économique immédiat **rapporté**, non bloquant |

Cycles diagnostiques par seed : **20**.

États économiques contrefactuels (prédéfinis, hors génotype) :

| Libellé | VEN | Rôle |
|---------|-----|------|
| `ven_haute` | 8 000 000 | plafond cognitif souvent liant |
| `ven_basse` | 1 000 000 | `partMaxVen` souvent liante |

Ces états exposent les frontières cognitives ; ils ne sont **pas** choisis
selon D−C.

---

## Candidats (définis avant observation)

| Id | Enjeux (micro-USDC) | Statut après diagnostic |
|----|---------------------|-------------------------|
| **E0** | 50k, 75k, 125k, 175k, 250k (héritage v0.2 E2) | **retenu** |
| **E1** | 25k, 50k, 75k, 100k, 125k, 200k, 300k | `non_executes_apres_succes_e0` |
| **E2** | 10k, 40k, 60k, 90k, 110k, 150k, 250k, 400k | `non_executes_apres_succes_e0` |

Inchangés entre candidats : génotype fondateur, taux mutation, coûts
reproduction, réserve, dotation, population max.

---

## Règle d'arrêt

```text
exécuter E0 → si OK : retenir E0, STOP
sinon E1 → si OK : retenir E1, STOP
sinon E2 → si OK : retenir E2, STOP
sinon : diagnostic_exposition_non_satisfaisant
```

Pas d'E3 improvisé. Pas de recherche du « meilleur » environnement.
**Interdit** de lancer E1/E2 après succès de E0.

---

## Contrôle positif mécaniste

Indépendant des gènes / A/B/C/D / E0–E2 :

### Formule (v03-A)

```text
VEN − réserve = 0.9 × coutNaissance → capacité 0
VEN − réserve = 1.1 × coutNaissance → capacité 1
VEN − réserve = 1.9 × coutNaissance → capacité 1
VEN − réserve = 2.1 × coutNaissance → capacité 2
```

via `calculerCapaciteReproductiveTheoriqueV03`.

### Intégration contrôleur (v03-B) — non dupliquée

Preuve `ressources → capacité → naissances réelles` déjà dans :

- `applications/controleur/tests/reproduction-economique-v03.test.ts`
  - **B** — capacité 0 → aucune naissance
  - **C** — capacité 1 → une naissance
  - **D/E** — capacité 3 → trois naissances
  - **F** — frontière multi-naissances

---

## Garde-fous

Métriques v03-C observées / rapportées en **numérateur / dénominateur**
(unités : capacités théoriques entières).

Fixture descriptive v03-E :

```text
numerateur = 1
denominateur = 5
```

(`opportunitesBloqueesParGardeFous / capaciteEconomiqueTheoriqueEligible`).

`signalDominationGardeFous` :

```text
= diagnostic grossier de domination structurelle (≥ 50 % bloqué)
≠ critère futur de calibration
≠ « pression acceptable pour l'évaluation officielle »
```

Seuil officiel candidat `< 5 %` **non figé** ici.

```text
pression garde-fous à recalibrer / vérifier  →  v03-F
```

Ne pas modifier les garde-fous dans v03-E.

## Fenêtre H4 `E`

**Non fixée** dans v03-E. Cette étape choisit l'**environnement**
d'exposition, pas `nombreCyclesExpositionH4`.

---

## Statut scientifique du verdict

```text
EXPOSITION SUFFISANTE
```

signifie uniquement :

```text
EXPOSITION PHENOTYPIQUE/CAUSALE SUFFISANTE
selon critères A–D pré-enregistrés
```

Ce n'est **pas** :

- environnement optimal ;
- environnement économiquement optimal ;
- environnement validé pour H4 ;
- preuve d'adaptation.

La **calibration économique / reproductive** reste v03-F.
Artefact : `statutScientifique = non_freeze`.

---

## Artefact

`experiences/diagnostics/exposition-evolution-v03.json`

Contient notamment : E0 complet + provenance ; E1/E2
`non_executes_apres_succes_e0` ; seeds 401–405 ; critères A–E ;
niveaux par gène ; contrôle positif (formule + refs v03-B) ;
pression garde-fous num/den ; B≡C ; règle d'arrêt ; anti-D−C ;
non-freeze ; SHA-256.

Exécution :

```bash
pnpm diagnostic:exposition-v03
```
