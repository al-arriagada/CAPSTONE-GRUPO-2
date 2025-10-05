// src/hooks/useMyPets.js
import { useEffect, useRef, useState, useCallback } from "react";
import { listMyPets, archivePet, restorePet } from "../services/pets";
import { useAuth } from "../context/AuthContext.jsx";

export default function useMyPets({ includeArchived = false, search = "" } = {}) {
  const { user } = useAuth();

  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);     // solo 1ª vez
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(includeArchived);
  const [searchText, setSearchText] = useState(search);

  const didLoad = useRef(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) { setPets([]); setLoading(false); return; }
    setRefreshing(true);
    try {
      const data = await listMyPets(user.id, {
        includeArchived: showArchived,
        search: searchText.trim(),
      });
      if (alive.current) setPets(data);
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [user?.id, showArchived, searchText]);

  useEffect(() => {
    alive.current = true;
    const run = async () => {
      if (!user) { setPets([]); setLoading(false); return; }
      if (!didLoad.current) setLoading(true);
      await refresh();
      if (alive.current) {
        setLoading(false);
        didLoad.current = true;
      }
    };
    run();
    return () => { alive.current = false; };
    // se relanza cuando cambia el usuario, el toggle o el search
  }, [user?.id, showArchived, searchText, refresh]);

  const archive = useCallback(async (petId) => {
    if (!user) return;
    await archivePet(petId, user.id);
    await refresh();
  }, [user?.id, refresh]);

  const restore = useCallback(async (petId) => {
    if (!user) return;
    await restorePet(petId, user.id);
    await refresh();
  }, [user?.id, refresh]);

  return {
    pets,
    loading,
    refreshing,
    // controles
    showArchived,
    setShowArchived,
    searchText,
    setSearchText,
    // acciones
    refresh,
    archive,
    restore,
  };
}
