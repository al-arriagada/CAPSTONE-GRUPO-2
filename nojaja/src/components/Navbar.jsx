// src/components/Navbar.jsx
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  console.log('Navbar se está renderizando') // ← Añade esta línea
  const { user } = useAuth()

  return (
    <nav
      style={{
        background: 'red',
        color: 'white',
        padding: '1rem',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 9999, // Aumentamos el z-index
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Agregamos sombra para que se vea mejor
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Noaja</Link>
        </div>
        <div>
          {user ? (
            <span>Hola, {user.email}</span>
          ) : (
            <Link to="/signin" style={{ color: 'white', textDecoration: 'none' }}>Iniciar sesión</Link>
          )}
        </div>
      </div>
    </nav>
  )
}