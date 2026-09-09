# Résultats — évaluation évolution ESP v0.2

Document de **clôture scientifique** de la campagne officielle
`evolution-evaluation-v02`.

Ce texte **rapporte** les observations obtenues sous le protocole pré-enregistré.
Il ne réécrit pas les hypothèses, ne transforme pas les analyses post-hoc en
tests primaires, et ne déclare aucune preuve générale d'évolution ou
d'adaptation hors de l'environnement simulé ESP v0.2.

Artefacts de référence (gelés, non modifiés par ce document) :

- Protocole : `experiences/protocoles/evolution-evaluation-v02.json`
- Freeze : `experiences/protocoles/freeze-evolution-evaluation-v02.json`
- Pré-enregistrement : `documentation/PREENREGISTREMENT_EVOLUTION_V02.md`
- Calibration : `documentation/CALIBRATION_EVOLUTION_V02.md`
- Couplage génotype → phénotype : `documentation/COUPLAGE_GENOTYPE_PHENOTYPE_V02.md`
- Post-mortem v0.1 : `documentation/POSTMORTEM_EVOLUTION_V01.md`

---

## 1. Identité canonique de l'expérience

| Champ | Valeur |
|-------|--------|
| Identifiant | `evolution-evaluation-v02` |
| Version protocole | `protocole-experience-evolution-v02` |
| Commit canonique | `bbcc74f69870573782ca751f53fe5811790da52f` |
| Tag | `esp-evolution-evaluation-v02-freeze` |
| Empreinte protocole | `sha256:a141e3893895c5cecc6454b9c5cd92bc85d48a7d0a8bb0e8df7661cb6cad9187` |
| Seeds | `2001..2020` |
| Conditions | A / B / C / D |
| Runs prévus | 80 |
| Runs terminés | 80 |
| Runs échoués | 0 |
| Runs incomplets | 0 |
| Working tree au lancement | propre |
| Marqueurs | aucun |

### Contrôle négatif B/C

```text
20/20 paires scientifiquement identiques
```

Campagne techniquement valide au regard du contrôle négatif bloquant
pré-enregistré. Les comparaisons D−C ci-dessous sont donc interprétables
sur le plan instrumental.

### Séparation des natures d'énoncé

| Nature | Contenu de ce document |
|--------|------------------------|
| **Résultats pré-enregistrés** | H1–H4, comparaisons B−A et D−C primaires, fréquences génotypiques agrégées, couverture phénotypique |
| **Analyses post-hoc** | paires contrefactuelles enfants mutants D vs homologues C ; signaux par mutation |
| **Interprétations** | formulation de ce que les résultats soutiennent ou non |
| **Hypothèses v0.3** | diagnostic architectural de travail ; orientation du prochain protocole |

---

## 2. Synthèse des verdicts pré-enregistrés

| Hypothèse | Verdict |
|-----------|---------|
| **H1** — reproduction différentielle sous contrainte économique | **SOUTENUE** |
| **H2** — expression causale des mutations héritées | **SOUTENUE** |
| **H3** — dynamique des fréquences génotypiques | **SOUTENUE** |
| **H4** — adaptation économique par sélection positive | **NON SOUTENUE** |

H1 soutenue **n'est pas** une preuve d'adaptation.
H3 soutenue **n'est pas** un balayage sélectif ni une fixation rapide.
H4 reste **non soutenue**.

---

## 3. H1 — reproduction différentielle sous contrainte économique

**Statut :** résultat pré-enregistré.  
**Comparaison :** B − A (appariement par seed).  
**Verdict :** `SOUTENUE`

| Métrique | Médiane (B−A) | Signe (n=20) |
|----------|---------------|--------------|
| VEN final | +6 715 360 micro-USDC | 20 positives, 0 nulles, 0 négatives |
| résultat activité brut cumulé | +11 200 000 micro-USDC | 20/20 positif |
| population vivante finale | +18,5 | 20/20 positif |
| naissances cumulées | +18,5 | 20/20 positif |
| génération maximale | +3 | 20/20 positif |

### Interprétation bornée

Sous contrainte économique, la reproduction autonome produit bien une
descendance et une trajectoire économique différentielles par rapport au
contrôle sans reproduction (A).

**Interdit méthodologique conservé :** ce résultat ne doit pas être transformé
en preuve d'adaptation, de sélection positive, ni de fitness supérieure.

---

## 4. H2 — expression causale des mutations héritées

**Statut :** résultat pré-enregistré.  
**Comparaison :** D − C (appariement par seed).  
**Verdict :** `SOUTENUE`

| Métrique | Médiane (D−C) | Signe (n=20) |
|----------|---------------|--------------|
| mutations cumulées | +7 | 20/20 positif |
| configurations distinctes finales | +5 | 20/20 positif |

### Couverture phénotypique

Les quatre gènes sont sensibles dans les **20/20** seeds.

| Gène | Mutations effectives | Expressions cognitives | Expressions comportementales | Conséquences économiques immédiates |
|------|---------------------:|-----------------------:|-----------------------------:|-------------------------------------:|
| `seuilEnjeuPourInferenceMicroUsdc` | 32 | 130 | 18 | 18 |
| `partMaxVenParCycleBps` | 40 | 300 | — | — |
| `plafondCognitifMicroUsdc` | 40 | 36 | — | — |
| `comportementSansInference` | 38 | — | 179 | 179 |

### Interprétation bornée

Le défaut causal de v0.1 (mutations présentes mais non connectées au
phénotype décisionnel — voir `documentation/POSTMORTEM_EVOLUTION_V01.md`)
est **corrigé** en v0.2 : les paramètres héritables sont effectivement
connectés au phénotype décisionnel et économique.

La simple présence de mutations ne suffisait pas ; l'évidence retenue ici
inclut l'expression cognitive, comportementale et les conséquences
économiques immédiates observées.

---

## 5. H3 — dynamique des fréquences génotypiques

**Statut :** résultat pré-enregistré.  
**Périmètre :** 20 runs de la condition **D**.  
**Verdict :** `SOUTENUE`

Cette analyse **agrège l'ensemble des génotypes non fondateurs**
(mutants au sens large). Elle ne distingue pas un variant particulier.

| Observable | Résultat |
|------------|----------|
| mutants observés | 20/20 |
| mutants encore présents au cycle final | 20/20 |
| part mutante ≥ 25 % au moins une fois | 18/20 |
| part mutante ≥ 50 % au moins une fois | 3/20 |
| part mutante finale ≥ 25 % | 17/20 |
| part mutante finale ≥ 50 % | 3/20 |
| disparition complète du génotype fondateur | 0/20 |

### Interprétation bornée

L'observation correspond davantage à une **diversification héréditaire
persistante** qu'à une fixation rapide d'un variant.

**Ne pas appeler cela un balayage sélectif.**  
Une hausse ou une persistance de fréquences agrégées n'est pas, à elle seule,
une preuve d'adaptation (règle déjà pré-enregistrée).

---

## 6. H4 — adaptation économique par sélection positive

**Statut :** résultat pré-enregistré (test primaire).  
**Comparaison primaire :** traitement agrégé D − C.  
**Verdict :** `NON SOUTENUE`

### 6.1 Test primaire pré-enregistré (D−C)

| Métrique | Observation |
|----------|-------------|
| VEN final médian (D−C) | −351 451 micro-USDC |
| D > C (VEN) | 6/20 |
| D < C (VEN) | 14/20 |
| résultat brut médian (D−C) | −400 000 micro-USDC |
| naissances (médiane D−C) | 0 |
| D supérieur à C (naissances) | 0/20 |
| D identique à C (naissances) | 16/20 |
| D inférieur à C (naissances) | 4/20 |

Le traitement agrégé D−C ne montre **pas** de traduction positive et
réplicable de la variation mutante en avantage économique et reproductif
conjoint au sens de H4.

**H4 n'est pas déclarée soutenue.**

### 6.2 Analyse post-hoc contrefactuelle (non primaire)

**Qualification obligatoire :** analyse **post-hoc**.  
Elle n'est **pas** le test primaire pré-enregistré. Elle ne peut pas
reclasser H4 en « soutenue ».

Paires retenues lorsque, pour un même seed :

- même identifiant enfant ;
- même parent ;
- même cycle de naissance ;
- même génération ;
- génotype du parent encore identique entre C et D avant la mutation ;
- enfant C héritant du génotype parental non muté.

```text
100 paires propres retenues
```

#### Résultat économique (enfant mutant D − homologue C)

| Signe | n |
|-------|---|
| positif | 20 |
| nul | 43 |
| négatif | 37 |
| **médiane** | **0 micro-USDC** |

#### Résultat reproductif (descendants)

| Signe | n |
|-------|---|
| D supérieur | 0 |
| identiques | 96 |
| D inférieur | 4 |
| **médiane** | **0** |

#### Convergence économique **et** reproductive

Nombre de paires présentant simultanément :

```text
avantage économique > 0  ET  avantage de descendance > 0
= 0 / 100
```

Aucun cas observé où un avantage économique positif s'accompagne d'un
avantage de descendance positif dans ces paires contrefactuelles propres.

---

## 7. Signaux exploratoires utiles pour v0.3

**Statut :** observations **exploratoires** post-hoc.  
**Ne constituent pas** des preuves confirmatoires.  
**Ne modifient pas** les verdicts H1–H4.

Issues des paires contrefactuelles propres (sous-échantillon par mutation).

### Signal favorable exploratoire

`seuilEnjeuPourInferenceMicroUsdc: 100000 → 150000`

| Champ | Valeur |
|-------|--------|
| n | 9 |
| seeds | 9 |
| économie | 8 positives, 1 nulle, 0 négative |
| médiane économique | ≈ +1 562 micro-USDC |
| descendance | 9 nulles |

### Signal favorable exploratoire (combinaison)

`plafondCognitifMicroUsdc: 10000 → 5000`  
**et** `seuilEnjeuPourInferenceMicroUsdc: 100000 → 150000`

| Champ | Valeur |
|-------|--------|
| n | 3 |
| économie | 3/3 positive |
| médiane économique | +4 938 micro-USDC |
| descendance | aucune différence |

### Signal défavorable exploratoire

`comportementSansInference: agir_si_favorable → attendre`

| Champ | Valeur |
|-------|--------|
| n | 22 |
| économie | 5 positives, 2 nulles, 15 négatives |
| médiane économique | −45 937 micro-USDC |
| descendants | 0 positifs, 20 nuls, 2 négatifs |

### Signal défavorable exploratoire

`seuilEnjeuPourInferenceMicroUsdc: 100000 → 50000`

| Champ | Valeur |
|-------|--------|
| n | 6 |
| économie | 6/6 négative |
| médiane économique | −6 135 micro-USDC |
| reproduction | aucune amélioration |

Ces signaux peuvent **orienter** la conception de
`protocole-experience-evolution-v03`. Ils ne valident aucune hypothèse
d'adaptation en v0.2.

---

## 8. Conclusion canonique

ESP v0.2 démontre qu'une population d'agents soumise à des contraintes
économiques peut connaître une reproduction multi-générationnelle, hériter
de paramètres comportementaux, générer des mutations causalement exprimées,
produire des différences économiques et maintenir une diversification
génotypique sur plusieurs générations. L'évaluation ne montre cependant
aucune traduction positive de l'avantage économique en avantage reproductif
parmi les comparaisons contrefactuelles observées. L'adaptation économique
par sélection positive n'est donc pas démontrée en v0.2.

### Limites explicites

- Environnement : simulation ESP v0.2 (`decision_simulee`), sans OpenAI réel,
  sans réseau, sans Solana Live.
- H1 ≠ adaptation.
- H3 ≠ balayage sélectif.
- H4 non soutenue ; résultats négatifs conservés.
- Les analyses post-hoc (paires contrefactuelles, signaux par gène) ne
  remplacent pas le test primaire D−C.

---

## 9. Diagnostic architectural — hypothèse de travail pour v0.3

**Statut :** hypothèse de travail. **Non démontrée** par l'évaluation v0.2.

Le mécanisme reproductif v0.2 semble transformer principalement les
ressources économiques en une **éligibilité reproductive discrète**. Une
fois l'éligibilité atteinte, de petites différences de performance
économique peuvent ne produire aucune différence de descendance.

Cette lecture est cohérente avec :

- naissances D−C médiane 0 et largement identiques ;
- 0/100 paires contrefactuelles avec avantage économique **et**
  avantage de descendance simultanés.

### Exigence pour le prochain protocole

Le prochain protocole (`protocole-experience-evolution-v03`) **devra**
tester explicitement le couplage :

```text
avantage économique → capacité reproductive
```

**sans introduire :**

- score global de fitness ;
- classement des agents ;
- sélection explicite du « meilleur » agent ;
- préférence codée pour un gène ;
- récompense directe d'un génotype.

La sélection **doit** continuer à émerger du coût économique réel de la
reproduction.

Voir `documentation/ROADMAP.md` pour la transition documentaire
v0.2 → v0.3.

---

## 10. Inventaire de clôture

| Élément | État |
|---------|------|
| Évaluation officielle v0.2 | **clôturée** (80/80) |
| Contrôle B/C | 20/20 OK |
| H1 / H2 / H3 | soutenues (bornées) |
| H4 | **non soutenue** |
| Artefacts protocole / freeze / tag | **inchangés** par ce document |
| Relance seeds 2001..2020 | **interdite** pour cette clôture |
| Mécanismes v0.3 | **non développés** ici |
| Prochaine étape documentaire | conception de `protocole-experience-evolution-v03` |
