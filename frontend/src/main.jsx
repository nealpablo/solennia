import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./style.css";

/* =========================
   FIREBASE INITIALIZATION
   (REQUIRED FOR AUTH + CHAT)
========================= */
import { initFirebase } from "./firebase";

/*
  ✅ Initialize Firebase ONCE
  - Required before:
    - signInWithEmailAndPassword
    - createUserWithEmailAndPassword
    - firebase-chat.js
*/
initFirebase();

/* =========================
   RENDER APPLICATION
========================= */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
