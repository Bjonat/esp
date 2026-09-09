/**
 * Génère experiences/protocoles/evolution-evaluation-v02.json
 * depuis la calibration e1-01 (dérivation déterministe).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriverProtocoleEvaluationV02DepuisObjetCalibration } from "../src/deriver-protocole-evaluation-v02.js";
import {
  chargerProtocoleEvolutionV02DepuisObjet,
  empreinteProtocoleV02,
} from "../src/protocole-evolution-v02.js";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "../../..");
const cheminCalib = join(
  racine,
  "experiences/protocoles/evolution-calibration-v02-e1-01.json",
);
const cheminEval = join(
  racine,
  "experiences/protocoles/evolution-evaluation-v02.json",
);

const calib = JSON.parse(readFileSync(cheminCalib, "utf8")) as unknown;
const evalJson = deriverProtocoleEvaluationV02DepuisObjetCalibration(calib);
const avecCommentaire = {
  _commentaire: [
    "Protocole d'évaluation évolution multi-génération ESP v0.2 — FIGÉ, NON EXÉCUTÉ.",
    "Dérivé déterministiquement de evolution-calibration-v02-e1-01 (environnement E2 retenu).",
    "Voir documentation/PREENREGISTREMENT_EVOLUTION_V02.md et freeze-evolution-evaluation-v02.json.",
    "Seeds evaluation 2001..2020 réservées — INTERDICTION d'exécuter avant audit freeze complet.",
    "Fournisseur simulé uniquement — aucun OpenAI / Live / Solana / réseau.",
  ],
  ...evalJson,
};

writeFileSync(cheminEval, `${JSON.stringify(avecCommentaire, null, 2)}\n`);
const parse = chargerProtocoleEvolutionV02DepuisObjet(evalJson);
const emp = empreinteProtocoleV02(parse);
console.log(emp);
console.log(parse.seedsEvaluation.join(","));
