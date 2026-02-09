import { Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/Dashboard";
import ImportPage from "./pages/Import";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/import" element={<ImportPage />} />
    </Routes>
  );
}
