// src/router.jsx
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";      // Navbar + contenido privado
import PublicLayout from "./components/PublicLayout.jsx"; // Navbar
import HomePublic from "./components/HomePublic.jsx";
import HomePrivate from "./components/Home.jsx";
import Signin from "./components/Signin.jsx";
import Signup from "./components/Signup.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import UpdatePassword from "./components/UpdatePassword.jsx";
import RedirectIfAuth from "./components/RedirectIfAuth.jsx";
import PetForm from "./components/PetForm.jsx";
import OwnerProfile from "./components/OwnerProfile.jsx";
import PetDetail from "./components/PetDetail.jsx";      // ⬅️ NUEVO
import EventoLog from "./components/EventLog.jsx";
import RedirectAuthHome from "./components/RedirectAuthHome.jsx";
import ProtectedRouteByRole from "./components/ProtectedRouteByRole.jsx";
import VetDashboard from "./components/vet/VetDashboard.jsx";

const router = createBrowserRouter([
  // Rutas públicas
  {
    path: "/",
    element: <RedirectAuthHome><PublicLayout /></RedirectAuthHome> ,
    children: [{ index: true, element: <HomePublic /> }],
  },
  {
    path: "/signin",
    element: (
      <RedirectAuthHome>
        <Signin />
      </RedirectAuthHome>
    ),
  },
  {
    path: "/signup",
    element: (
      <RedirectAuthHome>
        <Signup />
      </RedirectAuthHome>
    ),
  },

  // Rutas privadas (/app)
  {
    path: "/app",
    element: <ProtectedRouteByRole allowedRoles={["owner"]}> <AppLayout /> </ProtectedRouteByRole>,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <HomePrivate /> {/* dashboard */}
          </ProtectedRoute>
        ),
      },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <OwnerProfile />
          </ProtectedRoute>
        ),
      },
      {
        path: "pets/new",
        element: (
          <ProtectedRoute>
            <PetForm /> {/* modo crear */}
          </ProtectedRoute>
        ),
      },
      {
        path: "pets/:id",
        element: (
          <ProtectedRoute>
            <PetDetail /> {/* detalle */}
          </ProtectedRoute>
        ),
      },
      {
        path: "pets/:id/edit",
        element: (
          <ProtectedRoute>
            <PetForm mode="edit" /> {/* modo edición */}
          </ProtectedRoute>
        ),
      },
      // aquí podrás agregar: citas, historial, etc.
      {
        path: "pets/:id/eventlog",
        element: (
          <ProtectedRoute>
            <EventoLog /> {/* historial de eventos */}
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/vet",
    element: (
      <ProtectedRouteByRole allowedRoles={["vet"]}>
        <AppLayout />
      </ProtectedRouteByRole>
    ),
    children: [
      { index: true, element: <VetDashboard /> },
            {
        path: "profile",
        element: (
          <ProtectedRoute>
            <OwnerProfile />
          </ProtectedRoute>
        ),
      },
      // { path: "pets/:petId", element: <VetPetDetail /> }, // cuando lo tengas
    ],
  },
  // Reset / Update Password
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/update-password", element: <UpdatePassword /> },

  // 404 opcional
  {
    path: "*",
    element: <div className="p-6 text-center text-gray-600">Página no encontrada</div>,
  },
]);

export default router;
