STATUS
Evaluation v0.1 exécutée et techniquement valide,
mais H2 / adaptation non interprétables pour défaut
de couplage génotype → phénotype dans la campagne.

CAUSE
fabriquerConfigurationRun force mode="simulation".

EFFET
- mutations bien produites
- configurations héritables bien différentes
- aucune branche décision_simulee exécutée
- 0 événements décision agent sur 80 runs
- Xway piloté par politique-cognitive-developpement
  indépendante des gènes

PREUVES
80 runs simulation
0 événement décision
132 mutations D
Xway B=C=D=10291
D-C nul hors métriques génétiques

CONCLUSIONS
H1 soutenue
H2 non évaluée
H3 descriptive soutenue
adaptation économique non évaluée

ACTION
v0.2 devra inclure un contrôle positif obligatoire
génotype → politique → choix → décision avant évaluation.

Voir documentation/COUPLAGE_GENOTYPE_PHENOTYPE_V02.md.
