# Reproduction mécanique ESP v0.1

## Objectif

Permettre à un agent **vivant** de financer la création d'un nouvel agent
économiquement indépendant.

Invariant fondamental :

> **NAISSANCE ≠ CRÉATION DE VALEUR**

La dotation de l'enfant provient du parent (transfert interne).

## Hors périmètre v0.1

- sélection par fitness ;
- héritage de connaissances / mémoire ;
- compétition reproductive complexe ;
- Solana / Shadow / Live ;
- appels OpenAI.

La **mutation déterministe** de la configuration héritable est documentée dans
[`HERITAGE_MUTATION.md`](./HERITAGE_MUTATION.md) (variation sans sélection).

## Identité enfant

Chaque enfant a :

- `identifiantAgent` déterministe (`{parent}-e{NNN}`) ;
- identité Ed25519 **propre** (CSPRNG, jamais dérivée de la graine) ;
- état économique propre ;
- `identifiantParent`, `identifiantLignee`, `numeroGeneration` (= génération).

Invariant : identité parent ≠ identité enfant. La clé privée parent n'est jamais
copiée.

## Lignée

| Champ | Genesis | Enfant |
|-------|---------|--------|
| `identifiantParent` | absent / null | parent |
| `identifiantLignee` | = identifiant agent | = lignée du parent |
| `generation` | 0 | parent + 1 |

La lignée reste stable pour tous les descendants d'un fondateur Genesis.

## Événements (corrélation `identifiantReproduction`)

```
repro:{experience}:{parent}:e{NNN}
```

| Type | Rôle |
|------|------|
| `REPRODUCTION_DEMANDEE` | intention |
| `REPRODUCTION_AUTORISEE` | capacité OK |
| `REPRODUCTION_REFUSEE` | motif explicite |
| `AGENT_CREE` | naissance (+ lignée, config héritable) |
| `TRANSFERT_INTERNE` | dotation (motif `dotation_naissance`) |
| `COUT_REPRODUCTION_PAYE` | coût hors population → trésorerie propriétaire |
| `REPRODUCTION_TERMINEE` | marqueur d'idempotence |

Ne pas corréler par proximité de séquence.

## Dotation vs coût

| Flux | Effet population | Effet parent | Effet enfant |
|------|------------------|--------------|--------------|
| Dotation M | VEN inchangée | −M (transfert) | +M |
| Coût C | VEN −C | −C | — |

Pas de `REVENU_ACTIVITE` pour la dotation. Pas de redevance artificielle sur le
transfert (règles HWM transfert existantes).

### Fitness descriptive

- Dotation → `transfertsInternesRecus` / `transfertsInternesEnvoyes` (neutralisée).
- `COUT_REPRODUCTION_PAYE` → `coutsReproductionPayesMicroUsdc` (coût réel, **non**
  neutralisé comme exogène, **jamais** `PERTE_ACTIVITE`).
- `resultatEconomiqueApresReproduction = resultatApresContrat − coutsReproduction`.

### Agrégats population

| Champ | Définition |
|-------|------------|
| `naissancesCumulees` | descendants non-Genesis depuis le début |
| `naissancesCycle` | `AGENT_CREE` reproductifs avec `cycleNaissance == cycle observé` |
| `ligneesVivantes` | lignées avec ≥1 agent **non mort** |
| `taillePopulationActuelle` | vivants + morts (alias `populationTotale`) |

Genesis n'est **pas** une naissance reproductive.

### Enfant mort

Reste dans `/api/arbre-genealogique` (reconstruction registre) avec parent,
lignée, génération, état `mort`. Hors « lignée vivante » si toute la lignée est
morte.

### Keystore orphelin

Clé écrite avant COMMIT. Crash avant COMMIT → clé orpheline possible.

Au retry pour le **même** `identifiantAgent` déterministe : réutilisation.
Jamais d'écrasement silencieux. Registre publique ≠ keystore → fail-closed.

## Autorisation économique

Paramètres versionnés `parametres-reproduction-v01` :

- `dotationEnfantMicroUsdc`
- `coutReproductionMicroUsdc`
- `reserveMinimaleParentMicroUsdc`
- `populationMaximale`
- `nombreMaxReproductionsParCycle`
- `nombreMaxEnfantsParAgent`
- `cooldownCycles`

Un parent ne peut reproduire que s'il finance **dotation + coût** tout en gardant
`VEN après ≥ réserve minimale`.

Refus sans dette automatique, sans refinancement caché.

## Configuration héritable

`ConfigurationHeritableAgent` (`configuration-heritable-v01`) :

- distincte de l'identité, de l'économie, de la mémoire et des secrets ;
- copie parent → enfant, puis **mutation optionnelle** (paramètres d'expérience) ;
- détail : [`HERITAGE_MUTATION.md`](./HERITAGE_MUTATION.md).

Jamais hérité : clé privée, capital complet, obligations, HWM brut parent,
historique, CoT, crédits Xway, mémoire épisodique.

## Fitness

La fitness descriptive reste **uniquement observable**.

Interdit en v0.1 :

- fitness → autorisation reproduction ;
- fitness → ranking parent.

## Déclenchement

API manuelle uniquement :

```
POST /api/agents/:id/reproduire
```

Aucune auto-politique dans `avancerUnCycle` (évite explosions accidentelles).

## Atomicité

Lot unique via `registre.ajouterPlusieurs` (BEGIN/COMMIT SQLite).

On ne doit jamais observer durablement : parent débité sans enfant, ou enfant
sans débit parent.

## Keystore + SQLite (stratégie)

La clé privée disque et la transaction registre ne sont **pas** la même
transaction.

Ordre retenu :

1. préparer le lot d'événements (pur) ;
2. si identité active : réutiliser la clé enfant **si déjà présente pour ce
   même identifiant logique déterministe**, sinon générer CSPRNG et écrire le
   keystore **avant** COMMIT ;
3. si `IDENTITE_AGENT_ENREGISTREE` existe déjà avec une publique ≠ keystore →
   **fail-closed** ;
4. inclure `IDENTITE_AGENT_ENREGISTREE` dans le même lot atomique ;
5. COMMIT registre ;
6. mettre à jour la mémoire contrôleur.

Clé orpheline (keystore sans `AGENT_CREE`) : acceptable uniquement pour le
même enfant déterministe au retry ; jamais pour un autre agent ; jamais
d'écrasement silencieux.
## Reprise / crash

| Moment | Effet |
|--------|-------|
| Avant COMMIT | aucun enfant / aucun débit durable |
| Après `REPRODUCTION_TERMINEE` | idempotence sur le même `identifiantReproduction` |

## API / dashboard

- Généalogie réelle : `GET /api/arbre-genealogique`
- Population : naissances, lignées, dotations, coûts reproductifs
- Fiche : lignée, parent, enfants (onglet Descendance)

Aucun score reproductif.

## Futur (sélection / héritage étendu)

Avant d'activer une sélection économique autonome :

1. quelles dimensions de fitness entrent dans une politique de sélection versionnée ;
2. KnowledgeUnits / mémoire héritée ;
3. interaction avec atomicité et identité.

La mutation comportementale bornée (sans sélection) est en
[`HERITAGE_MUTATION.md`](./HERITAGE_MUTATION.md).
