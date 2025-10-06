// src/App.jsx
import { RouterProvider } from "react-router-dom";
import router from "./router";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router}>
        {/* Barra fija en la parte superior */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            background: 'red',
            color: 'white',
            padding: '1rem',
            zIndex: 9999,
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}
        >
          ¡ESTE ES EL NAVBAR! (PRUEBA)
        </div>

        {/* Espacio para el contenido de las rutas */}
        <div style={{ marginTop: '80px' }}>
          {/* Las rutas se renderizarán aquí */}
        </div>
      </RouterProvider>
    </AuthProvider>
  );
}

export default App;