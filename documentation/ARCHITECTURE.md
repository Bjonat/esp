# Architecture ESP — fondations

## Objectif

ESP est un système expérimental greenfield pour étudier l'évolution économique
d'agents autonomes sous contraintes réelles de ressources.

Ce document décrit les **frontières actuelles** du monorepo à l'étape fondations.
Aucune transaction réelle, aucun wallet financier, aucune inférence payante et
aucune connexion Solana ne sont implémentés.

## Organisation du monorepo

```
esp/
├── applications/
│   ├── controleur/          # Orchestration d'expérience
│   └── tableau-de-bord/     # Interface d'observation
├── paquets/
│   ├── protocole/           # Invariants et types métier du cœur
│   ├── moteur-agent/        # Identité / boucle agent (stub)
│   ├── registre-evenements/ # Journal append-only
│   ├── xway/                # Plateforme ressources / metering (stub)
│   └── environnement/       # Abstraction économique remplaçable
├── adaptateurs/
│   ├── replay/              # Environnement de rejeu
│   └── solana/              # Frontière future SOL/USDC (sans réseau)
├── documentation/
├── experiences/             # Configurations d'expériences (vide pour l'instant)
└── .github/workflows/       # CI
```

## Frontières

### 1. `@esp/protocole` — cœur métier

Contient les invariants et types stables du protocole ESP :

- `Agent` minimal (identifiant, génération, parent, survie, naissance) ;
- états de survie : `sain`, `contraint`, `critique`, `dormant`, `mort` ;
- transition de survie avec invariant : **un agent mort ne revient pas à un état vivant**.

Le protocole ne dépend d'aucune blockchain, d'aucun fournisseur d'IA, ni de Xway.

### 2. `@esp/moteur-agent` — runtime agent

Couche destinée à l'identité opérationnelle, la boucle, la mémoire, les
comportements, les décisions et les outils.

À ce stade : stub minimal autour d'un `Agent` du protocole.

### 3. `@esp/registre-evenements` — vérité auditable

Journal append-only en mémoire :

- ajout ordonné d'événements ;
- consultation globale ou par agent ;
- immutabilité des événements historiques (`Object.freeze`) ;
- refus des identifiants en double.

Toute reconstruction d'état expérimental devra s'appuyer sur ce registre.

### 4. `@esp/xway` — plateforme

Frontière séparée pour, à terme :

- authentification des agents ;
- ressources compute ;
- inference gateway ;
- achat de données ;
- metering ;
- accounting.

Le cœur ESP ne doit pas importer de SDK OpenAI, Anthropic ou équivalent.
Xway sera le seul point d'intégration de ces fournisseurs.

### 5. `@esp/environnement` — marché abstrait

Contrat `EnvironnementEconomique` indépendant de Solana.
Modes prévus : `replay`, `shadow`, `live` — strictement séparés.
`transactionsReellesAutorisees` est toujours `false` à ce stade.

### 6. Adaptateurs

- `@esp/adaptateur-replay` : rejeu sans effet de bord externe.
- `@esp/adaptateur-solana` : déclaration de frontière uniquement.
  Aucune dépendance `@solana/*`, aucune clé, aucune RPC.

### 7. `@esp/controleur`

Assemble environnement + registre pour piloter une expérience.
Population et génération valent `0` ; statut affiché : `Fondations`.

### 8. `@esp/tableau-de-bord`

Interface d'observation (Vite + React), données statiques pour l'instant :

- ESP ;
- statut Fondations ;
- population 0 ;
- génération 0 ;
- environnement Non démarré ;
- mode Développement.

Ne déploie jamais vers `/opt/esp-dashboard` depuis le code de développement.

## Invariants déjà exprimés dans le code

1. Mortalité irréversible (`transitionnerEtatSurvie`).
2. Registre append-only et non mutable après écriture.
3. Indépendance du cœur vis-à-vis de Solana et des fournisseurs d'IA.
4. Aucune transaction réelle autorisée par défaut.

## Ce qui n'existe pas encore (volontairement)

- Boucle agent complète ;
- portefeuille / capital / coûts ;
- reproduction, héritage, mutation, fitness ;
- metering et accounting Xway réels ;
- Shadow/Live opérationnels ;
- API Solana ;
- secrets, wallets, clés privées ;
- Docker / déploiement production.

## Chaîne qualité

À la racine :

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

La CI GitHub Action exécute la même séquence.
