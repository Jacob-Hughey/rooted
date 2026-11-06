import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { AppShell } from "@/components/AppShell";
import SignIn from "@/pages/SignIn";
import Today from "@/pages/Today";

const Plants = lazy(() => import("@/pages/Plants"));
const PlantDetail = lazy(() => import("@/pages/PlantDetail"));
const NewPlant = lazy(() => import("@/pages/NewPlant"));
const EditPlant = lazy(() => import("@/pages/EditPlant"));
const ArchivedPlants = lazy(() => import("@/pages/ArchivedPlants"));
const Rooms = lazy(() => import("@/pages/Rooms"));
const Settings = lazy(() => import("@/pages/Settings"));

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <div className="min-h-dvh bg-background" />;
  if (!session) return <SignIn />;

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Today />} />
            <Route path="plants" element={<Plants />} />
            <Route path="plants/new" element={<NewPlant />} />
            <Route path="plants/archived" element={<ArchivedPlants />} />
            <Route path="plants/:id" element={<PlantDetail />} />
            <Route path="plants/:id/edit" element={<EditPlant />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
