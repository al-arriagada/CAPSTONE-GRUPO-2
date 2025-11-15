import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
