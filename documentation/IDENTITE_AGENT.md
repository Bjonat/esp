# Identité agent ESP v0.1

## Objectif

Chaque agent ESP possède :

1. une **identité logique** (`identifiantAgent`) ;
2. une **identité cryptographique Ed25519** indépendante de toute blockchain.

Invariant fondamental :

```
CLE_IDENTITE_ESP ≠ CLE_WALLET_SOLANA
```

La clé d'identité ESP ne doit **jamais** être réutilisée comme clé financière.

## Rôles

| Couche | Rôle |
|--------|------|
| Registre | source de vérité du lien agent → clé **publique** |
| Keystore local | capacité de signature (clé **privée**) |
| SignataireAgent | signe des messages canoniques — ne révèle jamais la privée |
| Xway | authentifie (publique + signature) avant autorisation économique |

## Stockage privé

Chemin de développement :

```
data/developpement/identites/{experience}/{agent}.ed25519.pkcs8
```

- répertoire `0700` ;
- fichier `0600` ;
- **hors Git** (`data/` ignoré) ;
- **jamais** dans le registre, SQLite d'événements, API, dashboard, logs, prompts.

### Limite v0.1

Stockage local **non chiffré** avec permissions OS.
**Insuffisant pour Live.** Vault / HSM / KMS hors périmètre.

## Événement registre

`IDENTITE_AGENT_ENREGISTREE` contient uniquement :

- `identifiantAgent` ;
- `algorithme = ed25519` ;
- `clePubliqueBase64Url` ;
- `empreinteClePublique` (SHA-256 hex) ;
- `versionIdentite`.

Aucune clé privée.

## Genesis

Si `identite.active` est figé dans `EXPERIENCE_CREEE` :

```
AGENT_CREE → génération Ed25519 (CSPRNG) → keystore → IDENTITE_AGENT_ENREGISTREE
```

La création d'identité ne crée ni revenu, ni capital, et n'affecte pas la VEN.

Expériences legacy **sans** section `identite` : lecture OK, statut `non_configuree`,
**aucune** génération a posteriori.

## Déterminisme vs cryptographie

Les clés **ne sont jamais** dérivées de `graineSimulation` / identifiants publics.

Conséquence : deux runs déterministes peuvent avoir des clés différentes.
Cela ne doit **pas** modifier les résultats économiques.

## Signature Xway

Domaine explicite :

```
ESP-XWAY-INFERENCE-V1
```

Message canonique (champs ordonnés, pas de JSON arbitraire) :

- domaine / version ;
- expérience, agent, demande, cycle ;
- modèle, limite de dépense, max jetons ;
- empreinte du contenu (messages).

Une signature Xway ne doit pas être réutilisable pour un futur paiement.

Enveloppe :

```
DemandeInferenceSignee { demande, clePubliqueBase64Url, signatureBase64Url }
```

## Authentification Xway

Ordre :

```
DEMANDE → AUTH → AUTORISATION → RÉSERVATION → FOURNISSEUR
```

Xway vérifie que la clé présentée = clé **enregistrée** pour l'agent
(ne fait pas confiance à la seule clé de la requête).

Signature invalide / usurpation :

- aucune réservation ;
- aucun fournisseur ;
- aucun `DEPENSE_COMPUTE`.

## Perte de clé

Si le registre connaît une publique mais le keystore n'a plus la privée :

- **échec fermé** ;
- **aucune** régénération silencieuse ;
- l'agent reste historiquement présent ;
- signature impossible ;
- Xway non consommé pour de nouvelles demandes.

## Modèle de menace v0.1

Couvert :

- usurpation par une autre paire Ed25519 ;
- altération post-signature ;
- double consommation (via idempotence `identifiantDemande`) ;
- fuite de privée via registre / API / dashboard.

Non couvert :

- compromission du filesystem local ;
- attaquant root ;
- rotation / récupération de clés ;
- canal réseau (Xway encore in-process).

## Avant un provider IA réel

1. Le LLM ne doit jamais voir ni manipuler la clé privée.
2. Intention LLM → code de confiance → `SignataireAgent` local.
3. Stockage Live : chiffrement au repos / HSM / Vault.
4. Xway réseau : transport authentifié en plus de la signature de demande.
