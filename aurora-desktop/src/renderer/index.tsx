import React from "react";
import { createRoot } from "react-dom/client";
import AuroraApp from "./AuroraApp";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root não encontrado em index.html");

createRoot(container).render(
  <React.StrictMode>
    <AuroraApp />
  </React.StrictMode>
);
