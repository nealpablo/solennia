import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./style.css";

// ✅ Firebase init (required for Chat / firebase-chat.js)
import { initFirebase } from "./firebase";

// Initialize Firebase once at app startup
initFirebase();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
