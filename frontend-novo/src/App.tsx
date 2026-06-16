import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { getSession } from "./api";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cartoes from "./pages/Cartoes";
import Compromissos from "./pages/Compromissos";
import Investimentos from "./pages/Investimentos";
import Lancamentos from "./pages/Lancamentos";
import Simulador from "./pages/Simulador";

function ProtectedRoute() {
  return getSession() ? <AppLayout /> : <Navigate to="/auth" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/cartoes" element={<Cartoes />} />
          <Route path="/compromissos" element={<Compromissos />} />
          <Route path="/investimentos" element={<Investimentos />} />
          <Route path="/simulador" element={<Simulador />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
