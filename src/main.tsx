import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { LiveApp } from "./LiveApp";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const content = convexUrl ? (
  <ConvexProvider client={new ConvexReactClient(convexUrl)}>
    <LiveApp />
  </ConvexProvider>
) : (
  <App />
);

createRoot(root).render(<StrictMode>{content}</StrictMode>);
