// src/components/PetDetail.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import QRCode from "react-qr-code";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import RoutinesPanel from "./RoutinesPanel.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import TransferPetModal from "./TransferPetModal.jsx";
import TransferHistoryPanel from "./TransferHistoryPanel.jsx";

const ALLOWED_EVENT_TYPES = ['heat_cycle', 'medication_dose', 'routine_check', 'vaccine_administered'];

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

  const [vaccines, setVaccines] = useState([]);
  const [regions, setRegions] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [vetsByClinic, setVetsByClinic] = useState([]);
  const [vetsByComuna, setVetsByComuna] = useState([]);
  const isDeceased = pet?.status_id === 'deceased';

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

  // === Transferencia de mascotas ===
  const [showTransferModal, setShowTransferModal] = useState(false);

  // === Lógica del QR: Nuevos estados y referencia ===
  const [qrType, setQrType] = useState("url"); // 'url' o 'vcard'
  const qrCodeRef = useRef(null); // Referencia al contenedor del QR para descargarlo

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
    cause_of_death: "",
    deceased_at: null,
  });

  async function fetchOwnerContactByPet(petId) {
    const { data, error } = await supabase
      .schema("petcare")
      .rpc("get_owner_contact", { p_pet_id: petId });
    if (error) throw error;
    return (data && data[0]) || null;
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

  const getSpeciesName = (id) => species.find((sp) => sp.species_id === id)?.display_name || "—";

  const loadDocuments = useCallback(async (petId) => {
    if (!petId) return;
    try {
      const { data, error } = await supabase
        .schema("petcare")
        .from("document")
        .select("doc_id, doc_category_id, title, storage_path, created_at, owner_pet_id, owner_user_id")
        .eq("owner_pet_id", petId)
        .is("deleted_at", null)
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
  }, []);

  const loadRoutinesAndEvents = async (petId) => {
    const [r, e] = await Promise.all([
      supabase.schema("petcare").from("routine").select("*").eq("pet_id", petId),
      supabase.schema("petcare").from("event").select("*").eq("pet_id", petId)
        .in("e_type_id", ALLOWED_EVENT_TYPES), // ← AGREGAR ESTA LÍNEA
    ]);

    if (r.data) setRoutines(r.data);
    if (e.data) setEvents(e.data);
  };

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
        cause_of_death: data.cause_of_death || "",
        deceased_at: data.deceased_at || null,
      });

      try {
        const oc = await fetchOwnerContactByPet(data.pet_id);
        setOwner(oc);
        await loadRoutinesAndEvents(data.pet_id);
        loadDocuments(data.pet_id);

        // ← AGREGADO: Cargar vacunas por especie
        if (data.species_id) {
          const { data: vaccinesData } = await supabase
            .schema("petcare")
            .from("vaccine")
            .select("vaccine_id, name")
            .eq("species_id", data.species_id)
            .order("name");
          if (vaccinesData) setVaccines(vaccinesData);
        }
      } catch (e) {
        console.warn("No fue posible cargar owner/PII:", e?.message);
      }
    }
    setLoading(false);
  }, [id, loadDocuments]);

  useEffect(() => {
    loadCatalogs();
    loadEventTypes();
    loadDocTypes();
    loadRegions();
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

  const loadRegions = async () => {
    const { data } = await supabase
      .schema("petcare")
      .from("region")
      .select("region_id, name")
      .order("name");
    if (data) setRegions(data);
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
      .in("event_type_id", ALLOWED_EVENT_TYPES) // ← AGREGAR ESTA LÍNEA
      .order("display_name", { ascending: true });

    if (error) {
      console.error("❌ Error cargando tipos de evento:", error);
    } else {
      setEventTypes(data || []);
    }
  };

  useEffect(() => {
    loadPet();
  }, [loadPet]);


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
      vaccine_event(next_due_date, vaccine_id, vaccine_batch, vaccine_dose_number, vaccine_expiration_date),
      clinic(name, address, phone),
      vet(full_name)
    `)
      .eq("pet_id", petId)
      .in("e_type_id", ALLOWED_EVENT_TYPES) // ← AGREGAR ESTA LÍNEA
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

  // --- CAMBIO 3: 'handleSave' ahora incluye la lógica para 'deceased' ---
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

    // Construye el objeto base con los datos del formulario
    const updateData = {
      name: formData.name.trim(),
      neutered: formData.neutered,
      species_id: formData.species_id || null,
      breed: formData.breed?.trim() || null,
      sex_id: formData.sex_id || null,
      birth_date: formData.birth_date || null,
      image_url: formData.image_url?.trim() || null,
      microchip: formData.microchip?.trim() || null,
      origin_id: formData.origin_id || null,
      acquired_at: formData.acquired_at || null,
      status_id: formData.status_id || null,
      current_weight: (formData.current_weight && formData.current_weight !== "")
        ? parseFloat(formData.current_weight)
        : null,
    };

    // ⬇️ LÓGICA CONDICIONAL AÑADIDA ⬇️
    if (formData.status_id === 'deceased') {
      // Si el estado es 'fallecido', añade estos campos
      updateData.cause_of_death = formData.cause_of_death?.trim() || null;
      // Solo actualiza 'deceased_at' si no ha sido seteado antes
      if (!pet.deceased_at) {
        updateData.deceased_at = new Date().toISOString();
      }
    } else {
      // Si el estado NO es 'fallecido' (ej. 'active'), limpia los campos
      updateData.cause_of_death = null;
      updateData.deceased_at = null;
    }
    // ⬆️ FIN DE LA LÓGICA AÑADIDA ⬆️

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
    await loadPet(); // Recarga los datos (incluyendo los nuevos)

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
        cause_of_death: pet.cause_of_death || "",
        deceased_at: pet.deceased_at || null,
      });
    }
    setError("");
    setSuccess("");
    setWeightError("");
    setIsEditing(false);
  };

  const handleArchive = async () => {
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

  const getSexName = (id) => sexes.find((sx) => sx.sex_id === id)?.display_name || "—";
  const getOriginName = (id) => origins.find((or) => or.origin_id === id)?.display_name || "—";
  const getStatusName = (id) => statuses.find((st) => st.status_id === id)?.display_name || "—";

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

  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !canAddClinical || !pet || !user) return;

    if (!newDocumentTypeId) {
      setError("Por favor, selecciona un tipo de documento antes de subir el archivo.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Error: Solo se permiten archivos PDF.");
      setUploadingFile(false);
      event.target.value = null; // Limpiar input
      return;
    }

    setUploadingFile(true);
    setError("");
    setSuccess("");

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

    try {
      const { error: insertError } = await supabase
        .schema("petcare")
        .from("document")
        .insert({
          owner_kind: 'pet',
          owner_user_id: null,
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


  // === Lógica del QR: Generación de contenido ===
  const qrUrlValue = pet ? `${window.location.origin}/public-pet/${pet.pet_id}` : "";

  const generateVCardString = () => {
    if (!owner || !pet) return "";
    return `BEGIN:VCARD
VERSION:3.0
FN:${owner.full_name || ''}
TEL;TYPE=CELL:${owner.phone || ''}
EMAIL:${owner.email || ''}
NOTE:Contacto de emergencia para ${pet.name}. Especie: ${getSpeciesName(pet.species_id)}.
URL:${qrUrlValue}
END:VCARD`;
  };

  const vCardValue = generateVCardString();
  const qrValue = qrType === 'url' ? qrUrlValue : vCardValue;


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

  const isOwner = !!user && pet?.user_id === user.id;
  const isMember = !!member;
  const memberCanWrite = Array.isArray(member?.permissions) ? member.permissions.includes("write") : false;
  const canEditCore = isOwner;
  const canAddClinical = isOwner || memberCanWrite;
  const canEdit = canEditCore;
  const age = calculateAge(pet.birth_date);


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                  onClick={() => setShowTransferModal(true)}
                  disabled={isDeceased}
                  className={`px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50 ${isDeceased ? 'opacity-50 cursor-not-allowed' : ''}`}

                  title={isDeceased ? "No se puede transferir una mascota fallecida" : "Transferir"}
                >
                  Transferir
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isDeceased}
                  className={`px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 ${isDeceased ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isDeceased ? "No se puede editar una mascota fallecida" : "Editar Perfil"}
                >
                  Editar Perfil
                </button>
                <button
                  onClick={() => setShowArchiveModal(true)}
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
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
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
            <div className="bg-white rounded-t-2xl border-t border-x shadow-sm overflow-x-auto">
              <div className="flex border-b px-0 sm:px-8">
                <button
                  onClick={() => setActiveTab("id")}
                  className={`min-w-max sm:flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "id"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  ID
                </button>
                <button
                  onClick={() => setActiveTab("perfil")}
                  className={`min-w-max sm:flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "perfil"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Perfil
                </button>
                <button
                  onClick={() => setActiveTab("documentos")}
                  className={`min-w-max sm:flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "documentos"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Documentos
                </button>
                <button
                  onClick={() => setActiveTab("transferencias")}
                  className={`min-w-max sm:flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "transferencias"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Transferencias
                </button>

                {canEdit && (<button
                  onClick={() => setActiveTab("rutinas")}
                  className={`min-w-max sm:flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "rutinas"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Rutinas y eventos
                </button>)}
                {canEdit && (<button
                  onClick={() => setActiveTab("colaboradores")}
                  className={`min-w-max sm:flex-1 px-6 py-4 text-sm font-medium transition-colors ${activeTab === "colaboradores"
                    ? "border-b-2 border-black text-black"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Colaboradores
                </button>)}
              </div>
            </div>

            <div className="bg-white rounded-b-2xl border-x border-b shadow-sm p-3 sm:p-8">
              {activeTab === "id" && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🔲</span>
                    <h3 className="text-xl font-semibold">
                      Identificación QR de {pet.name}
                    </h3>
                  </div>

                  <p className="text-gray-600 mb-6">
                    Usa estos códigos QR para identificar a tu mascota. El QR de perfil lleva a una página pública, mientras que el QR de contacto (VCard) permite agregar tus datos al teléfono de quien lo escanee.
                  </p>

                  <div className="w-fit mx-auto my-6" ref={qrCodeRef}>
                    <div className="border border-gray-200 p-3 rounded-2xl bg-white shadow-md">
                      {qrValue ? (
                        <QRCode
                          value={qrValue}
                          size={256}
                          viewBox={`0 0 256 256`}
                        />
                      ) : (
                        <div className="w-64 h-64 bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                          Generando QR...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
                    <div className="flex border rounded-xl p-1 bg-gray-100">
                      <button
                        onClick={() => setQrType('url')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${qrType === 'url' ? 'bg-white shadow-sm' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        🔗 Perfil Público
                      </button>
                      <button
                        onClick={() => setQrType('vcard')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${qrType === 'vcard' ? 'bg-white shadow-sm' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        👤 Contacto (VCard)
                      </button>
                    </div>
                  </div>

                  {owner && (
                    <div className="mt-8 p-4 sm:p-6 border rounded-2xl bg-gray-50">
                      <h4 className="font-semibold mb-4">
                        Información Visible al Escanear
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Al escanear el código QR, se mostrará la siguiente información:
                      </p>
                      <div className="space-y-6">
                        <div>
                          <h5 className="font-medium mb-3">Información del Dueño:</h5>
                          <div className="ml-6 space-y-2 text-sm">
                            <p>{owner.full_name || "Sin nombre"}</p>
                            {owner.phone && <p><span className="font-medium">Teléfono:</span> {owner.phone}</p>}
                            {owner.email && <p><span className="font-medium">Email:</span> {owner.email}</p>}
                            {owner.address_line && <p><span className="font-medium">Dirección:</span> {owner.address_line}</p>}
                          </div>
                        </div>
                        <div>
                          <h5 className="font-medium mb-3">Información de la Mascota:</h5>
                          <div className="ml-6 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                <img src={pet.image_url || "/placeholder-pet.jpg"} alt={pet.name} className="w-full h-full object-cover" />
                              </div>
                              <span>{pet.name}</span>
                            </div>
                            {getSpeciesName(pet.species_id) !== "—" && <p><span className="font-medium">Especie:</span> {getSpeciesName(pet.species_id)}</p>}
                            {pet.breed && <p><span className="font-medium">Raza:</span> {pet.breed}</p>}
                            {pet.microchip && <p><span className="font-medium">Microchip:</span> {pet.microchip}</p>}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

              {activeTab === "documentos" && (
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold mb-6">Documentos médicos</h3>
                  <div className="border p-4 rounded-xl bg-gray-50">
                    <label className="block mb-2 text-gray-700 font-medium">Subir Documento Médico (PDF/Imagen)</label>
                    {!canAddClinical && (
                      <p className="text-sm text-red-500 mb-3">
                        No tienes permisos para subir documentos.
                      </p>
                    )}
                    <fieldset disabled={!canAddClinical || uploadingFile}>
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
              {activeTab === "transferencias" && (
                <TransferHistoryPanel petId={pet.pet_id} />
              )}

              {canEdit && !isDeceased && activeTab === "rutinas" && (
                <div className="overflow-x-auto">
                  <h3 className="text-xl font-semibold mb-6">Rutinas y Eventos</h3>
                  <div className="bg-gray-50 p-4 sm:p-6 rounded-2xl border shadow-sm">
                    <RoutinesPanel petId={pet.pet_id} />
                    <h4 className="text-lg font-medium mb-4"></h4>
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
                <div className="space-y-6 ">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🤝</span>
                    <h3 className="text-xl font-semibold">Colaboradores en {pet.name}</h3>
                  </div>
                  <p className="text-gray-600">
                  </p>
                  {(memberErr || memberMsg) && (
                    <div className={`p-3 rounded-xl border ${memberErr ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                      {memberErr || memberMsg}
                    </div>
                  )}

                  <div className="mt-4">
                    <h4 className="font-semibold mb-3">Accesos actuales</h4>
                    {membersLoading ? (
                      <div className="text-gray-500">Cargando colaboradores…</div>
                    ) : members.length === 0 ? (
                      <div className="text-gray-500">Aún no hay colaboradores.</div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {members.map((m) => {
                          const name = m.app_user?.full_name || m.app_user?.email || "Usuario";
                          const email = m.app_user?.email;

                          return (
                            <li key={m.member_user_id} className="py-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                {/* Información del Usuario */}
                                <div className="flex-1 min-w-0"> {/* min-w-0 ayuda a truncar texto largo */}
                                  <div className="font-medium text-gray-900 truncate">
                                    {name}
                                  </div>

                                  {/* Email y Roles - Apilados en móvil, línea en escritorio */}
                                  <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-500">
                                    {email && (
                                      <span className="truncate block sm:inline">{email}</span>
                                    )}

                                    <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                                      {/* Badge de Rol */}
                                      {roleBadge(m.member_role_id)}

                                      {/* Badge de Permisos */}
                                      {Array.isArray(m.permissions) && m.permissions.length > 0 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                          {m.permissions.join(", ")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Botón de Acción */}
                                <div className="flex-shrink-0 self-start sm:self-center">
                                  <button
                                    onClick={() => revokeMember(m.member_user_id)}
                                    className="text-sm font-medium text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 transition-colors"
                                  >
                                    Revocar
                                  </button>
                                </div>

                              </div>
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


                {/* --- ⬇️ CAMPO CONDICIONAL AÑADIDO ⬇️ --- */}
                {/* Esto solo se mostrará si el estado es 'deceased' */}
                {formData.status_id === 'deceased' && (
                  // Ocupa las 2 columnas si es 'deceased'
                  <div className="sm:col-span-2">
                    <EditField label="Causa de Fallecimiento (Opcional)">
                      <textarea
                        value={formData.cause_of_death || ''} // Asegura que no sea null
                        onChange={(e) =>
                          setFormData({ ...formData, cause_of_death: e.target.value })
                        }
                        rows={3}
                        className="w-full px-4 py-2 border rounded-xl"
                        placeholder="Describe la causa (ej. vejez, enfermedad, ...)"
                      />
                    </EditField>
                  </div>
                )}
                {/* --- ⬆️ FIN DEL CAMPO AÑADIDO ⬆️ --- */}

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
        {/* Transfer Modal */}
        <TransferPetModal open={showTransferModal} onClose={(success) => {
          setShowTransferModal(false); if (success) {  // Redirect to home after successful transfer 
            setTimeout(() => { navigate("/app"); }, 2000);
          }
        }} petId={pet.pet_id} petName={pet.name} />
      </div>
      <EventModal
        open={showEventModal}
        date={selectedDate}
        events={dayEvents}
        onClose={() => setShowEventModal(false)}
        petId={pet.pet_id}
        eventTypes={eventTypes}
        canAdd={canAddClinical && !isDeceased}
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


// ========================================
// PASO 9: REEMPLAZAR completamente la función Calendar
// ========================================
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

  const getEventIndicators = (day) => {
    const dayEvents = events.filter((e) => {
      const date = new Date(e.ts || e.created_at);
      return (
        date.getDate() === day &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });

    if (dayEvents.length === 0) return null;

    const hasHeatCycle = dayEvents.some(e => e.e_type_id === 'heat_cycle');

    const medicalEvents = dayEvents.filter(e =>
      ['medication_dose', 'routine_check', 'vaccine_administered'].includes(e.e_type_id)
    );

    // Evento futuro = fecha en el futuro (rojo)
    // Evento realizado = fecha en el pasado o hoy (verde)
    const now = new Date();
    const hasCompleted = medicalEvents.some(e => new Date(e.ts) <= now);
    const hasPending = medicalEvents.some(e => new Date(e.ts) > now);

    return { hasHeatCycle, hasPending, hasCompleted };
  };

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
          const eventInfo = getEventIndicators(day);

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
                {eventInfo && (
                  <>
                    {eventInfo.hasHeatCycle && (
                      <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                    )}
                    {eventInfo.hasCompleted && (
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    )}
                    {eventInfo.hasPending && (
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span>Rutina</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
          <span>Ciclo de celo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>Evento completado</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          <span>Evento pendiente</span>
        </div>
      </div>
    </div>
  );
}

// ========================================
// PASO 10: REEMPLAZAR completamente el componente EventModal
// ========================================
function EventModal({ open, date, events, onClose, petId, eventTypes, onEventAdded, canAdd }) {
  const [formData, setFormData] = React.useState({
    e_type_id: "",
    domicilio: "no",
    region_id: "",
    comuna_id: "",
    clinic_id: "",
    vet_id: "",
    e_description: "",
    vaccine_id: "",
    next_due_date: "",
    vaccine_batch: "",
    vaccine_dose_number: "",
    vaccine_expiration_date: "",
    dose_mg: "",
  });

  const [regions, setRegions] = React.useState([]);
  const [comunas, setComunas] = React.useState([]);
  const [clinics, setClinics] = React.useState([]);
  const [vetsByClinic, setVetsByClinic] = React.useState([]);
  const [vetsByComuna, setVetsByComuna] = React.useState([]);
  const [vaccines, setVaccines] = React.useState([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  // Cargar catálogos iniciales
  React.useEffect(() => {
    if (!open) return;

    const loadInitialData = async () => {
      // Cargar regiones
      const { data: regionsData } = await supabase
        .schema("petcare")
        .from("region")
        .select("region_id, name")
        .order("name");
      if (regionsData) setRegions(regionsData);

      // Cargar vacunas si hay petId
      if (petId) {
        const { data: petData } = await supabase
          .schema("petcare")
          .from("pet")
          .select("species_id")
          .eq("pet_id", petId)
          .maybeSingle();

        if (petData?.species_id) {
          const { data: vaccinesData } = await supabase
            .schema("petcare")
            .from("vaccine")
            .select("vaccine_id, name")
            .eq("species_id", petData.species_id)
            .order("name");
          if (vaccinesData) setVaccines(vaccinesData);
        }
      }
    };

    loadInitialData();
  }, [open, petId]);

  // Cascada Region -> Comuna
  React.useEffect(() => {
    if (!formData.region_id) {
      setComunas([]);
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    const loadComunas = async () => {
      const { data } = await supabase
        .schema("petcare")
        .from("comuna")
        .select("comuna_id, name")
        .eq("region_id", formData.region_id)
        .order("name");
      if (data) setComunas(data);
    };

    loadComunas();
    setFormData(p => ({ ...p, comuna_id: "", clinic_id: "", vet_id: "" }));
  }, [formData.region_id]);

  // Comuna -> Clínicas y Vets
  React.useEffect(() => {
    if (!formData.comuna_id) {
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    const loadClinicsAndVets = async () => {
      const { data: cData } = await supabase
        .schema("petcare")
        .from("clinic")
        .select("clinic_id, name, address, phone")
        .eq("comuna_id", formData.comuna_id)
        .order("name");
      if (cData) setClinics(cData);

      const { data: vetsData } = await supabase
        .schema("petcare")
        .from("vet")
        .select("vet_id, full_name, clinic_id")
        .eq("comuna_id", formData.comuna_id)
        .order("full_name");
      if (vetsData) setVetsByComuna(vetsData);
    };

    loadClinicsAndVets();
    setFormData(p => ({ ...p, clinic_id: "", vet_id: "" }));
  }, [formData.comuna_id]);

  // Clínica -> Veterinarios
  React.useEffect(() => {
    if (!formData.clinic_id) {
      setVetsByClinic([]);
      return;
    }

    const loadVetsByClinic = async () => {
      const { data } = await supabase
        .schema("petcare")
        .from("vet")
        .select("vet_id, full_name")
        .eq("clinic_id", formData.clinic_id)
        .order("full_name");
      if (data) setVetsByClinic(data);
    };

    loadVetsByClinic();
  }, [formData.clinic_id, clinics]);

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

    if (!formData.e_type_id) {
      setError("Debes seleccionar un tipo de evento.");
      setSaving(false);
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("No se pudo verificar la sesión");

      const typeId = formData.e_type_id;
      const domicilio = formData.domicilio === "si";

      const eventData = {
        pet_id: petId,
        user_id: authUser.id,
        e_type_id: typeId,
        ts: new Date(date).toISOString(),
      };

      if (formData.e_description?.trim()) {
        eventData.e_description = formData.e_description.trim();
      }

      // Campos específicos por tipo
      if (["vaccine_administered", "medication_dose", "routine_check"].includes(typeId)) {
        if (formData.comuna_id) eventData.comuna_id = parseInt(formData.comuna_id);
        if (!domicilio && formData.clinic_id) eventData.clinic_id = formData.clinic_id;
        if (formData.vet_id) eventData.vet_id = formData.vet_id;
      }

      if (typeId === "medication_dose" && formData.dose_mg) {
        eventData.dose_mg = parseFloat(formData.dose_mg);
      }

      const { data: inserted, error: insertError } = await supabase
        .schema("petcare")
        .from("event")
        .insert(eventData)
        .select("event_id")
        .single();

      if (insertError) throw insertError;

      // Insertar vaccine_event si es vacuna
      if (typeId === "vaccine_administered" && formData.vaccine_id) {
        const vaccineEvent = {
          event_id: inserted.event_id,
          vaccine_id: parseInt(formData.vaccine_id),
          next_due_date: formData.next_due_date || null,
          vaccine_batch: formData.vaccine_batch || "",
          vaccine_dose_number: formData.vaccine_dose_number ? parseInt(formData.vaccine_dose_number) : null,
          vaccine_expiration_date: formData.vaccine_expiration_date || null,
        };

        await supabase
          .schema("petcare")
          .from("vaccine_event")
          .insert(vaccineEvent);
      }

      setSuccess("Evento registrado exitosamente.");
      setFormData({
        e_type_id: "",
        domicilio: "no",
        region_id: "",
        comuna_id: "",
        clinic_id: "",
        vet_id: "",
        e_description: "",
        vaccine_id: "",
        next_due_date: "",
        vaccine_batch: "",
        vaccine_dose_number: "",
        vaccine_expiration_date: "",
        dose_mg: "",
      });

      onEventAdded();
    } catch (err) {
      console.error(err);
      setError(err.message || "Ocurrió un error al registrar el evento.");
    }

    setSaving(false);
  };

  if (!open) return null;

  const formattedDate = date?.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const typeId = formData.e_type_id;
  const domicilio = formData.domicilio === "si";
  const needsGeoClinic = ["vaccine_administered", "medication_dose", "routine_check"].includes(typeId);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
        >
          ✕
        </button>

        <h3 className="text-lg font-semibold mb-2">
          Eventos del {formattedDate}
        </h3>

        {/* Lista de eventos existentes */}
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm mt-4">No hay eventos registrados.</p>
        ) : (
          <ul className="space-y-4 mt-4 max-h-60 overflow-y-auto pr-2 mb-6">
            {events.map((ev) => (
              <li key={ev.event_id} className="border rounded-xl p-4 bg-gray-50 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-800">
                    {ev.event_type_catalog?.display_name || "Evento sin tipo"}
                  </p>
                  {new Date(ev.ts) > new Date() ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Programado</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Realizado</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {new Date(ev.ts).toLocaleDateString("es-CL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}, {new Date(ev.ts).toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>

                {ev.e_description && (
                  <p className="text-sm text-gray-700 mt-1">{ev.e_description}</p>
                )}

                {ev.dose_mg && <p className="text-sm text-gray-700">💊 Dosis: {ev.dose_mg} mg</p>}

                {ev.clinic && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p className="font-medium">🏥 {ev.clinic.name}</p>
                    {ev.vet && <p>👨‍⚕️ {ev.vet.full_name}</p>}
                  </div>
                )}

                {ev.vaccine_event && (
                  <div className="mt-2 text-xs text-green-600">
                    {ev.vaccine_event.next_due_date && (
                      <p>💉 Próxima dosis: {new Date(ev.vaccine_event.next_due_date).toLocaleDateString("es-CL")}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Formulario para nuevo evento */}
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
              {/* Tipo de evento */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de evento *</label>
                <select
                  value={formData.e_type_id}
                  onChange={(e) => setFormData({ ...formData, e_type_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="">Selecciona tipo de evento...</option>
                  {eventTypes.map((t) => (
                    <option key={t.event_type_id} value={t.event_type_id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campos geográficos y clínica para eventos médicos */}
              {needsGeoClinic && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">¿A domicilio?</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="domicilio"
                          value="si"
                          checked={formData.domicilio === "si"}
                          onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
                        />
                        Sí
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="domicilio"
                          value="no"
                          checked={formData.domicilio === "no"}
                          onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
                        />
                        No
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Región</label>
                    <select
                      value={formData.region_id}
                      onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Seleccionar región...</option>
                      {regions.map((r) => (
                        <option key={r.region_id} value={r.region_id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Comuna</label>
                    <select
                      value={formData.comuna_id}
                      onChange={(e) => setFormData({ ...formData, comuna_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      disabled={!formData.region_id}
                    >
                      <option value="">Seleccionar comuna...</option>
                      {comunas.map((c) => (
                        <option key={c.comuna_id} value={c.comuna_id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {!domicilio && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Clínica</label>
                      <select
                        value={formData.clinic_id}
                        onChange={(e) => setFormData({ ...formData, clinic_id: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        disabled={!formData.comuna_id}
                      >
                        <option value="">Seleccionar clínica...</option>
                        {clinics.map((cl) => (
                          <option key={cl.clinic_id} value={cl.clinic_id}>{cl.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Veterinario</label>
                    <select
                      value={formData.vet_id}
                      onChange={(e) => setFormData({ ...formData, vet_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      disabled={domicilio ? !formData.comuna_id : !formData.clinic_id}
                    >
                      <option value="">Seleccionar veterinario...</option>
                      {(domicilio ? vetsByComuna : vetsByClinic).map((v) => (
                        <option key={v.vet_id} value={v.vet_id}>{v.full_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Campos de vacuna */}
              {typeId === "vaccine_administered" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la vacuna *</label>
                    <select
                      value={formData.vaccine_id}
                      onChange={(e) => setFormData({ ...formData, vaccine_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Seleccionar vacuna...</option>
                      {vaccines.map((v) => (
                        <option key={v.vaccine_id} value={v.vaccine_id}>{v.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de próxima dosis</label>
                    <input
                      type="date"
                      value={formData.next_due_date}
                      onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Lote de la vacuna</label>
                    <input
                      type="text"
                      value={formData.vaccine_batch}
                      onChange={(e) => setFormData({ ...formData, vaccine_batch: e.target.value })}
                      placeholder="Ej: LOT123456"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      maxLength={25}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Número de dosis</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.vaccine_dose_number}
                      onChange={(e) => setFormData({ ...formData, vaccine_dose_number: e.target.value })}
                      placeholder="Ej: 1, 2, 3..."
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de vencimiento de la vacuna</label>
                    <input
                      type="date"
                      value={formData.vaccine_expiration_date}
                      onChange={(e) => setFormData({ ...formData, vaccine_expiration_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Campo de dosis para medicamentos */}
              {typeId === "medication_dose" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dosis administrada (mg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.dose_mg}
                      onChange={(e) => setFormData({ ...formData, dose_mg: e.target.value })}
                      placeholder="Ej: 50"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Próxima dosis (fecha y hora)</label>
                    <input
                      type="datetime-local"
                      value={formData.next_dose_datetime}
                      onChange={(e) => setFormData({ ...formData, next_dose_datetime: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      min={formData.event_datetime}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Opcional. Se creará un evento futuro si se completa.
                    </p>
                  </div>
                </>
              )}

              {/* AQUÍ VA EL PASO 2G ⬇️ */}
              {typeId === "routine_check" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Próximo control (fecha y hora)</label>
                  <input
                    type="datetime-local"
                    value={formData.next_dose_datetime}
                    onChange={(e) => setFormData({ ...formData, next_dose_datetime: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    min={formData.event_datetime}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Opcional. Se creará un evento futuro si se completa.
                  </p>
                </div>
              )}

              {/* Descripción */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                <textarea
                  value={formData.e_description}
                  onChange={(e) => setFormData({ ...formData, e_description: e.target.value.slice(0, 250) })}
                  placeholder="Agrega notas o detalles adicionales sobre este evento..."
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                />
                <div className="text-right text-xs text-gray-500">
                  {formData.e_description.length}/250 caracteres
                </div>
              </div>
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