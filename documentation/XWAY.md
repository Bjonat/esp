# Xway v0.1 — ressources cognitives simulées

## Rôle

Xway est le **médiateur** entre un agent ESP et les ressources externes
qu'il consomme (ici : inférence cognitive simulée).

```
AGENT → demande signée → XWAY (AUTH) → autorisation (+ réservation) → fournisseur → usage → coût
                                              ↓
                                    contrôleur enregistre
                                              ↓
                                    DEPENSE_COMPUTE (noyau) = coutFinal
```

## Ce que Xway fait

- reçoit une `DemandeInference` (éventuellement signée) ;
- **authentifie** l'agent (Ed25519) avant toute estimation / réservation ;
- estime un coût maximum ;
- **réserve** temporairement ce plafond à l'autorisation ;
- autorise ou refuse selon la capacité disponible ;
- route vers un `FournisseurInference` ;
- mesure l'usage (jetons) ;
- calcule le coût final entier micro-USDC ;
- **règle** : `DEPENSE_COMPUTE = coutFinal`, libère `reservation - coutFinal` ;
- produit des traces d'observation.

## Ce que Xway ne fait PAS

- modifier le capital d'un agent ;
- écrire le registre (le **contrôleur** est le seul writer) ;
- décider de la survie ;
- calculer la fitness ;
- connaître Solana ;
- devenir source de vérité économique ;
- créer de crédits / wallet / monnaie Xway ;
- **posséder ou recevoir la clé privée** d'un agent.

## Authentification

Lorsque `identite.active` est figé pour l'expérience :

1. enveloppe `DemandeInferenceSignee` obligatoire ;
2. domaine `ESP-XWAY-INFERENCE-V1` ;
3. clé présentée = clé enregistrée pour `identifiantAgent` ;
4. signature vérifiée sur le message canonique.

Échec d'auth → motif `authentification_invalide` :
aucune réservation, aucun fournisseur, aucun coût.

Détail identité : [`IDENTITE_AGENT.md`](./IDENTITE_AGENT.md).

## Autorisation et capacité

Le contrôleur calcule `calculerLimiteDepenseCognitive` :

```
min(plafondComputeParCycle, max(0, VEN))
```

Capacité disponible côté Xway :

```
limite − réservations actives − coûts déjà réglés (même agent/cycle)
```

Xway refuse si `coutMaximumEstime > capacité disponible`.
Aucun crédit caché, aucun découvert.

## Réservation (capacité opérationnelle)

Une demande **autorisée** réserve `coutMaximumEstime`.

| Situation | Effet |
|-----------|--------|
| Autorisation | réserve `coutMaximumEstime` — **pas** une dépense |
| Règlement (`INFERENCE_EXECUTEE`) | `DEPENSE_COMPUTE = coutFinal` ; libère `reservation − coutFinal` |
| Refus | aucune réservation |
| Échec certain avant consommation | libère toute la réservation |
| Résultat indéterminé | **conserve** la réservation ; ne relance pas |

La réservation **ne modifie jamais** la VEN.

## Estimation vs coût réel

1. Avant : `coutMaximumEstime` (entrée estimée + sortie max).
2. Après : `coutFinal` depuis l'usage réel.
3. Invariant : `coutFinal <= coutMaximumEstime` (sinon erreur système).

## Idempotence persistante

L'état d'une `DemandeInference` est reconstructible depuis le registre
(`DEMANDE_INFERENCE_*` / `INFERENCE_*`).

Après redémarrage :

- `EXECUTEE` → ne jamais rappeler le fournisseur ; reconstruire le résultat ;
  aucune seconde `DEPENSE_COMPUTE` ;
- `REFUSEE` → ne pas réévaluer sous le même identifiant ;
- `ECHOUEE` (`echec_certain`) → état explicite, réservation libérée ;
- `AUTORISEE` sans suite → traité comme **résultat indéterminé**
  (préparation réseau : ne pas relancer automatiquement).

## Échec certain vs résultat indéterminé

Préparation fournisseur réseau (sans réseau réel pour v0.1) :

| Nature | Signification |
|--------|----------------|
| `echec_certain` | aucune consommation fournisseur plausible |
| `resultat_indetermine` | le fournisseur a pu traiter ; ne pas relancer |

Champ `natureEchec` sur `INFERENCE_ECHOUEE`.

## Fournisseur

Interface générique `FournisseurInference` — non liée à OpenAI.

Implémentation v0.1 : `FournisseurInferenceSimule`

- déterministe ;
- sans réseau ;
- sans SDK ;
- réponse explicitement marquée non-intelligente.

## Jetons (approximation documentée)

Pas un tokenizer OpenAI.

- entrée : `floor(longueurUTF16 / 4)` + cadrage par message ;
- sortie : dérivée déterministe de la demande, bornée.

Coût :

```
floor(jetons * tarifParMillion / 1_000_000)
```

pour entrée et sortie, somme entière.

## Relation avec DEPENSE_COMPUTE

| Événement Xway | Effet économique |
|----------------|-------------------|
| `DEMANDE_INFERENCE_AUTORISEE` | réservation capacité (pas de débit) |
| `INFERENCE_EXECUTEE` | observation d'activité |
| `DEPENSE_COMPUTE` | effet économique canonique (noyau) = `coutFinal` |

**Un seul débit.** Le contrôleur agrège les `coutFinal` Xway du cycle
et les passe au noyau via `depenseCompute`.

Ordre d'écriture registre : `RECUE` → `AUTORISEE` **avant** l'appel
fournisseur → `EXECUTEE` / `ECHOUEE`.

## Événements d'observation

- `DEMANDE_INFERENCE_RECUE`
- `DEMANDE_INFERENCE_AUTORISEE` (inclut `reservationMicroUsdc`)
- `DEMANDE_INFERENCE_REFUSEE`
- `INFERENCE_EXECUTEE`
- `INFERENCE_ECHOUEE` (inclut `natureEchec`)

## Distinction des couches

| Couche | Responsabilité |
|--------|----------------|
| Protocole | vérité économique, `DEPENSE_COMPUTE` |
| Xway | autorisation, réservation, mesure, coût |
| Contrôleur | budget, politique, écriture registre |
| Dashboard | observation |

## Configuration

Section `xway` dans `experiences/*.json`, figée dans `EXPERIENCE_CREEE`.

## Futur provider réel

Un futur adaptateur OpenAI/Anthropic implémentera `FournisseurInference`
sans changer le contrat d'autorisation ni le chemin `DEPENSE_COMPUTE`.
Aucune clé API dans le protocole.
Réconciliation explicite requise en cas de `resultat_indetermine`.
