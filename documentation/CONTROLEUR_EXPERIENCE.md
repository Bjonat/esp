# Contrôleur d'expérience ESP v0.1

## Rôle

Le contrôleur d'expérience (`@esp/controleur`) est le **seul écrivain**
d'une expérience ESP.

Il orchestre :

1. chargement de la configuration ;
2. ouverture du registre SQLite ;
3. création ou reprise de l'expérience ;
4. population Genesis ;
5. avance cycle par cycle ;
6. simulation d'activité (développement) ;
7. exécution du noyau économique ;
8. enregistrement des événements ;
9. projections de lecture ;
10. API HTTP locale.

## Source de vérité

Le **registre d'événements** est la source de vérité unique d'une expérience.

Il contient :

1. **Événements de contrôle** (`EXPERIENCE_CREEE`, `EXPERIENCE_DEMARREE`,
   `EXPERIENCE_MISE_EN_PAUSE`, `EXPERIENCE_REPRISE`, `EXPERIENCE_TERMINEE`,
   `CYCLE_EXPERIENCE_AVANCE`) ;
2. **Événements économiques** (agents, capital, cycles agent, coûts, survie…).

`EXPERIENCE_CREEE` fige le snapshot exact :
identifiant, versionProtocole, mode, graine, taille population, capital initial,
paramètres économiques, version du simulateur.

Le fichier JSON dans `experiences/` sert uniquement à **créer** une nouvelle
expérience. Après création, une modification du JSON **ne modifie pas**
rétroactivement l'expérience existante.

Reconstruction après redémarrage :

```
SQLite → EXPERIENCE_CREEE (config historique)
       → événements de contrôle (statut)
       → max(numeroCycle) (cycle courant — une seule règle)
       → événements agents (population / économie / trésorerie)
```

Aucun fichier `experience-meta.json` n'est requis pour la vérité expérimentale.

`CYCLE_EXPERIENCE_AVANCE` matérialise l'orchestration ; il ne crée pas une
seconde comptabilité de cycle incompatible avec les événements économiques.

## Configuration

Fichiers dans `experiences/`.

Profil de développement actuel :

`experiences/developpement-population-v01.json`

Ces valeurs sont documentées comme :

- **VALEURS DE DÉMONSTRATION**
- **NON PRÉENREGISTRÉES**
- **NON DESTINÉES AUX FUTURES EXPÉRIENCES SCIENTIFIQUES**

Montants : chaînes décimales entières micro-USDC.

## Population Genesis

À la première ouverture d'une expérience vide :

- N agents génération 0 ;
- aucun parent ;
- événements `AGENT_CREE` + `CAPITAL_INITIAL_ATTRIBUE` ;
- capital initial = injection externe (pas un revenu, pas une redevance) ;
- HWM initial ancré sur ce capital.

La reproduction n'est **pas** activée.

## Simulateur de développement

Fichier : `applications/controleur/src/simulateur-developpement.ts`

Identifié clairement comme **SIMULATEUR DE DÉVELOPPEMENT**.

- **Hors** `@esp/protocole` ;
- déterministe (graine + agent + cycle) ;
- montants entiers micro-USDC ;
- aucun `Math.random` non seedé ;
- produit un `ResultatActiviteCycle` ;
- ne décide pas de la survie (le noyau le fait).

## Cycle

Pour chaque agent non mort :

1. `simulerActiviteCycle`
2. `executerCycleEconomique` (noyau)
3. enregistrement append-only des événements
4. mise à jour trésorerie propriétaire

Un agent mort :

- reste dans la population ;
- reste visible via API ;
- ne produit plus d'activité ;
- ne peut jamais être réactivé.

La vitesse wall-clock d'exécution **ne modifie pas** les résultats économiques.

## Reprise après redémarrage

Scénario validé par tests :

1. créer expérience ;
2. 20 cycles ;
3. fermer SQLite ;
4. rouvrir (éventuellement sans JSON, via `ouvrirDepuisRegistre`) ;
5. reconstruire ;
6. cycle 21 ≡ exécution continue de 21 cycles.

## API locale

Écoute **uniquement** `127.0.0.1` (défaut port `3001`).

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/api/sante` | Santé |
| GET | `/api/experience` | Expérience |
| GET | `/api/population` | Agrégats population |
| GET | `/api/agents` | Liste agents |
| GET | `/api/agents/:id` | Fiche agent |
| GET | `/api/agents/:id/evenements` | Événements agent |
| GET | `/api/arbre-genealogique` | Arbre (racines Genesis) |
| GET | `/api/tresorerie` | Trésorerie propriétaire |
| GET | `/api/activite-recente` | Timeline |
| GET | `/api/historique` | VEN / états / trésorerie par cycle |
| POST | `/api/experience/avancer` | +1 cycle |
| POST | `/api/experience/demarrer` | Statut en_cours |
| POST | `/api/experience/pause` | Statut en_pause |

Pas d'endpoint `reset` destructeur.

## Sérialisation

JSON : montants en `{ microUsdc: "…", usdc: "…" }`.

La forme `usdc` est **uniquement** d'affichage.
Le frontend ne recalcule pas les comptes économiques.

## Persistance

```
data/developpement/esp.sqlite
```

Le dossier `data/` est ignoré par Git.
La configuration historique vit dans `EXPERIENCE_CREEE`, pas dans un meta JSON.

## Lancement

```bash
pnpm dev:controleur
```

Variables optionnelles :

- `ESP_CONFIG`
- `ESP_SQLITE`
- `ESP_META`
- `ESP_PORT`
- `ESP_HOTE` (doit rester `127.0.0.1` / `localhost`)
