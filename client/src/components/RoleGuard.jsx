import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function RoleGuard({ roles, children }) {
  const { user, loading, waking } = useAuth();
  const location = useLocation();

  if (loading)
  return (
    <div className="grid min-h-screen place-items-center p-10 text-center text-slate-500">
      <div>
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        {waking ? "Waking the server up. This can take up to a minute on the free plan..." : "Loading..."}
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return <div className="p-10 text-red-600">You don't have access to this page.</div>;
  return children;
}