# Fournisseur IA réel ESP v0.1 — adaptateur OpenAI

## Objectif

Permettre à un agent ESP authentifié d'effectuer une **vraie** inférence IA via Xway,
tout en restant dans une **économie / activité externe simulée**.

Chaîne :

```
AGENT → demande signée → AUTH Ed25519 → autorisation économique
      → réservation cognitive → FournisseurInferenceOpenAi
      → Responses API → usage mesuré → coût imputé agent
      → DEPENSE_COMPUTE unique → registre → dashboard
```

Aucun trading, wallet, Solana, Jupiter.

## Frontière architecturale

```
@esp/xway          — contrat générique FournisseurInference (aucun SDK OpenAI)
        ↑
@esp/adaptateur-openai — FournisseurInferenceOpenAi + SDK Responses
        ↓
API OpenAI
```

Le fournisseur simulé (`fournisseur-inference-simule`) reste le **défaut**.

## Clé API

Variable d'environnement processus uniquement :

```
OPENAI_API_KEY
```

Jamais dans : repo, `experiences/*.json`, `EXPERIENCE_CREEE`, SQLite, événements,
API dashboard, logs, prompts agent, données métier Xway.

Absente → fail closed, **aucun réseau**.

`.env` / `.env.*` sont gitignored (voir `.env.exemple`).

## Opt-in

```yaml
xway:
  fournisseur: simule | openai   # défaut profil dev = simule
```

Exemple non actif : `experiences/developpement-openai-v01.exemple.json`.

Quand `fournisseur=openai`, le bouton **Avancer d'un cycle** n'appelle **pas**
OpenAI automatiquement. Seules les commandes volontaires le font.

## Modèle v0.1

| Couche | Identifiant |
|--------|-------------|
| Logique ESP | `luna_reel_v01` |
| Externe OpenAI | `gpt-5.6-luna` |

Pas de routeur multi-modèles.

## API utilisée

OpenAI **Responses** (`POST /v1/responses` via `client.post`, pas `responses.create` typé) :

- `max_output_tokens` borné ;
- `reasoning.effort = "none"` (valeur API Luna documentée) ;
- `tools: []` (aucun tool / web / file / computer / image) ;
- sortie structurée : `text.format = { type: "json_schema", name, schema, strict: true }` ;
- `store: false`.

### Extraction de sortie (critique)

`client.post("/responses")` **n'applique pas** `addOutputText` du SDK
(contrairement à `responses.create` / `responses.parse`).  
L'adaptateur reconstruit donc le texte depuis `output[].content[].text`
(équivalent local de `output_parsed`, sans dépendance Zod).

États explicites de sortie structurée (≠ facturation) :

- `resultat_fournisseur_complet`
- `resultat_fournisseur_incomplet` (ex. `incomplete_details.reason = max_output_tokens`)
- `refus_fournisseur`
- `sortie_structuree_invalide`

Une consommation mesurée reste facturable même si la proposition métier est invalide.

### Écart SDK / API (effort)

L'API `gpt-5.6-luna` documente : `none | low | medium | high | xhigh | max`.  
Le type `ReasoningEffort` de `openai@5.x` n'inclut que `minimal | low | medium | high | null`.

ESP envoie `"none"` dans le corps HTTP construit à la frontière adaptateur
(`construireCorpsRequeteResponses`) et l'expédie via `client.post("/responses", { body })`,
sans cast vers le type SDK trop étroit.

TEXTE → TEXTE uniquement.

## Barème figé

`BaremeCoutInference` est figé dans `EXPERIENCE_CREEE` :

- fournisseur, modèle logique/externe, `versionBareme` ;
- devise `USD` ;
- coûts par million de jetons (entrée / **cache** / sortie) en **micro-USD** ;
- date de référence informative.

Changer le JSON après création **ne modifie pas** une expérience existante.
Aucun appel dynamique aux prix OpenAI pendant l'expérience.

### Jetons cachés

OpenAI `input_tokens` = total entrée ; `cached_tokens` ⊆ total (sous-ensemble).

| Couche | Règle |
|--------|--------|
| Agent (`TarifModeleInference`) | total entrée une seule fois au tarif entrée (pas de double comptage) |
| Fournisseur (`BaremeCoutInference`) | non-cache × tarif entrée + cache × tarif cache + sortie × tarif sortie |

## Coût agent vs coût fournisseur

| Champ | Unité | Rôle |
|-------|-------|------|
| `coutImputeAgentMicroUsdc` | micro-USDC | protocole ESP → `DEPENSE_COMPUTE` |
| `coutFournisseurEstimeMicroUsd` | micro-USD | ESTIMATION FOURNISSEUR (observabilité) |

USD ≠ USDC comptablement. Pas d'alias implicite.

L'estimation fournisseur n'est **pas** une facture exacte.

## Estimation avant appel

Borne conservatrice d'entrée : `ceil(longueurUTF16 / 2) + 8` par message.
Garantit `coutFinalImpute <= reservation`. Jamais sous-estimer volontairement.

## Surconsommation

Si usage mesuré ⇒ coût agent > réservation :

- **aucun** débit au-delà ;
- `RESULTAT_INDETERMINE` + détail système ;
- réservation conservée pour réconciliation.

## États réseau

| Cas | Nature | Réservation |
|-----|--------|-------------|
| Erreur avant envoi certain | `echec_certain` | libérée |
| Timeout / ambiguïté post-envoi | `resultat_indetermine` | conservée |
| Réponse complète | `EXECUTEE` | réglée (`coutFinal`) |

Aucune relance automatique d'une demande ambiguë.

## Idempotence

États `EXECUTEE` / `REFUSEE` / `RESULTAT_INDETERMINE` : pas de second appel
fournisseur sous le même `identifiantDemande`.
L'idempotence externe OpenAI (metadata) est optionnelle et non dépendante.

## Plafond propriétaire réel

`plafondDepenseFournisseurReelleMicroUsd` — circuit breaker **indépendant**
des budgets agents / VEN / crédit Xway.

Atteint → refus `plafond_fournisseur_reel_atteint`.

## Projection infrastructure

`CoutsInfrastructureExterne` (estimation cumulée, nombre d'appels) —
séparée de `TresorerieProprietaire` (fusion comptable future).

## Commandes volontaires

```bash
# Aperçu sans appel (aucune clé requise)
pnpm test:inference-reelle -- --agent agent-000

# Fournir la clé sans la laisser dans l'historique shell
read -rsp "OPENAI_API_KEY: " OPENAI_API_KEY
echo
export OPENAI_API_KEY

# Appel réel (1 requête)
pnpm test:inference-reelle -- --agent agent-000 --executer

# Nettoyage
unset OPENAI_API_KEY
```

Ne jamais préférer `OPENAI_API_KEY=… pnpm …` (fuite possible dans l'historique shell).

## Smoke test

`smoke-openai-manuel.test.ts` — ignoré sauf si les deux conditions sont réunies
après export manuel de la clé :

```bash
read -rsp "OPENAI_API_KEY: " OPENAI_API_KEY
echo
export OPENAI_API_KEY
export ESP_SMOKE_OPENAI=1
pnpm test
unset OPENAI_API_KEY
unset ESP_SMOKE_OPENAI
```

## Dashboard

- Libellé `FOURNISSEUR : SIMULÉ` ou `OPENAI RÉEL` ;
- Bannière si réel : « INFÉRENCE IA RÉELLE — environnement économique toujours simulé » ;
- Métriques : modèle, jetons, coût imputé ESP, estimation fournisseur, latence, proposition ;
- Jamais « argent réel de l'agent ».

## Moteur de décision

Le moteur de décision agent v0.1 peut consommer ce même adaptateur OpenAI
en opt-in manuel (`pnpm test:decision-reelle -- --executer`) :

observation → politique cognitive → Xway → `FournisseurInferenceOpenAi`
→ proposition → validation → action **environnement simulé** → noyau.

Voir [`MOTEUR_DECISION_AGENT.md`](./MOTEUR_DECISION_AGENT.md).
`avancer` ne déclenche jamais OpenAI.

## Limites v0.1

- Un seul modèle réel ;
- Pas Anthropic / Gemini / routing ;
- Pas de tool calling / RAG / mémoire avancée ;
- Pas de fusion TresorerieProprietaire ↔ coûts OpenAI ;
- Politique cognitive de développement **désactivée** en auto si openai
  (décision future avant remplacement).
