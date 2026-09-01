import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen grain-bg flex items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500 animate-pulse">
          Loading treasury…
        </div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}
