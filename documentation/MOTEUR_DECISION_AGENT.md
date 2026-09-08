# Moteur de décision agent ESP v0.1

## Objectif

Permettre qu'une **décision** d'agent produise une **conséquence économique**
dans un environnement simulé, sans trading réel ni blockchain.

Boucle canonique :

```
ENVIRONNEMENT
→ OBSERVATION
→ CHOIX COGNITIF
→ (Xway éventuel)
→ PROPOSITION
→ VALIDATION
→ ACTION
→ RÉSULTAT
→ NOYAU ÉCONOMIQUE
→ CAPITAL / SURVIE
```

Le coût de la cognition et la qualité de la décision influencent ensemble
la situation économique de l'agent.

## Modes d'expérience

| Mode | Activité économique |
|------|----------------------|
| `simulation` | Simulateur historique de développement (rétrocompatibilité) |
| `decision_simulee` | Revenus / pertes issus de l'action de l'agent dans l'environnement |

Voir [`ENVIRONNEMENT_DECISION_SIMULE.md`](./ENVIRONNEMENT_DECISION_SIMULE.md).

## Proposition vs action

Frontière critique :

```
LLM / politique locale  →  PROPOSITION
                              ↓
                         VALIDATEUR (whitelist)
                              ↓
                         DecisionAgent
                              ↓
                         ACTION environnementale
```

- Une **proposition** n'exécute jamais l'environnement.
- Seule une **décision validée** peut produire une action.
- En cas de refus / sortie invalide / échec cognitif : **repli → `attendre`**.
- Le compute déjà consommé est **conservé** (pas d'annulation magique).

## Politique cognitive (budget)

Décide **sans LLM** s'il faut payer une inférence (évite la récursion) :

- seuil d'enjeu (`seuilEnjeuPourInferenceMicroUsdc`) ;
- part max de la VEN (`partMaxVenParCycleBps`) ;
- plafond cognitif absolu ;
- plafond Xway expérience ;
- refus si survie critique / dormante (configurable).

Chemin sans inférence : `comportementSansInference`
(`attendre` | `agir_si_favorable`) — coût cognitif **0**.

## Coûts

| Nature | Effet |
|--------|--------|
| Compute Xway (`coutFinal`) | `DEPENSE_COMPUTE` via le noyau — une seule fois |
| Frais d'action | `fraisExecution` du résultat environnement |
| Gain / perte | `revenuActivite` / `perteActivite` selon l'issue |

Réservation Xway ≠ dépense. Aucun double débit.

## Causalité

Identifiants distincts :

- `identifiantObservation`
- `identifiantDecision`
- `identifiantDemande` (Xway, éventuel)
- `identifiantAction`

Chaîne reconstructible depuis le registre, sans s'appuyer sur la proximité
temporelle.

Événements (taxonomie décision) :

- `OBSERVATION_AGENT_RECUE`
- `CHOIX_COGNITIF_EFFECTUE`
- `PROPOSITION_DECISION_PRODUITE`
- `DECISION_AGENT_VALIDEE` / `DECISION_AGENT_REFUSEE`
- `ACTION_ENVIRONNEMENT_EXECUTEE`
- `RESULTAT_ACTION_OBSERVE`

Aucun chain-of-thought brut n'est stocké.

## Reprise

Persistance immédiate des jalons (observation, choix, auth Xway, décision,
action / résultat) pour reprise sûre après crash.

À la réouverture SQLite :

- un cycle déjà consolidé (`CYCLE_TERMINE`) n'est **pas** rejoué ;
- une action déjà observée n'est **pas** re-exécutée ;
- pas de double `DEPENSE_COMPUTE` pour la même demande.

## Fournisseur simulé vs OpenAI

Le fournisseur IA réel (`@esp/adaptateur-openai`, `gpt-5.6-luna` / `luna_reel_v01`)
est **déjà disponible** dans le monorepo (voir [`FOURNISSEUR_IA_REEL.md`](./FOURNISSEUR_IA_REEL.md)).

Le moteur de décision l'utilise via le contrat générique `FournisseurInference` :

```
Observation → PolitiqueBudgetCognitif → DemandeInference
  → signature Ed25519 → Xway AUTH → réservation
  → FournisseurInference (simule | openai opt-in)
  → proposition structurée → ValidateurDecision → DecisionAgent
  → action environnement simulé → noyau économique
```

| Chemin | Quand | Réseau |
|--------|-------|--------|
| `fournisseur-inference-simule` | tests / `avancer` en mode décision | non |
| `fournisseur-inference-openai` | `pnpm test:decision-reelle -- --executer` uniquement | 1 appel max |

Sur `avancer` / dashboard / CI : si `selecteur=openai`, **aucune** inférence
n'est branchée (même politique cognitive peut décider localement sans coût).

```bash
# Aperçu (clé requise pour ouvrir le scénario, aucun appel tant que sans --executer)
pnpm test:decision-reelle

# AU PLUS 1 appel réseau via l'adaptateur OpenAI réel
pnpm test:decision-reelle -- --executer
```

Commande sœur (inférence test hors boucle décision) :
`pnpm test:inference-reelle`.

Détail adaptateur : [`FOURNISSEUR_IA_REEL.md`](./FOURNISSEUR_IA_REEL.md).

## Dettes techniques

- Reprise mid-`executerCycleEconomique` (entre `CYCLE_DEMARRE` et `CYCLE_TERMINE`)
  — non corrigée ici ; à traiter séparément.
