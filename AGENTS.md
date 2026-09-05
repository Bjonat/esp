# ESP — Instructions permanentes du projet

## Langue du projet

Tout le code métier que nous contrôlons DOIT être écrit en français.

Cela concerne notamment :
- fonctions ;
- variables ;
- classes ;
- interfaces ;
- types métier ;
- événements métier ;
- tests ;
- commentaires ;
- documentation technique interne.

Les identifiants utilisent le français sans accents.

Exemples :
- creerAgent
- enregistrerEvenement
- calculerValeurEconomiqueNette
- verifierEtatSurvie
- coutInference
- capitalLiquide
- identifiantParent
- arbreGenealogique

Les noms imposés par une bibliothèque, une API ou un protocole externe restent inchangés à leur frontière externe.

## Objet du projet

ESP est un système expérimental greenfield destiné à étudier l'évolution économique d'agents autonomes soumis à de vraies contraintes de ressources.

Le système doit permettre d'étudier :
- survie ;
- capital ;
- dépenses ;
- compute ;
- information ;
- activité économique ;
- reproduction ;
- héritage ;
- mutation ;
- lignées ;
- fitness ;
- autofinancement ;
- redevances propriétaire.

Le premier environnement économique visé est Solana, avec SOL/USDC en spot.

Le coeur ESP NE DOIT toutefois dépendre d'aucune blockchain particulière.

## Architecture

Séparer strictement :

1. Protocole ESP
   - invariants ;
   - survie ;
   - reproduction ;
   - héritage ;
   - mutation ;
   - fitness.

2. Moteur Agent
   - identité ;
   - boucle ;
   - mémoire ;
   - comportement ;
   - décisions ;
   - outils.

3. Registre d'événements
   - append-only ;
   - auditable ;
   - reconstructible.

4. Xway
   - authentification ;
   - ressources ;
   - inference gateway ;
   - compute ;
   - données ;
   - accounting ;
   - metering.

5. Adaptateurs d'environnement
   - Replay ;
   - Shadow ;
   - Live ;
   - Solana comme premier environnement.

6. Contrôleur d'expérience
   - configuration ;
   - population ;
   - phases ;
   - epochs ;
   - observation expérimentale.

7. Dashboard
   - population ;
   - arbre généalogique ;
   - fiches agents ;
   - décisions ;
   - activité ;
   - portefeuille ;
   - coûts ;
   - lignées ;
   - redevances ;
   - rentabilité système.

## Invariants économiques

Toute consommation économiquement pertinente DOIT être attribuée exactement une fois.

Les coûts réels ou imputés DOIVENT être auditables.

Les transferts internes entre agents et les sorties de valeur vers l'extérieur DOIVENT être distingués.

La valeur économique, les ressources prépayées et la capacité opérationnelle NE DOIVENT PAS être confondues.

Une naissance NE DOIT PAS créer artificiellement de valeur économique.

Un agent mort NE DOIT PAS redevenir vivant dans une expérience conforme.

## Redevances propriétaire

Le système devra permettre de distinguer :
- coûts variables de l'agent ;
- coût d'infrastructure ;
- loyer ou redevance fixe ;
- partage éventuel de nouveau profit ;
- revenus propriétaire ;
- coûts infrastructure ;
- marge propriétaire.

Ces paramètres sont des paramètres expérimentaux versionnés.

## Sécurité

Aucun secret ne doit être commité.

Aucune clé privée ne doit être exposée au LLM.

L'identité cryptographique de l'agent doit être distincte de ses wallets financiers.

Replay, Shadow et Live doivent être strictement séparés.

Aucune transaction réelle ne doit être exécutée par défaut.

Le code de développement ne doit jamais modifier directement /opt/esp-dashboard.

## Qualité

- TypeScript strict.
- pnpm.
- Tests automatisés.
- Lint.
- Typecheck.
- Build reproductible.
- CI GitHub obligatoire.

Les fonctions métier critiques doivent avoir des tests.

Ne jamais désactiver ou contourner un test simplement pour obtenir une CI verte.

## Git

main représente une version intégrable et déployable.

Le développement se fait sur des branches dédiées.

Ne jamais réécrire l'historique partagé.

Ne pas pousser ni merger automatiquement sans instruction explicite.

## Méthode Cursor

Avant une modification architecturale importante :

1. lire AGENTS.md ;
2. analyser l'existant ;
3. expliciter les invariants concernés ;
4. proposer le plan ;
5. seulement ensuite implémenter.

Ne jamais inventer silencieusement une règle économique ou expérimentale absente des spécifications.
