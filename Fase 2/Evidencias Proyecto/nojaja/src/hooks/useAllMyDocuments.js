import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function useAllMyDocuments() {
  // --- CAMBIO 1: Obtener 'loadingSession' de useAuth ---
  const { user, loadingSession } = useAuth();
  
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllDocuments = useCallback(async () => {
    
    // --- CAMBIO 2: Añadir la lógica de espera ---

    // 1. Si AuthContext sigue "Cargando...", no hacer nada.
    if (loadingSession) {
      return; // Espera a que la sesión cargue
    }

    // 2. Si AuthContext terminó, PERO no hay usuario.
    if (!user) {
      setLoading(false);
      setDocuments([]); // Aseguramos que esté vacío
      return;
    }
    
    // 3. Si llegamos aquí, loadingSession=false y user=existe.
    //    ¡Es seguro cargar los datos!
    setLoading(true);
    setError(null);

    try {
      // 1. Obtener los IDs de todas las mascotas del usuario
      const { data: pets, error: petsError } = await supabase
        .schema("petcare")
        .from('pet')
        .select('pet_id')
        .eq('user_id', user.id);

      if (petsError) throw petsError;

      const petIds = pets.map(p => p.pet_id);

      if (petIds.length === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      // 2. Obtener todos los documentos que pertenecen a esas mascotas
      const { data: docs, error: docsError } = await supabase
        .schema('petcare')
        .from('document')
        .select(`
          *,
          pet:owner_pet_id ( name )
        `)
        .in('owner_pet_id', petIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;
      
      // 3. Enriquecer los documentos con su URL pública para la descarga
      const enrichedDocuments = (docs || []).map(doc => {
        const { data: { publicUrl } } = supabase.storage
          .from("pet-documents")
          .getPublicUrl(doc.storage_path);
        return {
          ...doc,
          public_url: publicUrl
        };
      });

      setDocuments(enrichedDocuments);

    } catch (err) {
      console.error("Error cargando todos los documentos:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  
  // --- CAMBIO 3: Añadir 'loadingSession' a las dependencias ---
  }, [user, loadingSession]); 

  useEffect(() => {
    fetchAllDocuments();
  }, [fetchAllDocuments]);

  return { documents, loading, error };
}