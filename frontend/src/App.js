import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Market from "@/pages/Market";
import CompanyDetail from "@/pages/CompanyDetail";
import Entities from "@/pages/Entities";
import Alerts from "@/pages/Alerts";
import Watchlist from "@/pages/Watchlist";
import Team from "@/pages/Team";
import AIAnalystPage from "@/pages/AIAnalystPage";
import DashboardLayout from "@/components/DashboardLayout";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="entities" element={<Entities />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="analyst" element={<AIAnalystPage />} />
              <Route path="market" element={<Market />} />
              <Route path="watchlist" element={<Watchlist />} />
              <Route path="team" element={<Team />} />
              <Route path="company/:cid" element={<CompanyDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-right" />
      </AuthProvider>
    </div>
  );
}

export default App;
