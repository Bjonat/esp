# Reproduction économique ESP v0.3 — primitives pures (v03-A)

Contrat versionné `reproduction-economique-v03` dans
`@esp/protocole` (`reproduction-economique-v03.ts`).

Cette couche **ne remplace pas** la reproduction mécanique v0.1 ni la
politique autonome v0.1/v0.2. Elle n'orchestre pas encore le contrôleur.

## Rôle

Fonctions pures pour :

1. ouvrir une **fenêtre reproductive** (préfiltre structurel / inter-cycles) ;
2. calculer le **coût** d'une naissance ;
3. calculer le **surplus** reproductif ;
4. calculer la **capacité théorique** (descriptive, `bigint`) ;
5. autoriser **économiquement** une naissance unitaire (autorité courante).

## Formules

```text
coutNaissance = dotationEnfant + coutReproduction
surplus = max(0, VEN_canonique − reserveMinimaleParent)
capaciteTheorique = floor(surplus / coutNaissance)   # bigint exact
```

`VEN_canonique = capitalLiquide − obligationsDues` — pas de double soustraction.

Une VEN négative est un état valide : `surplus = 0`. Une réserve négative
reste invalide.

`capaciteTheorique` : `bigint` exact (aucun plafond artificiel) — observable /
borne de planification — **jamais** score ni clé de classement inter-parents.
Conversion éventuelle vers `number` borné : uniquement en planification v03-B.

## Préfiltre fenêtre vs autorité unitaire

| Contrat | Rôle | Cooldown | Effet |
|---------|------|----------|-------|
| `evaluerOuvertureFenetreReproductiveV03` | **préfiltre snapshot** | oui (inter-cycles) | possibilité structurelle d'ouvrir |
| `evaluerAutorisationNaissanceEconomiqueV03` | **autorité courante** | non | financement de **cette** naissance |

Le préfiltre de fenêtre **ne réserve** :

- aucune place de population ;
- aucun quota de cycle ;
- aucune naissance ;
- aucune ressource économique.

Les motifs `nombre_enfants_max` / `population_maximale` /
`reproductions_cycle_max` peuvent apparaître des deux côtés :

- à l'ouverture : observation snapshot « une possibilité existe-t-elle ? » ;
- à chaque naissance : réévaluation avec l'état réellement mis à jour.

Chaîne :

```text
fenêtre ouverte
  → tentative 1 autorisée
  → naissance
  → état mis à jour
  → tentative 2 réévaluée
```

Une fenêtre ouverte **ne garantit jamais** que toutes les tentatives prévues
seront autorisées.

Voir `documentation/CONCEPTION_EVOLUTION_V03.md` §2.6.

## Hors périmètre v03-A

- orchestration contrôleur / naissances multiples réelles ;
- modification de `planifierReproductionsAutonomes` ;
- campagne / protocole expérimental v0.3 ;
- dashboard.
