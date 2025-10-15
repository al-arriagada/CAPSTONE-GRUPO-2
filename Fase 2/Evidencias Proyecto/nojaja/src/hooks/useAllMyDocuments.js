import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function useAllMyDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllDocuments = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Obtener los IDs de todas las mascotas del usuario
      // 👇 CORRECCIÓN: Se especificó el schema "petcare" para la tabla 'pet'
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
  }, [user]);

  useEffect(() => {
    fetchAllDocuments();
  }, [fetchAllDocuments]);

  return { documents, loading, error };
}