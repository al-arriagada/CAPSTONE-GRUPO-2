import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";      // Navbar + contenido privado
import PublicLayout from "./components/PublicLayout.jsx"; // Navbar
import HomePublic from "./components/HomePublic.jsx";
import HomePrivate from "./components/Home.jsx";          // tu dashboard
import Signin from "./components/Signin.jsx";
import Signup from "./components/Signup.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import UpdatePassword from "./components/UpdatePassword.jsx";
import RedirectIfAuth from "./components/RedirectIfAuth.jsx";
import PetForm from "./components/PetForm.jsx";

const router = createBrowserRouter([
  // Rutas públicas
  {
    path: "/",
    element: <PublicLayout />,   // Navbar puede ser el mismo; funciona sin user
    children: [{ index: true, element: <HomePublic /> }],
  },
  { path: "/signin", element:( 
      <RedirectIfAuth>
        <Signin />
      </RedirectIfAuth>   
      )},
  { path: "/signup", element: (
      <RedirectIfAuth>
        <Signup />
      </RedirectIfAuth>
      ) },

  // Rutas privadas
  {
    path: "/app",
    element: <AppLayout />,      // Navbar + <Outlet/> (privado)
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <HomePrivate />      {/* tu dashboard actual */}
          </ProtectedRoute>
        ),
      },
      {
        path: "pets/new", element: <ProtectedRoute><PetForm /></ProtectedRoute>
      },
      // más rutas privadas: citas, historial, etc.
    ],
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/update-password",
    element: <UpdatePassword />,
  },
]);

export default router;
