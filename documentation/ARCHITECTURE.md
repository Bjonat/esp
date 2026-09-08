# Architecture ESP — population, contrôleur, dashboard, Xway et identité v0.1

## Objectif

ESP est un système expérimental greenfield pour étudier l'évolution économique
d'agents autonomes sous contraintes réelles de ressources.

Phases livrées :

- noyau économique v0.1 ;
- population / contrôleur / dashboard v0.1 ;
- **Xway v0.1** — ressources cognitives (simulées + adaptateur OpenAI opt-in) ;
- **Identité agent v0.1** — Ed25519, distincte de tout wallet ;
- **Fournisseur IA réel v0.1** — OpenAI Responses, économie toujours simulée ;
- **Moteur de décision agent v0.1** — observation → décision → action simulée → noyau ;
- **Atomicité cycle économique v0.1** — lot atomique, reprise exactly-once ;
- **Fitness descriptive v0.1** — mesures multidimensionnelles, aucune sélection ;
- **Reproduction mécanique v0.1** — naissance financée par le parent, aucune sélection ;
- **Reproduction autonome v0.1** — phase post-économie opt-in, priorité neutre, sélection émergente économique sans ranking fitness.

Aucune transaction réelle, aucun wallet Solana. IA réelle uniquement via opt-in
explicite (`xway.fournisseur: openai`) + `OPENAI_API_KEY` + commande manuelle
(`pnpm test:inference-reelle` ou `pnpm test:decision-reelle -- --executer`).
`avancer` / CI ne déclenchent jamais OpenAI.

## Organisation du monorepo

```
esp/
├── applications/
│   ├── controleur/          # Orchestrateur + API + simulateurs de développement
│   └── tableau-de-bord/     # Observateur (Vite + React)
├── paquets/
│   ├── protocole/           # Invariants, noyau économique, taxonomies d'événements
│   ├── moteur-agent/        # Identité Ed25519 + signataire + keystore local
│   ├── registre-evenements/ # Journal append-only
│   ├── xway/                # Passerelle ressources + authentification de demandes
│   └── environnement/       # Abstraction marché
├── adaptateurs/
│   ├── openai/              # FournisseurInferenceOpenAi (SDK isolé)
│   ├── replay/
│   └── solana/
├── documentation/
│   ├── ARCHITECTURE.md
│   ├── NOYAU_ECONOMIQUE.md
│   ├── CONTROLEUR_EXPERIENCE.md
│   ├── DASHBOARD.md
│   ├── REPRODUCTION.md
│   ├── REPRODUCTION_AUTONOME.md
│   ├── HERITAGE_MUTATION.md
│   ├── FITNESS_DESCRIPTIVE.md
│   ├── XWAY.md
│   ├── IDENTITE_AGENT.md
│   └── FOURNISSEUR_IA_REEL.md
├── experiences/
└── data/                    # Hors Git (SQLite + keystore identités)
```

## Principe d'autorité

```
AGENT → Signataire local → DemandeInferenceSignee
              ↓
         XWAY (AUTH → autorise / mesure)
              ↓
         CONTRÔLEUR (seul writer)
              ↓
      REGISTRE ÉVÉNEMENTS
              ↓
         PROJECTIONS → API → DASHBOARD
```

## Frontières clés

### `@esp/protocole`

Vérité économique + taxonomies (économique, expérience, Xway, **identité**).
`DEPENSE_COMPUTE` reste l'effet économique canonique.
`IDENTITE_AGENT_ENREGISTREE` lie agent → clé publique (jamais la privée).

### `@esp/moteur-agent`

Identité Ed25519, keystore local, `SignataireAgent`.
Détail : [`IDENTITE_AGENT.md`](./IDENTITE_AGENT.md).

### `@esp/xway`

Authentification, autorisation, réservation, mesure, coût.
Ne possède jamais la clé privée. Détail : [`XWAY.md`](./XWAY.md).

### `@esp/controleur`

Genesis (identité + capital), budget cognitif, politique cognitive,
agrège `coutFinal` Xway dans `depenseCompute`, seul writer du registre.

### `@esp/tableau-de-bord`

Observateur. Sections Xway + **Identité ESP**.
Bannière Xway : **FOURNISSEUR : SIMULÉ** ou **OPENAI RÉEL**
(+ bannière « INFÉRENCE IA RÉELLE — environnement économique toujours simulé »).

## Invariants identité

23. `CLE_IDENTITE_ESP ≠ CLE_WALLET_SOLANA` — jamais de réutilisation financière.
24. Clé privée hors registre / API / dashboard / logs / prompts / Xway.
25. Pas de régénération silencieuse si la privée disparaît (échec fermé).
26. Xway authentifie contre la clé publique **enregistrée**, pas seulement celle présentée.
27. Domaine de signature `ESP-XWAY-INFERENCE-V1` — non réutilisable pour un paiement.

## Invariants Xway (rappel)

16–22 : double débit interdit, réservation ≠ dépense, idempotence, reprise, etc.

## Hors périmètre actuel

Anthropic / Gemini / multi-provider ; wallets Solana ; Jupiter ; sélection par
fitness / ranking / tournoi ; score de fitness unique ; tool calling ;
rotation de clés ; HSM / Vault ; service réseau Xway indépendant ;
héritage de mémoire / KnowledgeUnits.

En place (v0.1) : reproduction mécanique, reproduction autonome (opt-in),
héritage de configuration comportementale et mutation déterministe bornée —
voir [`REPRODUCTION.md`](./REPRODUCTION.md),
[`REPRODUCTION_AUTONOME.md`](./REPRODUCTION_AUTONOME.md) et
[`HERITAGE_MUTATION.md`](./HERITAGE_MUTATION.md).

Le **contrôle expérimental** (`criteresArret.cycleMaximum`) est distinct des
contraintes de population / reproduction : il décide si l'expérience continue,
pas si un agent se reproduit. La diversité génotypique reste une mesure
descriptive (aucune anti-fixation en v0.1).

Voir [`FOURNISSEUR_IA_REEL.md`](./FOURNISSEUR_IA_REEL.md) pour l'adaptateur OpenAI v0.1.
Voir [`MOTEUR_DECISION_AGENT.md`](./MOTEUR_DECISION_AGENT.md) pour la boucle décisionnelle.
Voir [`ATOMICITE_CYCLE_ECONOMIQUE.md`](./ATOMICITE_CYCLE_ECONOMIQUE.md) pour la reprise exactly-once.
Voir [`FITNESS_DESCRIPTIVE.md`](./FITNESS_DESCRIPTIVE.md) pour les mesures v0.1.
Voir [`REPRODUCTION.md`](./REPRODUCTION.md) pour la naissance mécanique v0.1.
Voir [`REPRODUCTION_AUTONOME.md`](./REPRODUCTION_AUTONOME.md) pour la phase autonome v0.1.
Voir [`HERITAGE_MUTATION.md`](./HERITAGE_MUTATION.md) pour l'héritage / mutation v0.1.
Voir [`CONTROLEUR_EXPERIENCE.md`](./CONTROLEUR_EXPERIENCE.md) pour l'orchestration.
