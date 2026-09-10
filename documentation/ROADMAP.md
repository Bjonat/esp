# Feuille de route expérimentale ESP

Document de navigation entre campagnes. Il ne remplace ni les protocoles
figés, ni les pré-enregistrements, ni les documents de résultats.

---

## État courant

| Campagne | Statut |
|----------|--------|
| `evolution-evaluation-v01` | clôturée — défaut causal génotype → phénotype (voir `POSTMORTEM_EVOLUTION_V01.md`) |
| `evolution-evaluation-v02` | **clôturée scientifiquement** — voir `RESULTATS_EVOLUTION_V02.md` |
| Conception `protocole-experience-evolution-v03` | **décisions tranchées** — voir `CONCEPTION_EVOLUTION_V03.md` §13 |
| Primitives pures `reproduction-economique-v03` (v03-A) | **fait** — voir `REPRODUCTION_ECONOMIQUE_V03.md` |
| Intégration contrôleur multi-naissances (v03-B) | **fait** — voie opt-in `reproduction-economique-v03` |
| Observabilité scientifique (v03-C) | **fait** — voir `OBSERVABILITE_EVOLUTION_V03.md` |
| Contrat + runner campagne A/B/C/D (v03-D) | **en cours sur branche** — voir `PROTOCOLE_EVOLUTION_V03.md` |
| Diagnostic / calibration / évaluation v0.3 | **non démarrée** (v03-E…) |

---

## Transition v0.2 → v0.3

### Acquis v0.2 (bornés)

- Reproduction multi-générationnelle sous contrainte économique (H1 soutenue).
- Mutations héritables causalement exprimées dans le phénotype décisionnel
  et économique (H2 soutenue) — correction du défaut v0.1.
- Diversification génotypique persistante sans disparition du fondateur
  (H3 soutenue ; pas un balayage sélectif).
- Adaptation économique par sélection positive **non démontrée** (H4 non
  soutenue).

### Diagnostic de limitation (conception)

La reproduction autonome v0.2 transforme surtout les ressources en
**éligibilité discrète** (seuil binaire + au plus une naissance retenue par
parent et par cycle + cooldown + plafonds). Des agents économiquement
différents peuvent donc obtenir la même descendance.

Détail et proposition mécanique : `documentation/CONCEPTION_EVOLUTION_V03.md`.

### Prochaine étape après conception

Implémentation hors de cette feuille de route documentaire, selon
`documentation/CONCEPTION_EVOLUTION_V03.md` (décisions tranchées §13) :

```text
performance économique
  → ressources disponibles
  → capacité à financer la reproduction
  → enfants directs
```

Choix de référence :

- Option B : autorisations successives + plan déterministe figé ;
- cooldown = accès à la **fenêtre reproductive**, pas frein intra-plan ;
- H4 = chaîne causale locale répliquée (`R = 5`), pas `D > C` global ;
- métrique éco H4 : `resultatEconomiqueHorsReproduction` ;
- contrôle positif mécaniste : diagnostic uniquement.

sans :

- score global de fitness ;
- classement des agents ;
- sélection explicite du « meilleur » agent ;
- préférence codée pour un gène ;
- récompense directe d'un génotype.

Séquence de PR prévue : v03-A … v03-H (voir conception §12).

### Interdits de transition

- Ne pas modifier les artefacts ou protocoles gelés v0.1 / v0.2.
- Ne pas modifier le tag `esp-evolution-evaluation-v02-freeze`.
- Ne pas relancer les seeds d'évaluation v0.1 / v0.2.
- Ne pas traiter les signaux exploratoires v0.2 comme hypothèses
  pré-enregistrées v0.3 tant qu'un nouveau pré-enregistrement n'est pas figé.
- Ne pas coder de mécanisme v0.3 dans une PR de conception pure.

### Documents de référence

| Document | Rôle |
|----------|------|
| `documentation/RESULTATS_EVOLUTION_V02.md` | clôture scientifique v0.2 |
| `documentation/CONCEPTION_EVOLUTION_V03.md` | conception du couplage économique → capacité reproductive |
| `documentation/REPRODUCTION_ECONOMIQUE_V03.md` | contrat v0.3 (primitives + planification + contrôleur) |
| `documentation/OBSERVABILITE_EVOLUTION_V03.md` | métriques v03-C (capacités, tentatives, hors reproduction) |
| `documentation/PROTOCOLE_EVOLUTION_V03.md` | contrat campagne A/B/C/D v0.3 (v03-D) |
| `documentation/PREENREGISTREMENT_EVOLUTION_V02.md` | hypothèses pré-enregistrées v0.2 |
| `documentation/POSTMORTEM_EVOLUTION_V01.md` | défaut causal v0.1 |
| `documentation/COUPLAGE_GENOTYPE_PHENOTYPE_V02.md` | socle causal v0.2 |
| `documentation/REPRODUCTION_AUTONOME.md` | politique autonome v0.1/v0.2 |
| `documentation/REPRODUCTION.md` | reproduction mécanique |
