import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/Boundary.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("thiếu phần tử #root trong index.html");

ReactDOM.createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
