# Reproduction économique ESP v0.3

Contrat versionné `reproduction-economique-v03` dans `@esp/protocole`,
branché au contrôleur via une **voie explicitement activable**.

## Couches

| Couche | Module | Rôle |
|--------|--------|------|
| v03-A — primitives | `reproduction-economique-v03.ts` | coût, surplus, capacité, fenêtre, autorisation unitaire |
| v03-B — planification | `planifier-reproduction-economique-v03.ts` | plan figé round-robin, bornage `bigint→number` |
| v03-B — événements | `evenements-reproduction-economique-v03.ts` | `…_CYCLE_PLANIFIEE` / `…_CYCLE_TERMINEE` |
| v03-B — sélection | `mecanisme-reproduction-autonome.ts` | `reproduction-autonome-v01` (défaut) \| `reproduction-economique-v03` |
| v03-B — contrôleur | `executerPhaseReproductionEconomiqueV03` | orchestration, atomicité, reprise |
| v03-C — observabilité | `observabilite-reproduction-economique-v03.ts` | projections pures, hors reproduction, anti-fitness |

Les voies historiques v0.1/v0.2 (`planifierReproductionsAutonomes`,
`REPRODUCTION_AUTONOME_CYCLE_*`) restent bit-for-bit le défaut.

## Sélection de version

Champ optionnel `reproductionAutonome.mecanisme` :

- absent / `"reproduction-autonome-v01"` → mécanisme historique (défaut) ;
- `"reproduction-economique-v03"` → opt-in multi-naissances ;
- valeur inconnue → **fail-closed** à la parse.

Le champ n'est sérialisé dans `EXPERIENCE_CREEE` que s'il diffère du défaut
(snapshots historiques inchangés). Après création, le comportement se
reconstruit depuis le registre — pas depuis un fichier de config mutable.

## Formules (v03-A)

```text
coutNaissance = dotationEnfant + coutReproduction
surplus = max(0, VEN_canonique − reserveMinimaleParent)
capaciteTheorique = floor(surplus / coutNaissance)   # bigint exact
```

`VEN_canonique = capitalLiquide − obligationsDues`.

## Trois vérités structurantes (v03-B)

```text
plan figé ≠ ressources réservées
fenêtre ouverte ≠ naissances garanties
autorisation unitaire = autorité courante (réévaluée à chaque tentative)
```

Le plan fige uniquement : parents dans l'ordre neutre, nombre maximal de
tentatives, ordre déterministe des tentatives, identifiants de reproduction.
Il ne fige **pas** une autorisation future, un VEN futur, ni un résultat.

## Préfiltre fenêtre vs autorité unitaire

| Contrat | Rôle | Cooldown | Effet |
|---------|------|----------|-------|
| `evaluerOuvertureFenetreReproductiveV03` | préfiltre snapshot | oui (inter-cycles) | possibilité d'ouvrir |
| `evaluerAutorisationNaissanceEconomiqueV03` | autorité courante | **non** | financement de **cette** naissance |

Le cooldown n'est **pas** réévalué entre deux tentatives d'une fenêtre déjà
ouverte (le contrôleur passe `ignorerCooldownIntraFenetreV03`).

## Ordre inter-parents et round-robin

L'ordre des parents = priorité neutre déterministe existante
(`ordonnerCandidatsParPrioriteNeutre`). **Aucune** dépendance à VEN, surplus,
capacité, génotype, descendants ou fitness.

Politique d'arbitrage des tentatives : **round-robin déterministe** dans
l'ordre neutre :

```text
ordre neutre : A, B, C
tour 1 : A1, B1, C1
tour 2 : A2, B2, C2
…
```

Justification : le nombre de tentatives reste causé par les ressources
propres du parent ; un seul parent ne monopolise pas un plafond global
parce que son hash est premier ; aucun ranking économique.

## Bornage `bigint → number`

```text
bornerCapaciteTheoriqueVersNombreV03(capaciteTheorique, plafondNombreSur)
  = Number(min(capaciteTheorique, BigInt(plafondNombreSur)))
```

uniquement après bornage par plafonds `number` sûrs (enfants restants, puis
places globales / cycle via le round-robin). **Jamais** `Number(capaciteTheorique)`
direct.

## Identifiants

Réutilisent la convention mécanique existante, avec `numeroEnfant` assigné
au plan :

```text
identifiantEnfant        = {parent}-e{NNN}
identifiantReproduction  = repro:{experience}:{parent}:e{NNN}
```

Même expérience + parent + cycle + index de tentative → même identifiant.
Un restart ne fabrique pas de nouvel identifiant pour une tentative déjà
planifiée.

## Séquence d'une fenêtre

```text
snapshot début phase
  → ordre neutre des parents
  → ouverture fenêtre (préfiltre + cooldown)
  → projection capacité théorique
  → plan de tentatives figé (événement PLANIFIEE)
  → pour chaque tentative (round-robin) :
        déjà terminée ? skip
        autorisation économique courante
        si refus monotone → arrêter le parent
        sinon naissance atomique (lot existant)
        état réellement mis à jour
  → TERMINEE
```

## Motifs d'arrêt intra-fenêtre

Pour les motifs monotones dans le même cycle (sans événement économique
intermédiaire attendu), les tentatives restantes du parent sont abandonnées :

- `capital_insuffisant`
- `reserve_minimale`
- `nombre_enfants_max`
- `population_maximale`
- `reproductions_cycle_max`
- `agent_mort`

**Sémantique de persistance (v03-B)** : le refus unitaire est toujours
persisté (`REPRODUCTION_DEMANDEE` + `REPRODUCTION_REFUSEE`). Lors d'un arrêt
monotone, les tentatives restantes **du même parent déjà présentes dans le
plan** reçoivent le même motif et sont également persistées. Au restart :

- une tentative déjà refusée n'est pas rejouée (idempotence) ;
- aucune naissance fantôme ;
- aucun événement économique dupliqué.

Aucun réordonnancement vers un autre parent sur base économique.

## Place globale inutilisée après refus

```text
plan figé > maximisation du remplissage du plafond global
```

Si une tentative planifiée de A échoue au runtime, **aucune** tentative
supplémentaire de B hors du plan initial n'est inventée. Une place globale
éventuellement « libérée » reste inutilisée pour ce cycle. Le plan est la
source de vérité ; un restart ne produit jamais un plan différent ni de
nouvelles tentatives.

## Atomicité

- **Plan** : événement `REPRODUCTION_ECONOMIQUE_V03_CYCLE_PLANIFIEE` commité
  **avant** la première naissance. Restart → plan A, jamais recalcul B.
- **Naissance** : lot atomique existant (création, transfert, coût,
  héritage/mutation, terminaison) — une naissance à la fois, pas un lot
  géant pour tout le cycle.
- Crash avant commit k → aucune partie de k ; reprise même id.
- Crash après commit k → k reconnue terminée ; reprise sur k+1.
- Crash après toutes les naissances mais **avant** `…_CYCLE_TERMINEE` →
  restart retrouve le plan, skip les naissances déjà terminées, écrit
  **au plus une** TERMINEE, même généalogie / capital qu'une exécution continue.

## Enfant même cycle

Un enfant né au cycle N est exclu du snapshot des candidats de N :
pas de cascade parent → enfant → petit-enfant intra-cycle.

Le `numeroEnfant` figé dans le plan est l'autorité après restart — y compris
lorsqu'un enfant mécanique préexistant occupe déjà `e001`.

## Hors périmètre (v03-D…)

- campagne A/B/C/D, diagnostic, calibration, seeds, H4 ;
- dashboard analytique complet ; nouveaux gènes / mutations ;
- seuil final de pression des garde-fous ; valeur numérique de `E`.

## Observabilité v03-C

Mesure pure depuis le registre — voir
`documentation/OBSERVABILITE_EVOLUTION_V03.md`.

Enrichissements descriptifs (stripables) :

- `PLANIFIEE.observabiliteParents` — capacités brutes / bornées, fenêtre,
  tentatives planifiées (y compris capacité contrefactuelle si garde-fou) ;
- `observabiliteTentativeV03` sur `DEMANDEE` / `AUTORISEE` / `REFUSEE` —
  état avant, autorisation, `modeEvaluation` (`evaluee` |
  `propagation_monotone`), résultat ;
- `TERMINEE` — places non utilisées, arrêts de fenêtre, refus évalués vs
  propagation.

Projections pures :

- `projeterObservabiliteReproductionEconomiqueV03`
- `calculerResultatEconomiqueHorsReproductionV03`

L'observabilité **ne change pas** l'ouverture de fenêtre, la capacité
décisionnelle, le round-robin, les autorisations, naissances, héritage,
mutation ni RNG.
