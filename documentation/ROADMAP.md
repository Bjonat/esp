# Feuille de route expérimentale ESP

Document de navigation entre campagnes. Il ne remplace ni les protocoles
figés, ni les pré-enregistrements, ni les documents de résultats.

---

## État courant

| Campagne | Statut |
|----------|--------|
| `evolution-evaluation-v01` | clôturée — défaut causal génotype → phénotype (voir `POSTMORTEM_EVOLUTION_V01.md`) |
| `evolution-evaluation-v02` | **clôturée scientifiquement** — voir `RESULTATS_EVOLUTION_V02.md` |
| `protocole-experience-evolution-v03` | **prochaine étape** — conception uniquement |

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

### Prochaine étape — conception uniquement

Concevoir `protocole-experience-evolution-v03` pour tester explicitement :

```text
avantage économique → capacité reproductive
```

sans :

- score global de fitness ;
- classement des agents ;
- sélection explicite du « meilleur » agent ;
- préférence codée pour un gène ;
- récompense directe d'un génotype.

La sélection doit continuer à émerger du coût économique réel de la
reproduction.

### Interdits de transition

- Ne pas modifier les artefacts ou protocoles gelés v0.1 / v0.2.
- Ne pas modifier le tag `esp-evolution-evaluation-v02-freeze`.
- Ne pas relancer les seeds d'évaluation v0.2 (`2001..2020`).
- Ne pas traiter les signaux exploratoires v0.2 comme hypothèses
  pré-enregistrées v0.3 tant qu'un nouveau pré-enregistrement n'est pas figé.

### Documents de référence

| Document | Rôle |
|----------|------|
| `documentation/RESULTATS_EVOLUTION_V02.md` | clôture scientifique v0.2 |
| `documentation/PREENREGISTREMENT_EVOLUTION_V02.md` | hypothèses pré-enregistrées v0.2 |
| `documentation/POSTMORTEM_EVOLUTION_V01.md` | défaut causal v0.1 |
| `documentation/COUPLAGE_GENOTYPE_PHENOTYPE_V02.md` | socle causal v0.2 |
