import { lazy } from "react";
import { Routes, Route, Link } from "react-router-dom";
import RoleGuard from "./components/RoleGuard";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

const AssetList = lazy(() => import("./pages/AssetList"));
const AssetNew = lazy(() => import("./pages/AssetNew"));
const AssetPassport = lazy(() => import("./pages/AssetPassport"));
const Scan = lazy(() => import("./pages/Scan"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Ask = lazy(() => import("./pages/Ask"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Graph = lazy(() => import("./pages/Graph"));

const NotFound = () => (
  <div className="py-16 text-center">
    <h1 className="text-xl font-extrabold">Page not found</h1>
    <Link to="/" className="mt-2 inline-block text-indigo-600 underline">Go to dashboard</Link>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RoleGuard><Layout /></RoleGuard>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assets" element={<AssetList />} />
        <Route path="/assets/new" element={<RoleGuard roles={["admin"]}><AssetNew /></RoleGuard>} />
        <Route path="/asset/:id" element={<AssetPassport />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/transfers" element={<RoleGuard roles={["admin", "faculty"]}><Transfers /></RoleGuard>} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/alerts" element={<RoleGuard roles={["admin", "faculty"]}><Alerts /></RoleGuard>} />
        <Route path="/graph" element={<Graph />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}