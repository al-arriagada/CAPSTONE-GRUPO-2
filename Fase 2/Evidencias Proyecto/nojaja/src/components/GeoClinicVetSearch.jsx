import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function GeoClinicVetSearch() {
  const [regions, setRegions] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [vets, setVets] = useState([]);

  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedComuna, setSelectedComuna] = useState(null);
  const [selectedClinic, setSelectedClinic] = useState(null);

  const [searchRegion, setSearchRegion] = useState("");
  const [searchComuna, setSearchComuna] = useState("");
  const [searchClinic, setSearchClinic] = useState("");
  const [searchVet, setSearchVet] = useState("");

  const [filteredRegions, setFilteredRegions] = useState([]);
  const [filteredComunas, setFilteredComunas] = useState([]);
  const [filteredClinics, setFilteredClinics] = useState([]);
  const [filteredVets, setFilteredVets] = useState([]);

  /** 🔹 Cargar regiones */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .schema("petcare")
        .from("region")
        .select("region_id, name")
        .order("name");
      if (!error && data) {
        setRegions(data);
        setFilteredRegions(data);
      }
    })();
  }, []);

  /** 🔹 Cargar comunas según región seleccionada */
  useEffect(() => {
    if (!selectedRegion) return;
    (async () => {
      const { data, error } = await supabase
        .schema("petcare")
        .from("comuna")
        .select("comuna_id, name")
        .eq("region_id", selectedRegion.region_id)
        .order("name");
      if (!error && data) {
        setComunas(data);
        setFilteredComunas(data);
      }
    })();
  }, [selectedRegion]);

  /** 🔹 Cargar clínicas y veterinarios según comuna */
  useEffect(() => {
    if (!selectedComuna) return;
    (async () => {
      const [{ data: clinicData }, { data: vetData, error: vetError }] = await Promise.all([
        supabase
          .schema("petcare")
          .from("clinic")
          .select("clinic_id, name, address, phone, logo_url")
          .eq("comuna_id", selectedComuna.comuna_id)
          .order("name"),
        supabase
          .schema("petcare")
          .from("vet")
          .select(`
            vet_id,
            full_name,
            clinic_id,
            user_id,
            app_user:app_user!inner(avatar_url)
          `)
          .eq("comuna_id", selectedComuna.comuna_id)
          .order("full_name"),
      ]);

      if (!vetError) {
        setClinics(clinicData || []);
        setFilteredClinics(clinicData || []);
        setVets(vetData || []);
        setFilteredVets(vetData || []);
      } else {
        console.error("Error loading vets:", vetError);
      }
    })();
  }, [selectedComuna]);

  /** 🔹 Filtros dinámicos */
  useEffect(() => setFilteredRegions(regions.filter(r => r.name.toLowerCase().includes(searchRegion.toLowerCase()))), [searchRegion, regions]);
  useEffect(() => setFilteredComunas(comunas.filter(c => c.name.toLowerCase().includes(searchComuna.toLowerCase()))), [searchComuna, comunas]);
  useEffect(() => setFilteredClinics(clinics.filter(cl => cl.name.toLowerCase().includes(searchClinic.toLowerCase()))), [searchClinic, clinics]);
  useEffect(() => setFilteredVets(vets.filter(v => v.full_name.toLowerCase().includes(searchVet.toLowerCase()))), [searchVet, vets]);

  return (
    <div className="p-6 bg-gray-50 border rounded-2xl max-w-xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-center mb-2">
        Buscar Región, Comuna, Clínica y Veterinario
      </h2>

      {/* Región */}
      <SearchField
        label="Región"
        placeholder="Ej: Metropolitana"
        value={searchRegion}
        setValue={setSearchRegion}
        data={filteredRegions.map(r => ({ ...r, display_name: r.name }))}
        onSelect={r => {
          setSelectedRegion(r);
          setSelectedComuna(null);
          setSelectedClinic(null);
          setSearchComuna("");
          setSearchClinic("");
          setSearchVet("");
        }}
        icon="/icons/region.png"
      />

      {/* Comuna */}
      {selectedRegion && (
        <SearchField
          label="Comuna"
          placeholder="Ej: Ñuñoa"
          value={searchComuna}
          setValue={setSearchComuna}
          data={filteredComunas.map(c => ({ ...c, display_name: c.name }))}
          onSelect={c => {
            setSelectedComuna(c);
            setSelectedClinic(null);
            setSearchClinic("");
            setSearchVet("");
          }}
          icon="/icons/comuna.png"
        />
      )}

      {/* Clínica */}
      {selectedComuna && (
        <SearchField
          label="Clínica veterinaria"
          placeholder="Ej: Clínica PetSalud"
          value={searchClinic}
          setValue={setSearchClinic}
          data={filteredClinics.map(cl => ({
            ...cl,
            display_name: cl.name,
            image: cl.logo_url || "/icons/clinic.png",
          }))}
          onSelect={setSelectedClinic}
        />
      )}

      {/* Veterinario */}
      {selectedComuna && (
        <SearchField
          label="Médico veterinario"
          placeholder="Ej: Carla Torres"
          value={searchVet}
          setValue={setSearchVet}
          data={filteredVets.map(v => ({
            ...v,
            display_name: v.full_name + (v.clinic_id ? " — Clínica asociada" : " — Freelance"),
            image: v.app_user?.avatar_url || "/icons/vet.png",
          }))}
          onSelect={v => setSearchVet(v.full_name)}
        />
      )}

      {/* Resumen de selección */}
      {(selectedRegion || selectedComuna || selectedClinic || searchVet) && (
        <div className="border-t pt-4 text-sm text-gray-700 space-y-1">
          {selectedRegion && <p><strong>Región:</strong> {selectedRegion.name}</p>}
          {selectedComuna && <p><strong>Comuna:</strong> {selectedComuna.name}</p>}
          {selectedClinic && <p><strong>Clínica:</strong> {selectedClinic.name}</p>}
          {searchVet && <p><strong>Veterinario:</strong> {searchVet}</p>}
        </div>
      )}
    </div>
  );
}

/** 🔧 Subcomponente reutilizable con imagen */
function SearchField({ label, placeholder, value, setValue, data, onSelect, icon }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <input
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        />
        <img
          src={icon}
          alt=""
          className="w-5 h-5 absolute right-3 top-2.5 opacity-70 pointer-events-none"
        />
      </div>
      {value && data.length > 0 && (
        <ul className="border rounded-lg mt-2 max-h-48 overflow-y-auto bg-white shadow-sm divide-y">
          {data.map((item) => (
            <li
              key={item.region_id || item.comuna_id || item.clinic_id || item.vet_id}
              onClick={() => {
                onSelect(item);
                setValue(item.display_name);
              }}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt="icono"
                  className="w-8 h-8 rounded-full object-cover border"
                />
              )}
              <span>{item.display_name}</span>
            </li>
          ))}
        </ul>
      )}
      {value && data.length === 0 && (
        <p className="text-sm text-gray-500 mt-2">No se encontraron resultados.</p>
      )}
    </div>
  );
}