// src/router.jsx
import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/AppLayout.jsx";
import Home from "./components/Home.jsx";
import Signin from "./components/Signin.jsx";
import Signup from "./components/Signup.jsx";
import Dashboard from "./components/Dashboard.jsx"; // si lo usas aparte
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const router = createBrowserRouter([
  { path: "/signin", element: <Signin /> },
  { path: "/signup", element: <Signup /> },
  {
    path: "/",
    element: <AppLayout />,           // <- Navbar vive aquí
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Home />                   {/* <- Página de inicio SOLO si está logeado */}
          </ProtectedRoute>
        ),
      },
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default router;
