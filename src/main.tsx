import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("[uncaught error]", {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
    error: event.error,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandled promise rejection]", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
