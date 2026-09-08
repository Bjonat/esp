# Atomicité et reprise du cycle économique v0.1

## Objectif

Garantir qu'un crash à un point critique d'un cycle ne provoque ni double
application économique ni disparition silencieuse d'une conséquence.
Le **registre** reste la source de vérité.

## Identifiant causal

```
ecoexec:{experience}:{agent}:c{numeroCycle}
```

Champ `chargeUtile.identifiantExecutionEconomique` sur chaque événement du lot
économique, et sur `RESULTAT_ACTION_OBSERVE` (mode décision).

Corrélation : pas par proximité de séquence, mais par cet identifiant
(ou, legacy, agent+cycle+types économiques).

## Stratégie d'atomicité

1. **`executerCycleEconomique`** (protocole) — pur / déterministe :
   - si `CYCLE_TERMINE` déjà présent pour l'exécution → aucun nouvel événement ;
   - si lot partiel → n'émet que les étapes manquantes ;
   - estampille l'identifiant causal sur chaque événement produit.

2. **Contrôleur / registre** — écriture du lot d'un agent×cycle via
   `registre.ajouterPlusieurs` :
   - SQLite : `BEGIN` → inserts → `COMMIT` (ROLLBACK sur erreur) ;
   - mémoire : tout-ou-rien.

Le protocole ne dépend pas de SQLite. La transaction appartient au registre.

## Comportement crash

| Moment | Effet visible | Reprise |
|--------|---------------|---------|
| Avant COMMIT du lot économique | Aucun événement économique partiel | Réexécution propre du lot |
| Après COMMIT, avant retour contrôleur | Lot complet dans le registre | Détecte `terminee` — aucun second lot |
| Partiel injecté / legacy | Événements préfixe présents | Complète uniquement le manquant |

Si `CYCLE_EXPERIENCE_AVANCE(N)` existe sans `CYCLE_TERMINE` pour un agent vivant,
`avancerUnCycle` reprend **N** (pas N+1).

## Xway / action

- Consommation Xway déjà attribuée (`DEPENSE_COMPUTE` avec `identifiantDemande`) :
  pas de second débit.
- `RESULTAT_ACTION_OBSERVE` existant : pas de rejeu d'action / tirage.

## Compatibilité

Événements sans `identifiantExecutionEconomique` restent lisibles (corrélation
agent+cycle). Aucune réécriture d'historique.
