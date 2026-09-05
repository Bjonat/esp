import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TableauDeBord } from "./TableauDeBord.js";
import "./styles.css";

const racine = document.getElementById("racine");

if (!racine) {
  throw new Error("Élément racine introuvable");
}

createRoot(racine).render(
  <StrictMode>
    <TableauDeBord />
  </StrictMode>,
);
