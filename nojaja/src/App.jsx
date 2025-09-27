// src/App.jsx
import { RouterProvider } from "react-router-dom";
import router from "./router";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router}>
        <div className="min-h-screen flex flex-col">
          <Navbar /> {/* ✅ Siempre visible */}
          <main className="flex-grow">
            {/* Las rutas se renderizarán aquí */}
          </main>
        </div>
      </RouterProvider>
    </AuthProvider>
  );
}

export default App;