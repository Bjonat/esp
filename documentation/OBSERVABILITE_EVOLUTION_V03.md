# Observabilité évolution ESP v0.3 (v03-C)

Document de **mesure** uniquement. Aucune métrique ici n'est une entrée du
mécanisme de reproduction, de mutation, d'héritage ou de ranking.

Ces définitions sont **figées** pour v03-D/E/F/G : ne pas les réinterpréter
après observation des résultats.

Références :

- Conception : `documentation/CONCEPTION_EVOLUTION_V03.md`
- Contrat mécanique : `documentation/REPRODUCTION_ECONOMIQUE_V03.md`
- Fitness descriptive : `documentation/FITNESS_DESCRIPTIVE.md`

Version : `observabilite-reproduction-economique-v03`

---

## Chaîne reconstructible

```text
ressources économiques
  → capacité théorique
  → contraintes structurelles
  → tentatives planifiées
  → autorisations / refus
  → naissances réalisées
```

Sans score global de fitness.

---

## Grandeurs (unités / types)

| Grandeur | Type | Définition |
|----------|------|------------|
| Capacité économique brute (`capaciteTheorique`) | `bigint` | `floor(max(0, VEN − réserve) / coûtNaissance)` — aucun garde-fou |
| Capacité après garde-fou parent (`capaciteBorneeParEnfants`) | `bigint` | `min(capaciteTheorique, nombreEnfantsRestants)` |
| Tentatives planifiées | `number` | Après plafonds globaux + round-robin ; figées dans `PLANIFIEE` |
| Tentatives évaluées | `number` | `modeEvaluation = "evaluee"` |
| Naissances réalisées | `number` | `REPRODUCTION_TERMINEE` / charge `TERMINEE` |
| Résultat économique hors reproduction | `MicroUsdc` signé | Whitelist d'**engagement** (ci-dessous) |

**Interdit :** float des capacités ; `fitnessScore` / `rank` / `rang` /
`percentile` / `meilleurAgent`.

---

## Trois niveaux de capacité (ne pas fusionner)

```text
A  capacité économique brute
     → B  capacité après limite enfants
          → C  tentatives réellement planifiées
               → naissances réelles
```

La troncature parent peut être **partielle** à fenêtre ouverte
(`capaciteTheorique = 5`, `enfantsRestants = 2` → 3 opportunités bloquées
par le plafond parent).

---

## Pression des garde-fous (décomposition sans double comptage)

Éligibilité structurelle **hors** garde-fous de sécurité :

```text
mécanisme actif ∧ vivant ∧ état éligible ∧ pas né ce cycle ∧ cooldown OK
```

(les motifs `nombre_enfants_max` / `population_maximale` /
`reproductions_cycle_max` restent mesurés à part.)

```text
capaciteEconomiqueTheoriqueEligible
  = Σ capaciteTheorique des parents structurellement éligibles

capaciteBloqueeParPlafondParent
  = Σ max(0, capaciteTheorique − capaciteBorneeParEnfants)
    (sur les mêmes parents éligibles — y compris troncature partielle)

capaciteDisponibleApresPlafondParent
  = capaciteEconomiqueTheoriqueEligible − capaciteBloqueeParPlafondParent
  = Σ capaciteBorneeParEnfants (éligibles)

capaciteBloqueeParPlafondsGlobaux
  = max(0, capaciteDisponibleApresPlafondParent − tentativesPlanifiees)

opportunitesBloqueesParGardeFous
  = capaciteBloqueeParPlafondParent + capaciteBloqueeParPlafondsGlobaux
```

Futur critère de calibration (non figé ici) :

```text
numerateur   = opportunitesBloqueesParGardeFous
denominateur = capaciteEconomiqueTheoriqueEligible
```

Pas de pourcentage flottant dans cette PR.

Alias : `opportunitesEconomiquementFinancables` =
`capaciteEconomiqueTheoriqueEligible` (dénominateur).

---

## Places / tentatives inutilisées (trois métriques)

```text
placesGlobalesNonUtilisees
  = placesGlobalesPlanifiees − naissancesRealisees

placesNonDemandeesParLePlan
  = max(0, placesGlobalesPlanifiees − tentativesPlanifiees)

tentativesPlanifieesNonRealisees
  = tentativesPlanifiees − naissancesRealisees
```

Identité (invariants du plan) :

```text
placesGlobalesNonUtilisees
  = placesNonDemandeesParLePlan + tentativesPlanifieesNonRealisees
```

Ainsi on distingue :

- capacité globale disponible mais **absence de demande économique** dans le plan ;
- tentative **planifiée mais refusée** à l'exécution.

`placesPlanifieesNonUtilisees` reste un alias de `placesGlobalesNonUtilisees`.

Observation ≠ correction.

---

## `resultatEconomiqueHorsReproductionV03`

**Métrique économique d'engagement, pas un flux de trésorerie.**

Le coût naît quand l'obligation devient **due** ; le paiement ultérieur
n'ajoute aucune perte supplémentaire.

### Convention de plage

`[cycleDebut, cycleFin]` **inclusive**.

`E` (fenêtre H4) n'est **pas** fixée ici (v03-F/G).

### Whitelist incluse

| Type | Sens |
|------|------|
| `REVENU_ACTIVITE` | + |
| `PERTE_ACTIVITE` | − |
| `DEPENSE_COMPUTE` | − |
| `DEPENSE_DONNEES` | − |
| `FRAIS_EXECUTION` | − |
| `LOYER_INFRASTRUCTURE_DU` | − |
| `REDEVANCE_PROPRIETAIRE_DUE` | − |

Les événements `…_DU` / `…_DUE` portent `montantMicroUsdc` dans le moteur.

### Explicitement exclus

| Type | Raison |
|------|--------|
| `LOYER_INFRASTRUCTURE_PAYE` | règlement (déjà compté au DU) |
| `REDEVANCE_PROPRIETAIRE_PAYEE` | règlement (déjà compté au DUE) |
| `DETTE_CREEE` | conversion d'obligation déjà due |
| `DETTE_REGLEE` | règlement (Δ capital = −Δ obligations) |
| `CAPITAL_INITIAL_ATTRIBUE` | capitalisation |
| `TRANSFERT_INTERNE` | flux interne (dont dotation) |
| `COUT_REPRODUCTION_PAYE` | coût de reproduction |
| `DEPENSE_INFRASTRUCTURE_PROPRIETAIRE` | hors agent |

Conséquence : loyer dû puis payé immédiatement, ou dû puis dettes puis
réglé plus tard, donne le **même** résultat sur une fenêtre couvrant le
cycle du DU.

---

## Sources registre

| Observable | Source |
|------------|--------|
| Snapshot parent | `…_CYCLE_PLANIFIEE.observabiliteParents` |
| Tentative | `observabiliteTentativeV03` sur `DEMANDEE` / `AUTORISEE` / `REFUSEE` |
| Agrégat / arrêts | `…_CYCLE_TERMINEE` |
| Projection cycle | `projeterObservabiliteReproductionEconomiqueV03` |
| Hors reproduction | `calculerResultatEconomiqueHorsReproductionV03` |

`modeEvaluation` : `evaluee` | `propagation_monotone`.

---

## Motifs d'arrêt de fenêtre

- `capacite_planifiee_epuisee`
- `capital_insuffisant`
- `reserve_minimale`
- `nombre_enfants_max`
- `population_maximale`
- `reproductions_cycle_max`
- `agent_mort`

Pas de `fitness_insuffisante`.

---

## Non-interférence

Retirer `CLES_OBSERVABILITE_CHARGE_V03` laisse la trajectoire causale
v03-B. Aucune métrique n'entre dans le planificateur.

---

## API minimale

- `GET /api/observabilite-reproduction-economique-v03?numeroCycle=N`
- `GET /api/agents/:id/resultat-economique-hors-reproduction-v03?cycleDebut=&cycleFin=`

Pas de dashboard, pas de classement de parents.
