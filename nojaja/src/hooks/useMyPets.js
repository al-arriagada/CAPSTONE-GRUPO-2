// src/hooks/useMyPets.js
import { useEffect, useRef, useState } from "react";
import { listMyPets } from "../services/pets";
import { useAuth } from "../context/AuthContext.jsx";

export default function useMyPets() {
  const { user } = useAuth();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);     // solo 1ª vez
  const [refreshing, setRefreshing] = useState(false);
  const didLoad = useRef(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!user) { setPets([]); setLoading(false); return; }

      if (!didLoad.current) setLoading(true);
      else setRefreshing(true);

      try {
        const data = await listMyPets(user.id);
        if (active) setPets(data || []);
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
          didLoad.current = true;
        }
      }
    };

    run();
    // solo si cambia el id del usuario (no por re-renders o tabs)
  }, [user?.id]);

  return { pets, loading, refreshing };
}