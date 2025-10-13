// src/components/PetDetail.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import QRCode from 'qrcode.react'; 

export default function PetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pet, setPet] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("id");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [weightError, setWeightError] = useState("");

  const [species, setSpecies] = useState([]);
  const [sexes, setSexes] = useState([]);
  const [origins, setOrigins] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTypes, setEventTypes] = useState([]);

  // === Colaboradores (UI de compartir) ===
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("vet");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [memberMsg, setMemberMsg] = useState("");
  const [memberErr, setMemberErr] = useState("");

  // === Membresía del usuario actual sobre esta mascota (permite permisos vet) ===
  const [member, setMember] = useState(null);

  // === Archivos PDF y Documentos ===
  const [documents, setDocuments] = useState([]); 
  const [uploadingFile, setUploadingFile] = useState(false);
  const [newDocumentTypeId, setNewDocumentTypeId] = useState(""); 
  const [docTypes, setDocTypes] = useState([]); 


  const [formData, setFormData] = useState({
    name: "",
    species_id: "",
    breed: "",
    sex_id: "",
    birth_date: "",
    image_url: "",
    microchip: "",
    neutered: false,
    origin_id: "",
    acquired_at: "",
    status_id: "",
    current_weight: "",
  });

  async function fetchOwnerContactByPet(petId) {
    const { data, error } = await supabase
      .schema("petcare")
      .rpc("get_owner_contact", { p_pet_id: petId });
    if (error) throw error;
    return (data && data[0]) || null;
  }

  async function fetchOwnerContact(userId) {
    const { data: base, error: e1 } = await supabase
      .schema("petcare")
      .from("app_user")
      .select("user_id, email, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (e1) throw e1;

    const { data: pii, error: e2 } = await supabase
      .schema("petcare")
      .from("user_pii")
      .select("phone, address_line")
      .eq("user_id", userId)
      .maybeSingle();
    if (e2) throw e2;

    return {
      ...base,
      phone: pii?.phone ?? null,
      address_line: pii?.address_line ?? null,
    };
  }

  const validateWeight = (value) => {
    if (!value || value.trim() === "") {
      setWeightError("");
      return true;
    }
    const weight = parseFloat(value);
    if (isNaN(weight)) {
      setWeightError("El peso debe ser un número válido");
      return false;
    }
    if (weight <= 0) {
      setWeightError("El peso debe ser mayor a 0");
      return false;
    }
    if (weight > 500) {
      setWeightError("El peso no puede ser mayor a 500 kg");
      return false;
    }
    setWeightError("");
    return true;
  };

  
  /**
   * Loads all documents associated with the pet from the 'document' table.
   * CORREGIDO: Uso de .is() para NULL
   */
  const loadDocuments = useCallback(async (petId) => {
    if (!petId) return;
    try {
      const { data, error } = await supabase
        .schema("petcare")
        .from("document")
        .select("doc_id, doc_category_id, title, storage_path, created_at, owner_pet_id, owner_user_id") 
        .eq("owner_pet_id", petId) 
        .is("deleted_at", null) // ✅ CORRECCIÓN CLAVE: Resuelve error 400
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const enrichedDocuments = (data || []).map(doc => {
        const { data: { publicUrl } } = supabase.storage
          .from("pet-documents")
          .getPublicUrl(doc.storage_path);
        return {
          ...doc,
          public_url: publicUrl 
        };
      });

      setDocuments(enrichedDocuments);

    } catch (e) {
      console.error("Error cargando documentos:", e);
    }
  }, [setDocuments]);


  const loadRoutinesAndEvents = async (petId) => {
    const [r, e] = await Promise.all([
      supabase.schema("petcare").from("routine").select("*").eq("pet_id", petId),
      supabase.schema("petcare").from("event").select("*").eq("pet_id", petId),
    ]);

    if (r.data) setRoutines(r.data);
    if (e.data) setEvents(e.data);
  };
  
  /**
   * Loads the pet profile.
   */
  const loadPet = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .schema("petcare")
      .from("pet")
      .select("*")
      .eq("pet_id", id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setPet(data);
      setFormData({
        name: data.name || "",
        species_id: data.species_id || "",
        breed: data.breed || "",
        sex_id: data.sex_id || "",
        birth_date: data.birth_date || "",
        image_url: data.image_url || "",
        microchip: data.microchip || "",
        neutered: data.neutered || false,
        origin_id: data.origin_id || "",
        acquired_at: data.acquired_at || "",
        status_id: data.status_id || "",
        current_weight: data.current_weight?.toString() || "",
      });

      try {
        const oc = await fetchOwnerContactByPet(data.pet_id);
        setOwner(oc);
        await loadRoutinesAndEvents(data.pet_id);
        loadDocuments(data.pet_id); 
      } catch (e) {
        console.warn("No fue posible cargar owner/PII:", e?.message);
      }
    }
    setLoading(false);
  }, [id, loadDocuments]); // loadDocuments es dependencia


  useEffect(() => {
    loadCatalogs();
    loadEventTypes();
    loadDocTypes();
  }, []);

  const loadCatalogs = async () => {
    const [sp, sx, or, st] = await Promise.all([
      supabase.schema("petcare").from("species_catalog").select("*"),
      supabase.schema("petcare").from("sex_catalog").select("*"),
      supabase.schema("petcare").from("pet_origin_catalog").select("*"),
      supabase.schema("petcare").from("pet_status_catalog").select("*"),
    ]);

    if (sp.data) setSpecies(sp.data);
    if (sx.data) setSexes(sx.data);
    if (or.data) setOrigins(or.data);
    if (st.data) setStatuses(st.data);
  };

  
  const loadDocTypes = async () => {
    const { data, error } = await supabase
      .schema("petcare")
      .from("doc_type_catalog")
      .select("doc_type_id, display_name")
      .order("display_name", { ascending: true });

    if (error) {
      console.error("❌ Error cargando tipos de documento:", error);
    } else {
      setDocTypes(data || []);
      const medical = data.find(d => d.doc_type_id === 'medical');
      if (medical) setNewDocumentTypeId(medical.doc_type_id);
    }
  };


  const loadEventTypes = async () => {
    const { data, error } = await supabase
      .schema("petcare")
      .from("event_type_catalog")
      .select("event_type_id, display_name")
      .order("display_name", { ascending: true });

    if (error) {
      console.error("❌ Error cargando tipos de evento:", error);
    } else {
      setEventTypes(data || []);
    }
  };

  // useEffect PRINCIPAL: usa la función estable loadPet
  useEffect(() => {
    loadPet();
  }, [loadPet]); 


  // Carga membresía del usuario sobre esta mascota
  useEffect(() => {
    const loadMembership = async () => {
      if (!user || !id) return;
      const { data, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select("member_role_id, permissions")
        .eq("pet_id", id)
        .eq("member_user_id", user.id)
        .maybeSingle();
      if (!error) setMember(data || null);
    };
    loadMembership();
  }, [user, id]);


  const loadEventsByDate = async (petId, date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .schema("petcare")
      .from("event")
      .select(`
        *,
        event_type_catalog(display_name),
        vaccine_event(next_due_date)
      `)
      .eq("pet_id", petId)
      .gte("ts", startOfDay.toISOString())
      .lte("ts", endOfDay.toISOString())
      .order("ts", { ascending: true });

    if (error) {
      console.error("Error cargando eventos:", error);
      return [];
    }
    return data || [];
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years === 0) return `${months} ${months === 1 ? "mes" : "meses"}`;
    return `${years} ${years === 1 ? "año" : "años"}${months > 0 ? ` y ${months} ${months === 1 ? "mes" : "meses"}` : ""
      }`;
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("El nombre es requerido");
      return;
    }

    if (formData.current_weight && !validateWeight(formData.current_weight)) {
      setError("Por favor corrige el peso de la mascota");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const updateData = { name: formData.name.trim(), neutered: formData.neutered };

    if (formData.species_id) updateData.species_id = formData.species_id;
    if (formData.breed && formData.breed.trim()) updateData.breed = formData.breed.trim();
    if (formData.sex_id) updateData.sex_id = formData.sex_id;
    if (formData.birth_date) updateData.birth_date = formData.birth_date;
    if (formData.image_url && formData.image_url.trim()) updateData.image_url = formData.image_url.trim();
    if (formData.microchip && formData.microchip.trim()) updateData.microchip = formData.microchip.trim();
    if (formData.origin_id) updateData.origin_id = formData.origin_id;
    if (formData.acquired_at) updateData.acquired_at = formData.acquired_at;
    if (formData.status_id) updateData.status_id = formData.status_id;
    if (formData.current_weight && formData.current_weight !== "")
      updateData.current_weight = parseFloat(formData.current_weight);

    const { error: updateError } = await supabase
      .schema("petcare")
      .from("pet")
      .update(updateData)
      .eq("pet_id", id);

    setSaving(false);

    if (updateError) {
      setError(`Error: ${updateError.message}`);
      return;
    }

    setSuccess("Perfil actualizado exitosamente");
    await loadPet();

    setTimeout(() => {
      setIsEditing(false);
      setSuccess("");
      setWeightError("");
    }, 1500);
  };

  const handleCancel = () => {
    if (pet) {
      setFormData({
        name: pet.name || "",
        species_id: pet.species_id || "",
        breed: pet.breed || "",
        sex_id: pet.sex_id || "",
        birth_date: pet.birth_date || "",
        image_url: pet.image_url || "",
        microchip: pet.microchip || "",
        neutered: pet.neutered || false,
        origin_id: pet.origin_id || "",
        acquired_at: pet.acquired_at || "",
        status_id: pet.status_id || "",
        current_weight: pet.current_weight?.toString() || "",
      });
    }
    setError("");
    setSuccess("");
    setWeightError("");
    setIsEditing(false);
  };

  const handleArchive = async () => {
    // Solo dueño puede archivar
    if (!canEditCore) {
      setError("No tienes permiso para archivar esta mascota.");
      return;
    }

    setDeleting(true);
    const { error } = await supabase
      .schema("petcare")
      .from("pet")
      .update({ deleted_at: new Date().toISOString() })
      .eq("pet_id", id)
      .eq("user_id", user.id);
    setDeleting(false);
    setShowArchiveModal(false);

    if (error) {
      setError("No se pudo archivar la mascota.");
      return;
    }
    navigate("/app");
  };

  const getSpeciesName = (id) =>
    species.find((sp) => sp.species_id === id)?.display_name || "—";
  const getSexName = (id) =>
    sexes.find((sx) => sx.sex_id === id)?.display_name || "—";
  const getOriginName = (id) =>
    origins.find((or) => or.origin_id === id)?.display_name || "—";
  const getStatusName = (id) =>
    statuses.find((st) => st.status_id === id)?.display_name || "—";

  // ========= COLABORADORES: funciones (lista/invitar) =========
  const loadMembers = async () => {
    setMembersLoading(true);
    setMemberErr("");
    try {
      const { data: rows, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select("pet_id, member_user_id, member_role_id, permissions, created_at")
        .eq("pet_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const ids = (rows || []).map(r => r.member_user_id).filter(Boolean);
      if (ids.length === 0) {
        setMembers(rows || []);
        return;
      }

      const { data: users, error: uerr } = await supabase
        .schema("petcare")
        .from("app_user")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", ids);

      if (uerr) throw uerr;

      const byId = Object.fromEntries((users || []).map(u => [u.user_id, u]));
      const enriched = rows.map(r => ({ ...r, app_user: byId[r.member_user_id] || null }));
      setMembers(enriched);
    } catch (e) {
      console.error("loadMembers:", e);
      setMemberErr(e.message || "No se pudieron cargar los colaboradores.");
    } finally {
      setMembersLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setMemberMsg("");
    setMemberErr("");
    if (!inviteEmail.trim()) {
      setMemberErr("Ingresa un correo válido.");
      return;
    }
    setInviteBusy(true);
    try {
      const { error } = await supabase
        .schema("petcare")
        .rpc("grant_pet_member_by_email", {
          p_pet_id: id,
          p_email: inviteEmail.trim(),
          p_member_role: inviteRole,
        });
      if (error) throw error;

      setMemberMsg("Invitación enviada / acceso concedido ✅");
      setInviteEmail("");
      await loadMembers();
    } catch (e) {
      console.error("handleInvite:", e);
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("function") && msg.toLowerCase().includes("grant_pet_member_by_email")) {
        setMemberErr("RPC grant_pet_member_by_email no existe. Aplica la migración/SQL correspondiente.");
      } else {
        setMemberErr(e.message || "No se pudo invitar al colaborador.");
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const revokeMember = async (memberUserId) => {
    if (!confirm("¿Revocar acceso de este colaborador?")) return;
    setMemberErr("");
    setMemberMsg("");
    try {
      const { error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .delete()
        .eq("pet_id", id)
        .eq("member_user_id", memberUserId);
      if (error) throw error;

      setMemberMsg("Acceso revocado.");
      await loadMembers();
    } catch (e) {
      console.error("revokeMember:", e);
      setMemberErr(e.message || "No se pudo revocar el acceso.");
    }
  };

  const roleBadge = (r) => {
    if (r === "vet") return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Veterinario</span>;
    if (r === "viewer") return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">Lector</span>;
    if (r === "editor") return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Editor</span>;
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{r}</span>;
  };

  useEffect(() => {
    if (activeTab === "colaboradores") loadMembers();
  }, [activeTab, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Mascota no encontrada</p>
          <Link to="/app" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ======= Permisos (dueño vs colaborador con write)
  const isOwner = !!user && pet?.user_id === user.id;
  const isMember = !!member;
  const memberCanWrite = Array.isArray(member?.permissions)
    ? member.permissions.includes("write")
    : false;

  const canEditCore = isOwner; // editar/eliminar ficha solo dueño
  const canAddClinical = isOwner || memberCanWrite; // eventos/documentos
  const canEdit = canEditCore; // mantener alias que ya usabas

  const age = calculateAge(pet.birth_date);


  /**
   * Handles download using the public_url stored in the 'document' record.
   */
  const handleDocumentDownload = (doc) => {
    if (!doc.public_url) return;
    const link = document.createElement("a");
    link.href = doc.public_url;
    link.download = doc.title; 
    link.target = "_blank"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  /**
   * Uploads file to storage, checks for doc type, and inserts a record into the 'document' table.
   * CORREGIDO: owner_user_id = null
   */
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !canAddClinical || !pet || !user) return; 

    if (!newDocumentTypeId) {
      setError("Por favor, selecciona un tipo de documento antes de subir el archivo.");
      return;
    }

        // 🚨 AÑADIR LA VALIDACIÓN DEL TIPO DE ARCHIVO
    if (file.type !== "application/pdf") {
        setError("Error: Solo se permiten archivos PDF.");
        setUploadingFile(false);
        event.target.value = null; // Limpiar input
        return;
    }

    if (!newDocumentTypeId) {
        setError("Por favor, selecciona un tipo de documento antes de subir el archivo.");
        return;
    }
    

    setUploadingFile(true);
    setError("");
    setSuccess("");
    
    // 1. Upload file to Supabase Storage 
    const folderPath = `pet_files/${pet.pet_id}`;
    const fileName = `${new Date().getTime()}_${file.name}`;
    const filePath = `${folderPath}/${fileName}`;
    
    const { error: uploadError } = await supabase
      .storage
      .from("pet-documents")
      .upload(filePath, file, { 
        upsert: true,
        cacheControl: "3600"
      });

    if (uploadError) {
      setUploadingFile(false);
      setError("Error subiendo archivo: " + uploadError.message);
      return;
    }

    // 2. Insert record into the 'document' table
    try {
      const { error: insertError } = await supabase
        .schema("petcare")
        .from("document")
        .insert({
          owner_kind: 'pet', 
          owner_user_id: null, // <<-- ¡CORRECCIÓN! Para pasar el CHECK constraint
          owner_pet_id: pet.pet_id,
          title: file.name,
          storage_path: filePath,
          created_by: user.id, 
          doc_category_id: newDocumentTypeId, 
          hash_sha256: null,
        });

      if (insertError) {
        console.error("❌ Error de inserción en tabla document:", insertError);
        throw insertError;
      }

      setSuccess(`Archivo '${file.name}' subido y registrado exitosamente.`);
      await loadDocuments(pet.pet_id);
      setNewDocumentTypeId(''); 

    } catch (insertError) {
      setError(`Error DB al registrar documento: ${insertError.message || 'Revise la consola del navegador.'}`);
    }

    setUploadingFile(false);
    event.target.value = null; 
  };
  

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
            >
              ← Volver al Dashboard
            </button>

            {canEdit && !isEditing && (
              <div className="flex gap-2">
                <Link
                  to={`/report/${pet.pet_id}`}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Reporte
                </Link>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
                >
                  Editar Perfil
                </button>
                <button
                  onClick={() => setShowArchiveModal(true)}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            )}

            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !!weightError}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <h1 className="text-3xl font-bold">{pet.name}</h1>
            <p className="text-gray-500 text-sm mt-1">Perfil de mascota</p>

            {/* Badge de colaborador */}
            {isMember && !isOwner && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600">
                Acceso como colaborador ({member?.member_role_id}) — {memberCanWrite ? "write" : "read"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border shadow-sm p-8 mb-6">
          <div className="flex items-start gap-8">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100">
                <img
                  src={pet.image_url || "/placeholder-pet.jpg"}
                  alt={pet.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-4">{pet.name}</h2>
              <div className="flex gap-4 text-sm mb-4">
                {getSpeciesName(pet.species_id) !== "—" && (
                  <span className="px-3 py-1 bg-gray-100 rounded-full font-medium">
                    {getSpeciesName(pet.species_id)}
                  </span>
                )}
                {pet.breed && (
                  <span className="px-3 py-1 bg-gray-100 rounded-full font-medium">
                    {pet.breed}
                  </span>
                )}
              </div>

              {age && (
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <span>📅</span>
                  <span>{age}</span>
                </div>
              )}

              {pet.birth_date && (
                <p className="text-sm text-gray-500">
                  Fecha de nacimiento:{" "}
                  {new Date(pet.birth_date).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {!isEditing && (
          <>
            <div className="bg-white rounded-t-2xl border-t border-x shadow-sm">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab("id")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "id"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  ID
                </button>
                <button
                  onClick={() => setActiveTab("perfil")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "perfil"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Perfil
                </button>
                <button
                  onClick={() => setActiveTab("historial")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "historial"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Historial médico
                </button>
                {canEdit && (<button
                  onClick={() => setActiveTab("rutinas")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "rutinas"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Rutinas y eventos
                </button>)}
                {canEdit && (<button
                  onClick={() => setActiveTab("colaboradores")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "colaboradores"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Colaboradores
                </button>)}
              </div>
            </div>

            <div className="bg-white rounded-b-2xl border-x border-b shadow-sm p-8">
              {activeTab === "id" && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🔲</span>
                    <h3 className="text-xl font-semibold">
                      Identificación QR de {pet.name}
                    </h3>
                  </div>

                  <p className="text-gray-600 mb-6">
                    Genera un código QR único para tu mascota. Al escanearlo,
                    mostrará información de contacto del dueño y datos básicos
                    de la mascota.
                  </p>

                  <button className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800">
                    🔲 Generar Código QR
                  </button>

                  {owner && (
                    <div className="mt-8 p-6 border rounded-2xl bg-gray-50">
                      <h4 className="font-semibold mb-4">
                        Información Visible al Escanear
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Al escanear el código QR, se mostrará la siguiente
                        información:
                      </p>

                      <div className="space-y-6">
                        <div>
                          <h5 className="font-medium mb-3">
                            Información del Dueño:
                          </h5>
                          <div className="ml-6 space-y-2 text-sm">
                            <p>{owner.full_name || "Sin nombre"}</p>
                            {owner.phone && (
                              <p>
                                <span className="font-medium">Teléfono:</span>{" "}
                                {owner.phone}
                              </p>
                            )}
                            {owner.email && (
                              <p>
                                <span className="font-medium">Email:</span>{" "}
                                {owner.email}
                              </p>
                            )}
                            {owner.address_line && (
                              <p>
                                <span className="font-medium">Dirección:</span>{" "}
                                {owner.address_line}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium mb-3">
                            Información de la Mascota:
                          </h5>
                          <div className="ml-6 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                <img
                                  src={pet.image_url || "/placeholder-pet.jpg"}
                                  alt={pet.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span>{pet.name}</span>
                            </div>
                            {getSpeciesName(pet.species_id) !== "—" && (
                              <p>
                                <span className="font-medium">Especie:</span>{" "}
                                {getSpeciesName(pet.species_id)}
                              </p>
                            )}
                            {pet.breed && (
                              <p>
                                <span className="font-medium">Raza:</span>{" "}
                                {pet.breed}
                              </p>
                            )}
                            {pet.microchip && (
                              <p>
                                <span className="font-medium">Microchip:</span>{" "}
                                {pet.microchip}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "perfil" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Información del Perfil
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <InfoItem
                      label="Especie"
                      value={getSpeciesName(pet.species_id)}
                    />
                    <InfoItem label="Raza" value={pet.breed || "—"} />
                    <InfoItem label="Sexo" value={getSexName(pet.sex_id)} />
                    <InfoItem label="Microchip" value={pet.microchip || "—"} />
                    <InfoItem
                      label="Esterilizado/a"
                      value={pet.neutered ? "Sí" : "No"}
                    />
                    <InfoItem
                      label="Peso"
                      value={
                        pet.current_weight ? `${pet.current_weight} kg` : "—"
                      }
                    />
                    <InfoItem
                      label="Origen"
                      value={getOriginName(pet.origin_id)}
                    />
                    <InfoItem
                      label="Estado"
                      value={getStatusName(pet.status_id)}
                    />
                  </div>
                </div>
              )}

              {activeTab === "historial" && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold mb-6">Historial Médico</h3>

                  {/* Subir Documento */}
                  <div className="border p-4 rounded-xl bg-gray-50">
                    <label className="block mb-2 text-gray-700 font-medium">Subir Documento Médico (PDF/Imagen)</label>
                    
                    {!canAddClinical && (
                        <p className="text-sm text-red-500 mb-3">
                          No tienes permisos para subir documentos.
                        </p>
                    )}

                    <fieldset disabled={!canAddClinical || uploadingFile}>
                        {/* Selector de Tipo de Documento */}
                        <select
                          value={newDocumentTypeId}
                          onChange={(e) => {
                            setNewDocumentTypeId(e.target.value);
                            setError(""); 
                          }}
                          className="w-full border rounded-xl px-3 py-2 text-sm mb-3 bg-white"
                          required
                        >
                          <option value="">Selecciona Tipo de Documento...</option>
                          {docTypes.map(type => (
                            <option key={type.doc_type_id} value={type.doc_type_id}>
                              {type.display_name}
                            </option>
                          ))}
                        </select>

                        {/* Input de Archivo */}
                        <input
                          type="file"
                          accept="application/pdf,image/*" 
                          onChange={handlePdfUpload}
                          className="border rounded px-3 py-2 text-sm w-full bg-white"
                          disabled={!newDocumentTypeId}
                        />
                    </fieldset>

                    {uploadingFile && (
                      <p className="text-sm text-blue-600 mt-2">Subiendo archivo, por favor espera...</p>
                    )}
                  </div>
                  
                  {/* Lista de Documentos */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 border-b pb-2">Documentos Registrados</h4>
                    {documents.length > 0 ? (
                      <ul className="space-y-3">
                        {documents.map((doc) => (
                          <li key={doc.doc_id} className="flex justify-between items-center p-3 border rounded-lg bg-white">
                            <div className="text-sm">
                              <p className="font-medium text-gray-900">{doc.title}</p>
                              <p className="text-xs text-gray-500">
                                Tipo: {docTypes.find(t => t.doc_type_id === doc.doc_category_id)?.display_name || doc.doc_category_id}
                              </p>
                              <p className="text-xs text-gray-500">
                                Subido el {new Date(doc.created_at).toLocaleDateString("es-CL")}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDocumentDownload(doc)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50"
                              disabled={!doc.public_url}
                            >
                              Descargar
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No hay documentos médicos registrados.</p>
                    )}
                  </div>
                </div>
              )}

              {canEdit && activeTab === "rutinas" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">Rutinas y Eventos</h3>
                <div className="bg-gray-50 p-6 rounded-2xl border shadow-sm">
                  <h4 className="text-lg font-medium mb-4">Calendario</h4>
                  <Calendar
                    routines={routines}
                    events={events}
                    onDayClick={async (dayDate) => {
                      const data = await loadEventsByDate(pet.pet_id, dayDate);
                      setSelectedDate(dayDate);
                      setDayEvents(data);
                      setShowEventModal(true);
                    }}
                  />
                </div>
                </div>
              )}

              {canEdit && activeTab === "colaboradores" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🤝</span>
                    <h3 className="text-xl font-semibold">Colaboradores en {pet.name}</h3>
                  </div>
                  <p className="text-gray-600">
                    Invita a profesionales por correo. Los veterinarios podrán agregar documentos y eventos si la política lo permite.
                  </p>

                  {(memberErr || memberMsg) && (
                    <div className={`p-3 rounded-xl border ${memberErr ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                      {memberErr || memberMsg}
                    </div>
                  )}

                  <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Correo del colaborador</label>
                      <input
                        type="email"
                        placeholder="profesional@clinica.cl"
                        className="w-full px-3 py-2 border rounded-xl"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                      <select
                        className="px-3 py-2 border rounded-xl bg-white"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                      >
                        <option value="vet">Veterinario</option>
                        <option value="viewer">Lector</option>
                        <option value="editor">Editor</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={inviteBusy}
                      className={`px-4 py-2 rounded-xl text-white ${inviteBusy ? 'bg-gray-400' : 'bg-black hover:bg-gray-800'}`}
                    >
                      {inviteBusy ? "Invitando..." : "Invitar"}
                    </button>
                  </form>

                  <div className="mt-4">
                    <h4 className="font-semibold mb-3">Accesos actuales</h4>
                    {membersLoading ? (
                      <div className="text-gray-500">Cargando colaboradores…</div>
                    ) : members.length === 0 ? (
                      <div className="text-gray-500">Aún no hay colaboradores.</div>
                    ) : (
                      <ul className="divide-y">
                        {members.map((m) => {
                          const name = m.app_user?.full_name || m.app_user?.email || m.member_user_id;
                          const email = m.app_user?.email;
                          return (
                            <li key={m.member_user_id} className="py-3 flex items-center justify-between">
                              <div>
                                <div className="font-medium">{name}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                  {email && <span>{email}</span>}
                                  {roleBadge(m.member_role_id)}
                                  {Array.isArray(m.permissions) && m.permissions.length > 0 && (
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                      {m.permissions.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => revokeMember(m.member_user_id)}
                                className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
                              >
                                Revocar
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isEditing && (
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h3 className="text-xl font-semibold mb-6">Editar Información</h3>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <EditField label="Nombre *">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField label="Especie">
                  <select
                    value={formData.species_id}
                    onChange={(e) =>
                      setFormData({ ...formData, species_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {species.map((s) => (
                      <option key={s.species_id} value={s.species_id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Raza">
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) =>
                      setFormData({ ...formData, breed: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField label="Sexo">
                  <select
                    value={formData.sex_id}
                    onChange={(e) =>
                      setFormData({ ...formData, sex_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {sexes.map((s) => (
                      <option key={s.sex_id} value={s.sex_id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Fecha de nacimiento">
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </EditField>

                <EditField label="Microchip">
                  <input
                    type="text"
                    value={formData.microchip}
                    onChange={(e) =>
                      setFormData({ ...formData, microchip: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField
                  label="Peso (kg)"
                  error={weightError}
                  helpText="Debe ser mayor a 0 y menor a 500 kg"
                >
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="500"
                    value={formData.current_weight}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        current_weight: e.target.value,
                      });
                      validateWeight(e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-xl ${weightError ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    placeholder="Ej: 25.5"
                  />
                </EditField>

                <EditField label="Origen">
                  <select
                    value={formData.origin_id}
                    onChange={(e) =>
                      setFormData({ ...formData, origin_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {origins.map((o) => (
                      <option key={o.origin_id} value={o.origin_id}>
                        {o.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Estado">
                  <select
                    value={formData.status_id}
                    onChange={(e) =>
                      setFormData({ ...formData, status_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {statuses.map((s) => (
                      <option key={s.status_id} value={s.status_id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.neutered}
                      onChange={(e) =>
                        setFormData({ ...formData, neutered: e.target.checked })
                      }
                      className="w-5 h-5"
                    />
                    <span className="text-sm font-medium">
                      Esterilizado/Castrado
                    </span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <EditField label="Subir otra imagen">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        const fileName = `${user.id}/${file.name}`;

                        const { error: uploadError } = await supabase.storage
                          .from("pets")
                          .upload(fileName, file, {
                            cacheControl: "3600",
                            upsert: true,
                          });

                        if (uploadError) {
                          console.error("Error subiendo imagen:", uploadError.message);
                          return;
                        }

                        const { data: publicData } = supabase.storage
                          .from("pets")
                          .getPublicUrl(fileName);

                        setFormData({
                          ...formData,
                          image_url: publicData.publicUrl,
                        });
                      }}
                      className="w-full px-4 py-2 border rounded-xl"
                    />
                  </EditField>
                </div>
              </div>
            </div>
          </div>
        )}
        <ConfirmDialog
          open={showArchiveModal}
          title={`Eliminar a ${pet.name}`}
          description="Esto eliminará la mascota de tus listas."
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
          danger
          requireText
          expectedText={pet.name}
          disabled={deleting}
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveModal(false)}
        />
      </div>
      <EventModal
        open={showEventModal}
        date={selectedDate}
        events={dayEvents}
        onClose={() => setShowEventModal(false)}
        petId={pet.pet_id}
        eventTypes={eventTypes}
        canAdd={canAddClinical}  // 👈 permisos: dueño o miembro con "write"
        onEventAdded={async () => {
          const refreshed = await loadEventsByDate(pet.pet_id, selectedDate);
          setDayEvents(refreshed);
        }}
      />
    </div>

  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-gray-500 mb-1">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function EditField({ label, children, error, helpText }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helpText && !error && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}

function ConfirmDialog({
  open,
  title = "Confirmar acción",
  description = "¿Estás segur@?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  requireText = false,
  expectedText = "",
  disabled = false,
}) {
  const [typed, setTyped] = React.useState("");

  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const normalize = (s) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const matchOK = !requireText || normalize(typed) === normalize(expectedText);
  const canConfirm = !disabled && matchOK;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{description}</p>

        {requireText && (
          <div className="mt-4">
            <label className="text-sm text-gray-700">
              Para continuar, escribe el nombre exacto:{" "}
              <span className="font-semibold">{expectedText}</span>
            </label>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) onConfirm();
              }}
              className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              placeholder={`Escribe: ${expectedText}`}
              disabled={disabled}
            />
            {typed && !matchOK && (
              <p className="text-xs text-red-600 mt-1">El texto no coincide.</p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={disabled}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-gray-800"
              }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function Calendar({ routines = [], events = [], onDayClick }) {
  const [today, setToday] = React.useState(new Date());
  const [currentMonth, setCurrentMonth] = React.useState(today.getMonth());
  const [currentYear, setCurrentYear] = React.useState(today.getFullYear());

  React.useEffect(() => {
    const interval = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  let firstDay = new Date(currentYear, currentMonth, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleMonthChange = (e) => setCurrentMonth(parseInt(e.target.value));
  const handleYearChange = (e) => setCurrentYear(parseInt(e.target.value));

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const hasRoutine = (day) =>
    routines.some((r) => {
      const date = new Date(r.created_at);
      return (
        date.getDate() === day &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });

  const hasEvent = (day) =>
    events.some((e) => {
      const date = new Date(e.ts || e.created_at);
      return (
        date.getDate() === day &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });

  const years = Array.from({ length: 11 }, (_, i) => today.getFullYear() - 5 + i);

  return (
    <div className="text-center">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-1 border rounded-lg hover:bg-gray-100">
            ←
          </button>
          <select
            value={currentMonth}
            onChange={handleMonthChange}
            className="border rounded-lg px-2 py-1 text-sm"
          >
            {months.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={handleYearChange}
            className="border rounded-lg px-2 py-1 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button onClick={nextMonth} className="px-3 py-1 border rounded-lg hover:bg-gray-100">
            →
          </button>
        </div>

        <span className="text-sm text-gray-500">
          Hoy es{" "}
          {today.toLocaleDateString("es-CL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2 text-sm font-medium text-gray-600">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 text-sm mt-1">
        {calendarDays.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday =
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear();

          const dateObj = new Date(currentYear, currentMonth, day);

          return (
            <div
              key={i}
              onClick={() => onDayClick?.(dateObj)}
              className={`cursor-pointer h-14 flex flex-col items-center justify-center rounded-lg border relative transition ${isToday
                ? "bg-pink-500 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
            >
              <span>{day}</span>
              <div className="absolute bottom-1 flex gap-1">
                {hasRoutine(day) && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
                {hasEvent(day) && (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventModal({ open, date, events, onClose, petId, eventTypes, onEventAdded, canAdd }) {
  const [newEvent, setNewEvent] = React.useState({
    type_id: "",
    details: "",
    vaccine_next: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  if (!open) return null;

  const formattedDate = date?.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    if (!canAdd) {
      setError("No tienes permiso para registrar eventos.");
      setSaving(false);
      return;
    }

    if (!newEvent.type_id) {
      setError("Debes seleccionar un tipo de evento.");
      setSaving(false);
      return;
    }

    try {
      const { data: inserted, error: insertError } = await supabase
        .schema("petcare")
        .from("event")
        .insert([
          {
            pet_id: petId,
            e_type_id: newEvent.type_id,
            ts: new Date(date).toISOString(),
            details: newEvent.details || null,
          },
        ])
        .select("event_id")
        .maybeSingle();

      if (insertError) throw insertError;

      const selectedType = eventTypes.find(
        (t) => t.event_type_id === newEvent.type_id
      );
      const isVaccine = selectedType?.display_name
        ?.toLowerCase()
        .includes("vacuna");

      if (isVaccine && newEvent.vaccine_next) {
        await supabase
          .schema("petcare")
          .from("vaccine_event")
          .insert([
            {
              event_id: inserted.event_id,
              next_due_date: newEvent.vaccine_next,
            },
          ]);
      }

      setSuccess("Evento registrado exitosamente.");
      setNewEvent({ type_id: "", details: "", vaccine_next: "" });

      onEventAdded();
    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al registrar el evento.");
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          ✕
        </button>

        <h3 className="text-lg font-semibold mb-2">
          Eventos del {formattedDate}
        </h3>

        {events.length === 0 ? (
          <p className="text-gray-500 text-sm mt-4">No hay eventos registrados.</p>
        ) : (
          <ul className="space-y-4 mt-4 max-h-80 overflow-y-auto pr-2">
            {events.map((ev) => (
              <li key={ev.event_id} className="border rounded-xl p-4 bg-gray-50 text-left">
                <p className="font-medium text-gray-800">
                  {ev.event_type_catalog?.display_name || "Evento sin tipo"}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(ev.ts).toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {ev.details && (
                  <p className="text-sm text-gray-700 mt-1">
                    {typeof ev.details === "object"
                      ? JSON.stringify(ev.details)
                      : ev.details}
                  </p>
                )}

                {ev.vaccine_event?.next_due_date && (
                  <p className="text-xs text-green-600 mt-1">
                    💉 Próxima dosis:{" "}
                    {new Date(ev.vaccine_event.next_due_date).toLocaleDateString("es-CL")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Registrar nuevo evento</h4>

          {!canAdd && (
            <p className="mb-3 text-sm text-gray-600">
              Solo el dueño o un colaborador con permiso <b>write</b> puede registrar nuevos eventos.
            </p>
          )}

          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          {success && <p className="text-green-600 text-sm mb-2">{success}</p>}

          <fieldset disabled={!canAdd} className={!canAdd ? "opacity-60 pointer-events-none" : ""}>
            <div className="space-y-3">
              <select
                value={newEvent.type_id}
                onChange={(e) => setNewEvent({ ...newEvent, type_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona tipo de evento...</option>
                {eventTypes.map((t) => (
                  <option key={t.event_type_id} value={t.event_type_id}>
                    {t.display_name}
                  </option>
                ))}
              </select>

              <textarea
                value={newEvent.details}
                onChange={(e) => setNewEvent({ ...newEvent, details: e.target.value })}
                placeholder="Detalles del evento..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={3}
              />

              {eventTypes.find(
                (t) =>
                  t.event_type_id === newEvent.type_id &&
                  t.display_name.toLowerCase().includes("vacuna")
              ) && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Próxima dosis (opcional)
                    </label>
                    <input
                      type="date"
                      value={newEvent.vaccine_next}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, vaccine_next: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !canAdd}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar evento"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}