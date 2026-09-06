# Architecture ESP — population, contrôleur, dashboard et Xway v0.1

## Objectif

ESP est un système expérimental greenfield pour étudier l'évolution économique
d'agents autonomes sous contraintes réelles de ressources.

Ce document décrit les **frontières actuelles** du monorepo.
Le noyau économique v0.1 est déterministe, auditable et indépendant de toute
blockchain ou IA réelle.

Phases livrées :

- population / contrôleur / dashboard v0.1 ;
- **Xway v0.1** — ressources cognitives **simulées** (autorisation, mesure, coût).

Aucune transaction réelle, aucun wallet, aucune IA réelle, aucune connexion Solana.

## Organisation du monorepo

```
esp/
├── applications/
│   ├── controleur/          # Orchestrateur + API + simulateurs de développement
│   └── tableau-de-bord/     # Observateur (Vite + React)
├── paquets/
│   ├── protocole/           # Invariants, noyau économique, taxonomies d'événements
│   ├── moteur-agent/        # Stub
│   ├── registre-evenements/ # Journal append-only
│   ├── xway/                # Passerelle ressources cognitives (simulée)
│   └── environnement/       # Abstraction marché
├── documentation/
│   ├── ARCHITECTURE.md
│   ├── NOYAU_ECONOMIQUE.md
│   ├── CONTROLEUR_EXPERIENCE.md
│   ├── DASHBOARD.md
│   └── XWAY.md
├── experiences/
└── data/                    # Hors Git
```

## Principe d'autorité

```
AGENT → XWAY (autorise / mesure)
              ↓
         CONTRÔLEUR (seul writer)
              ↓
      REGISTRE ÉVÉNEMENTS
              ↓
         PROJECTIONS → API → DASHBOARD
```

## Frontières clés

### `@esp/protocole`

Vérité économique. `DEPENSE_COMPUTE` est l'effet économique canonique.
Taxonomies : économique + contrôle d'expérience + observation Xway.

### `@esp/xway`

Autorisation, routage, mesure, coût. Ne modifie pas le capital.
Ne écrit pas le registre. Détail : [`XWAY.md`](./XWAY.md).

### `@esp/controleur`

Calcule le budget cognitif, applique la politique cognitive de développement,
agrège les coûts Xway dans `depenseCompute`, enregistre tous les événements.

### `@esp/tableau-de-bord`

Observateur. Section Xway + fiche agent « Cognition / Xway ».
Bannière : **FOURNISSEUR SIMULÉ — aucune IA réelle**.

## Invariants additionnels Xway

16. Pas de double débit : `INFERENCE_EXECUTEE` ≠ perte ; seul `DEPENSE_COMPUTE` débite (`coutFinal`).
17. `coutFinal <= coutMaximumEstime` et `<= limiteDepenseAutorisee`.
18. Configuration Xway figée dans `EXPERIENCE_CREEE`.
19. Demande d'inférence idempotente (identifiant unique) — état reconstructible depuis le registre.
20. Réservation = capacité opérationnelle, jamais une dépense ; ne modifie pas la VEN.
21. Capacité disponible = limite − réservations actives − coûts réglés (même agent/cycle).
22. `AUTORISEE` sans confirmation fournisseur après reprise → ne pas relancer automatiquement (`resultat_indetermine`).

## Hors périmètre actuel

OpenAI / Anthropic / clés API ; wallets ; Solana ; reproduction ;
crédits Xway prépayés ; service réseau Xway indépendant.
