# Architecture ESP — population, contrôleur, dashboard, Xway et identité v0.1

## Objectif

ESP est un système expérimental greenfield pour étudier l'évolution économique
d'agents autonomes sous contraintes réelles de ressources.

Phases livrées :

- noyau économique v0.1 ;
- population / contrôleur / dashboard v0.1 ;
- **Xway v0.1** — ressources cognitives **simulées** ;
- **Identité agent v0.1** — Ed25519, distincte de tout wallet.

Aucune transaction réelle, aucun wallet Solana, aucune IA réelle.

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
├── documentation/
│   ├── ARCHITECTURE.md
│   ├── NOYAU_ECONOMIQUE.md
│   ├── CONTROLEUR_EXPERIENCE.md
│   ├── DASHBOARD.md
│   ├── XWAY.md
│   └── IDENTITE_AGENT.md
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
Bannière Xway : **FOURNISSEUR SIMULÉ — aucune IA réelle**.

## Invariants identité

23. `CLE_IDENTITE_ESP ≠ CLE_WALLET_SOLANA` — jamais de réutilisation financière.
24. Clé privée hors registre / API / dashboard / logs / prompts / Xway.
25. Pas de régénération silencieuse si la privée disparaît (échec fermé).
26. Xway authentifie contre la clé publique **enregistrée**, pas seulement celle présentée.
27. Domaine de signature `ESP-XWAY-INFERENCE-V1` — non réutilisable pour un paiement.

## Invariants Xway (rappel)

16–22 : double débit interdit, réservation ≠ dépense, idempotence, reprise, etc.

## Hors périmètre actuel

OpenAI / Anthropic ; wallets Solana ; Jupiter ; reproduction / héritage / mutation ;
rotation de clés ; HSM / Vault ; service réseau Xway indépendant.
