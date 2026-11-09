import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ConnectedApp } from "./ConnectedApp";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConnectedApp />
  </StrictMode>,
);
