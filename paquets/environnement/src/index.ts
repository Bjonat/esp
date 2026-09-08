export type {
  EnvironnementEconomique,
  ModeEnvironnement,
  StatutEnvironnement,
} from "./environnement.js";
export { creerEnvironnementInactif } from "./environnement.js";

export type {
  ConfigurationEnvironnementOpportunites,
  ConfigurationEnvironnementOpportunitesJson,
  IssueActionEnvironnement,
  ResultatActionEnvironnement,
} from "./opportunites-simulees.js";
export {
  EnvironnementOpportunitesSimulees,
  IDENTIFIANT_ENVIRONNEMENT_OPPORTUNITES_SIMULEES,
  VERSION_ENVIRONNEMENT_OPPORTUNITES_SIMULEES,
  creerEnvironnementOpportunitesSimulees,
  parserConfigurationEnvironnementOpportunites,
  serialiserConfigurationEnvironnementOpportunites,
} from "./opportunites-simulees.js";
