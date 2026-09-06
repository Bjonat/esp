# Dashboard ESP v0.1

## Rôle

Le tableau de bord (`@esp/tableau-de-bord`) est un **observateur**.

Il ne doit jamais :

- écrire dans SQLite ;
- modifier l'état économique ;
- générer des données ;
- simuler silencieusement un agent ;
- recalculer les règles du protocole.

Les actions utilisateur envoient des **commandes** au contrôleur
(`POST /api/experience/avancer`, etc.).

## Distinction simulation / réel

Bannière permanente lorsque une expérience est active :

**MODE : SIMULATION DÉTERMINISTE**

Le dashboard ne laisse jamais croire qu'il s'agit de :

- trading Solana réel ;
- données de marché réelles ;
- agents IA ;
- argent réel.

## États d'affichage

| Situation | Message |
|-----------|---------|
| API inaccessible | Contrôleur déconnecté |
| API OK, pas d'instantané | Aucune expérience active |
| Expérience chargée | Supervision vivante |

Aucune absence de données n'est comblée par des mocks.

## Écran principal

- En-tête ESP + identifiant + mode + cycle + connexion
- KPIs population / VEN / trésorerie / loyers / redevances
- Carte de population (racines Genesis, états colorés, taille ~ VEN)
- Activité récente (vrais événements du registre)
- Contrôle : Avancer d'un cycle / Démarrer / Pause
- Trésorerie propriétaire
- Mini historique VEN

## Fiche agent

Onglets :

| Onglet | Contenu |
|--------|---------|
| Vue d'ensemble | Identité, état, naissance, runway |
| Économie | Capital, obligations, VEN, HWM, totaux |
| Activité | Chronologie registre |
| Décisions | « Moteur de décision non connecté » |
| Recherche | « Aucune source de données ou recherche connectée » |
| Portefeuille | « Aucun environnement financier connecté » |
| Descendance | « Reproduction non activée » |

Placeholders **volontaires et honnêtes** — aucune donnée fictive.

## Arbre généalogique

Modèle prêt pour parent → enfant.
En v0.1 : N racines, 0 relation.
Aucun faux descendant.

## Développement

```bash
pnpm dev:tableau-de-bord
```

- UI : `http://127.0.0.1:5173`
- Proxy Vite : `/api` → `http://127.0.0.1:3001`

Polling HTTP (~2 s) pour rafraîchir l'observation.
Aucune ouverture firewall / UFW.
Aucun déploiement vers `/opt/esp-dashboard`.

## Stack

Vite + React. Pas de framework de dataviz lourd.
Style sombre, analytique, centre de commandement.
Animations discrètes uniquement sur apparition de vraies données.
