import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "./lib/swRegistration";

createRoot(document.getElementById("root")!).render(<App />);

registerSW();
