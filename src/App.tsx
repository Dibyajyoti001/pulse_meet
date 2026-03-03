import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import AuthPage from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RoomPage from "./pages/Room";
import Protected from "./components/Protected";
import Shell from "./components/Shell";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/app"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/room/:slug"
          element={
            <Protected>
              <RoomPage />
            </Protected>
          }
        />
        <Route
          path="*"
          element={
            <Shell>
              <div className="glass rounded-2xl p-6 shadow-soft">
                <div className="text-2xl font-extrabold">404</div>
                <div className="mt-2 text-slate-300">Page not found.</div>
              </div>
            </Shell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
