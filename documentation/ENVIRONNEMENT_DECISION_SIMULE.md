# Environnement de décision simulé v0.1

## Rôle

`EnvironnementOpportunitesSimulees` est un environnement économique
**expérimental**, déterministe et auditable, hors `@esp/protocole`.

Il ne modifie **jamais** le capital directement : il retourne un
`ResultatActiviteCycle` consommé par le noyau économique.

Aucun trading réel, aucun prix de marché, aucune blockchain.

## Observation

Chaque cycle, pour chaque agent **vivant** :

```
ObservationOpportunite {
  identifiantObservation
  identifiantAgent
  numeroCycle
  typeObservation: "opportunite_simulee"
  probabiliteSuccesBps      // 0–10_000
  gainSiSuccesMicroUsdc
  perteSiEchecMicroUsdc
  fraisActionMicroUsdc
  description
  actionsAutorisees         // ["attendre", "agir"]
}
```

L'agent connaît la probabilité et les montants.
Il **ne connaît pas** le tirage futur (`tirageBps`).

## Actions

| Action | Effet |
|--------|--------|
| `attendre` | revenu 0, perte 0, frais = `fraisAttendreMicroUsdc` (défaut 0), pas de tirage |
| `agir` | tirage déterministe → succès (gain) ou échec (perte) + frais d'action |

## Déterminisme

Générateur pseudo-aléatoire seedé (Mulberry32) à partir de :

- graine d'expérience ;
- identifiant agent ;
- numéro de cycle ;
- identifiant d'observation ;
- domaine (`observation` / `tirage`).

Même expérience + même graine + mêmes actions → mêmes résultats.
Aucun `Math.random` non seedé.

## Intégration contrôleur

Mode `decision_simulee` dans la configuration d'expérience :

- exige `environnementDecision` + `politiqueBudgetCognitif` ;
- remplace le simulateur historique pour l'activité ;
- conserve loyers, redevances, survie via le noyau inchangé.

Profil de démonstration :

`experiences/developpement-decision-v01.json`

(valeurs **non canoniques**, non destinées aux expériences scientifiques).

## Lien avec le moteur de décision

Voir [`MOTEUR_DECISION_AGENT.md`](./MOTEUR_DECISION_AGENT.md).
