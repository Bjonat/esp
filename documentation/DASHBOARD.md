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
- argent réel de l'agent.

Si le fournisseur Xway est OpenAI réel, une bannière distincte précise :

**INFÉRENCE IA RÉELLE — environnement économique toujours simulé**

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
- Section **Activité décisionnelle** (si mode `decision_simulee`)
- Tableau **Fitness descriptive** (tri par colonne, aucun ranking synthétique)
- Contrôle : Avancer d'un cycle / Démarrer / Pause
- Trésorerie propriétaire
- Mini historique VEN

## Fiche agent

Onglets :

| Onglet | Contenu |
|--------|---------|
| Vue d'ensemble | Identité logique, état, naissance, runway |
| Identité ESP | Algorithme, empreinte, statut signataire, clé publique abrégée — jamais la privée |
| Économie | Capital, obligations, VEN, HWM, totaux |
| Activité | Chronologie registre |
| Cognition / Xway | Demandes, modèles, jetons, coût imputé ESP, estimation fournisseur, proposition — SIMULÉ ou OPENAI RÉEL |
| Décisions | Chaîne Observation → Choix cognitif → Proposition → Action → Résultat → Coût (registre) |
| Performance | Fitness descriptive multidimensionnelle — **aucune sélection active** |
| Recherche | « Aucune source de données ou recherche connectée » |
| Portefeuille | « Aucun environnement financier connecté » |
| Descendance | Lignée, parent, enfants, stats demandées/autorisées/refusées/terminées, dotations, coûts — aucune sélection |
| Héritage / variation | Empreinte de configuration, différences vs parent, mutations à la naissance — **aucune sélection** |


L'écran principal affiche aussi une section **Xway** globale
(demandes / autorisations / refus / coûts / répartition modèles).

La population expose `diversiteHeritable` (configs distinctes, mutations
cumulées / cycle, stats par gène) sous la bannière
`DIVERSITE_HERITABLE_DESCRIPTIVE_AUCUNE_SELECTION_ACTIVE`.

Placeholders **volontaires et honnêtes** — aucune donnée fictive.

## Arbre généalogique

Relations parent → enfant reconstruites depuis le registre.
Chaque nœud peut porter `nombreMutationsNaissance` et
`empreinteConfiguration` (descriptifs).
Aucun faux descendant. Aucun score reproductif.

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
