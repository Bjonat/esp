# Héritage + mutation ESP v0.1

## Objectif

Introduire une **variation héritable** déterministe et bornée sur la
configuration comportementale des agents, sans sélection.

Chaîne visée :

```
PARENT
→ configuration héritable (génotype)
→ copie
→ mutation déterministe bornée
→ ENFANT potentiellement différent
→ politique cognitive (phénotype)
→ comportement / coûts / état économique potentiellement différents
```

Invariant méthodologique :

> **fitness ≠ mutation ≠ sélection**

La fitness descriptive reste purement observable. La mutation ne lit pas la
fitness. Aucun ranking, tournoi ni politique de sélection n'est activé.

## Génotype comportemental

`ConfigurationHeritableAgent` (`configuration-heritable-v01`) est le **génotype**
expérimental :

- version + `parametres` (string / number / boolean) ;
- distinct de l'identité cryptographique, de l'état économique, de la mémoire
  et des secrets ;
- stocké sur `AGENT_CREE` / `CONFIGURATION_HERITEE` ;
- reconstruit depuis le registre (SQLite ou mémoire).

Genesis matérialise le génotype depuis `politiqueBudgetCognitif` d'expérience
lorsqu'elle est présente. Une config vide (legacy) reste lisible : le phénotype
retombe alors sur la politique de base.

## Frontière d'héritabilité

| Hérité (copie ± mutation) | Jamais hérité |
|---------------------------|---------------|
| Gènes catalogue mutables | Clé privée / matériel crypto |
| Clés non mutables dans `parametres` | Capital / VEN / obligations |
| | HWM, historique, CoT |
| | Crédits Xway, mémoire épisodique |
| | Taux de mutation, règles protocole |

Le parent n'est **jamais** muté en place : copie puis éventuelle variation
enfant.

## Catalogue de gènes (`genes-mutables-v01`)

Uniquement des paramètres qui alimentent `PolitiqueBudgetCognitif` :

| Clé | Type | Rôle |
|-----|------|------|
| `seuilEnjeuPourInferenceMicroUsdc` | `micro_usdc` | Seuil d'enjeu pour payer une inférence |
| `partMaxVenParCycleBps` | `bps` | Part max VEN allouable au cognitif |
| `plafondCognitifMicroUsdc` | `micro_usdc` | Plafond absolu de dépense cognitive |
| `comportementSansInference` | catégoriel | `attendre` \| `agir_si_favorable` |

`modeleLogique` : **non mutable** en v0.1 (reste celui de la politique de base).

Les bornes / pas / défauts du catalogue sont des **valeurs de démonstration**,
non canoniques.

## Mutation déterministe

Opérateur : `appliquerMutationConfigurationHeritable`.

Pipeline :

1. copie exacte du parent ;
2. si `mutation.active = false` → stop (copie identique) ;
3. pour chaque gène du catalogue **trié par clé** :
   - tirage `declenchement` (bps) vs `tauxMutationParGeneBps` ;
   - si déclenché : tirage `direction` → incrément / décrément / remplacement
     catégoriel borné ;
4. clés hors catalogue copiées à l'identique.

Tirages : FNV-1a 64 bits sur domaines explicites
`(versionMutation, graine, identifiantReproduction, parent, enfant, cleGene, domaine)`.
Aucun PRNG séquentiel global : un nouveau gène ne décale pas les anciens.

Même `(graine, reproduction, parent, enfant, paramètres mutation)` → mêmes
mutations. L'ordre des clés JSON du parent n'affecte pas les tirages mutables.

## Bornes

- Numérique : un seul pas (`pasMutation` / `pasMutationMicroUsdc`) ;
  si une seule direction est faisable (min/max), elle est forcée ;
  si aucune (min = max), pas de mutation effective.
- Catégoriel : uniquement la whitelist `valeursAutorisees`.
- `micro_usdc` sérialisé en **string décimale** (bigint exact).

## Taux

`tauxMutationParGeneBps` ∈ `[0, 10000]` :

- `0` → aucune tentative ;
- `10000` → chaque gène tente une mutation (effective si variation possible) ;
- paramètre d'**expérience** (figé dans `EXPERIENCE_CREEE`), non héritable :
  un agent ne fait pas évoluer son propre taux.

Parser : `parserParametresMutation` refuse taux hors plage ou gènes invalides.

## Génotype → phénotype

`resoudrePolitiqueDepuisConfigurationHeritable` :

```
politiqueBase ⊕ configurationHeritable.agent → PolitiqueBudgetCognitif effective
```

Le contrôleur résout cette politique **par agent** avant la boucle décisionnelle.
Conséquence observable : un enfant au seuil plus bas peut déclencher une
inférence (Xway simulé) là où le parent, au seuil haut, reste sans compute.

## Événements

Corrélés par `identifiantReproduction` :

| Type | Rôle |
|------|------|
| `CONFIGURATION_HERITEE` | Génotype final enfant + empreinte |
| `MUTATION_APPLIQUEE` | Une entrée par gène effectivement muté |

Émis dans le **même lot atomique** que la naissance (`AGENT_CREE`, transferts,
`REPRODUCTION_TERMINEE`).

## Empreinte

`empreinteConfigurationHeritable` : hash FNV-1a 64 de la sérialisation
canonique (clés triées). Ce n'est **pas** une identité cryptographique d'agent.
Deux objets équivalents d'ordre de clés différent → même empreinte.

## Atomicité & reprise

La mutation voyage avec la reproduction mécanique :

- lot unique `ajouterPlusieurs` (BEGIN/COMMIT SQLite) ;
- retry `deja_terminee` → aucun nouvel événement mutation ;
- crash après commit → pas de double `MUTATION_APPLIQUEE` pour le même enfant ;
- redémarrage SQLite → génotype reconstruit à l'identique.

## Diversité (descriptive)

Projections `diversiteHeritable` / `heritageVariation` :

- nombre de configurations distinctes (par empreinte) ;
- mutations cumulées / du cycle ;
- agents avec ≥1 mutation à la naissance ;
- stats par gène (min / médiane / max ou comptes catégoriels).

Bannière :

> `DIVERSITE_HERITABLE_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE`

Aucune causalité fitness → diversité n'est pas un score reproductif.

## Absence de sélection

Interdit en v0.1 :

- fitness → choix des parents ;
- fitness → paramètres de mutation ;
- ranking / tournoi ;
- reproduction automatique dans `avancerUnCycle`.

## Limites expérimentales

Hors périmètre :

- KnowledgeUnits / mémoire héritée ;
- prompt libre hérité ;
- code auto-modifiant ;
- mutation du protocole, des règles économiques, des clés, du taux, du modèle IA ;
- sélection économique autonome ;
- Solana / Shadow / Live / trading réel.

Démo non canonique : `experiences/developpement-mutation-v01.json`
(fournisseur simulé uniquement).

Voir aussi : [`REPRODUCTION.md`](./REPRODUCTION.md),
[`MOTEUR_DECISION_AGENT.md`](./MOTEUR_DECISION_AGENT.md),
[`FITNESS_DESCRIPTIVE.md`](./FITNESS_DESCRIPTIVE.md).
