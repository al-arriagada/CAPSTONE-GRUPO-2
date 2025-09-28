import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";      // Navbar + contenido privado
import PublicLayout from "./components/PublicLayout.jsx"; // Navbar (mismo) o más simple
import HomePublic from "./components/HomePublic.jsx";
import HomePrivate from "./components/Home.jsx";          // tu dashboard
import Signin from "./components/Signin.jsx";
import Signup from "./components/Signup.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const router = createBrowserRouter([
  // Rutas públicas
  {
    path: "/",
    element: <PublicLayout />,   // Navbar puede ser el mismo; funciona sin user
    children: [{ index: true, element: <HomePublic /> }],
  },
  { path: "/signin", element: <Signin /> },
  { path: "/signup", element: <Signup /> },

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
      // más rutas privadas: citas, historial, etc.
    ],
  },
]);

export default router;
