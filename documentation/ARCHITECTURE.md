# Architecture ESP — fondations + noyau économique v0.1

## Objectif

ESP est un système expérimental greenfield pour étudier l'évolution économique
d'agents autonomes sous contraintes réelles de ressources.

Ce document décrit les **frontières actuelles** du monorepo.
Le noyau économique v0.1 est déterministe, auditable et indépendant de toute
blockchain ou IA réelle.

Aucune transaction réelle, aucun wallet financier, aucune inférence payante et
aucune connexion Solana ne sont implémentés.

## Organisation du monorepo

```
esp/
├── applications/
│   ├── controleur/          # Orchestration d'expérience
│   └── tableau-de-bord/     # Interface d'observation
├── paquets/
│   ├── protocole/           # Invariants, types métier, noyau économique
│   ├── moteur-agent/        # Identité / boucle agent (stub)
│   ├── registre-evenements/ # Journal append-only (mémoire + SQLite)
│   ├── xway/                # Plateforme ressources / metering (stub)
│   └── environnement/       # Abstraction économique remplaçable
├── adaptateurs/
│   ├── replay/              # Environnement de rejeu
│   └── solana/              # Frontière future SOL/USDC (sans réseau)
├── documentation/
│   ├── ARCHITECTURE.md
│   └── NOYAU_ECONOMIQUE.md
├── experiences/             # Configurations d'expériences
└── .github/workflows/       # CI
```

## Frontières

### 1. `@esp/protocole` — cœur métier

Contient les invariants et types stables du protocole ESP :

- `Agent` minimal (identifiant, génération, parent, survie, naissance) ;
- états de survie : `sain`, `contraint`, `critique`, `dormant`, `mort` ;
- transition de survie avec invariant : **un agent mort ne revient pas à un état vivant** ;
- **noyau économique v0.1** :
  - unité `MicroUsdc` (`bigint`) ;
  - taxonomie d'événements versionnée ;
  - `ParametresEconomiquesExperience` / contrat économique ;
  - état économique agent + valeur économique nette ;
  - runway / survie ;
  - loyer d'infrastructure ;
  - redevance propriétaire à high-water mark ;
  - trésorerie propriétaire ;
  - cycle économique déterministe ;
  - reconstruction événementielle ;
  - transfert interne sans création de valeur.

Le protocole ne dépend d'aucune blockchain, d'aucun fournisseur d'IA, ni de Xway.

Détail : [`NOYAU_ECONOMIQUE.md`](./NOYAU_ECONOMIQUE.md).

### 2. `@esp/moteur-agent` — runtime agent

Couche destinée à l'identité opérationnelle, la boucle, la mémoire, les
comportements, les décisions et les outils.

À ce stade : stub minimal autour d'un `Agent` du protocole.

### 3. `@esp/registre-evenements` — vérité auditable

Journal append-only :

- `RegistreEvenementsMemoire` — tests rapides ;
- `RegistreEvenementsSqlite` — persistance locale (`node:sqlite`) ;

Propriétés :

- ajout ordonné d'événements ;
- consultation globale, par agent, par expérience, par cycle ;
- immutabilité profonde des événements historiques ;
- refus des identifiants en double ;
- aucune méthode UPDATE d'événement historique ;
- reconstruction après redémarrage du processus.

Le schéma d'événement est celui du protocole (`EvenementEconomique`).

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

Interface d'observation (Vite + React), données statiques pour l'instant.

Ne déploie jamais vers `/opt/esp-dashboard` depuis le code de développement.

## Invariants exprimés dans le code

1. Mortalité irréversible (`transitionnerEtatSurvie`).
2. Registre append-only et non mutable après écriture (y compris charge utile imbriquée).
3. Indépendance du cœur vis-à-vis de Solana et des fournisseurs d'IA.
4. Aucune transaction réelle autorisée par défaut.
5. Montants en micro-USDC entiers (`bigint`) — pas de flottants.
6. Temps expérimental fondé sur les cycles — pas sur l'horloge système.
7. Naissance / capital initial sans création de revenu.
8. Transfert interne sans création de valeur globale.
9. Redevance high-water mark (pas de double taxation d'un même profit).
10. Distinction capital / obligations / totaux d'activité / trésorerie propriétaire.
11. Paramètres économiques d'expérience versionnés.

## Ce qui n'existe pas encore (volontairement)

- Boucle agent complète ;
- wallet Ed25519 / Solana ;
- Jupiter, données de marché, trading, positions SOL ;
- OpenAI / Anthropic / inference gateway réel ;
- metering et accounting Xway réels ;
- Shadow/Live opérationnels ;
- reproduction, héritage, mutation, fitness ;
- secrets, clés privées ;
- Docker / déploiement production.

## Chaîne qualité

À la racine :

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

La CI GitHub Action exécute la même séquence.
