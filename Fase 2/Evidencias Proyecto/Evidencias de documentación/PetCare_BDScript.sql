-- ===========================================
-- PetCare BD
-- ===========================================

-- 1. INITIAL CONFIGURATION
CREATE SCHEMA IF NOT EXISTS petcare;
SET search_path TO petcare, public;

-- Required Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- ===========================================
-- 2. CATALOGS
-- ===========================================

-- User Roles
CREATE TABLE user_role_catalog (
  role_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO user_role_catalog (role_id, display_name) VALUES 
  ('owner', 'Owner'), ('vet', 'Veterinarian'), ('admin', 'Administrator') 
ON CONFLICT DO NOTHING;

-- Species
CREATE TABLE species_catalog (
  species_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO species_catalog (species_id, display_name) VALUES 
  ('dog', 'Dog'), ('cat', 'Cat'), ('other', 'Other') 
ON CONFLICT DO NOTHING;

-- Sex / Gender
CREATE TABLE sex_catalog (
  sex_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO sex_catalog (sex_id, display_name) VALUES 
  ('male', 'Male'), ('female', 'Female'), ('unknown', 'Unknown') 
ON CONFLICT DO NOTHING;

-- Pet Origin
CREATE TABLE pet_origin_catalog (
  origin_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO pet_origin_catalog (origin_id, display_name) VALUES 
  ('adopted', 'Adopted'), ('purchased', 'Purchased'), ('shelter', 'Shelter'), ('unknown', 'Unknown') 
ON CONFLICT DO NOTHING;

-- Pet Status
CREATE TABLE pet_status_catalog (
  status_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO pet_status_catalog (status_id, display_name) VALUES 
  ('active', 'Active'), ('deceased', 'Deceased'), ('transferred', 'Transferred') 
ON CONFLICT DO NOTHING;

-- Routine Types
CREATE TABLE routine_type_catalog (
  routine_type_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO routine_type_catalog (routine_type_id, display_name) VALUES 
  ('feeding', 'Feeding'), ('walk', 'Walk'), ('medication', 'Medication'), ('other', 'Other') 
ON CONFLICT DO NOTHING;

-- Event Types
CREATE TABLE event_type_catalog (
  event_type_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO event_type_catalog (event_type_id, display_name) VALUES 
  ('vaccine_administered', 'Vaccine'), ('medication_dose', 'Medication'), 
  ('walk', 'Walk'), ('weight_logged', 'Weight Log'), ('checkup', 'Checkup') 
ON CONFLICT DO NOTHING;

-- Document Types
CREATE TABLE doc_type_catalog (
  doc_type_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO doc_type_catalog (doc_type_id, display_name) VALUES 
  ('medical', 'Medical'), ('legal', 'Legal'), ('photo', 'Photo') 
ON CONFLICT DO NOTHING;

-- Expense Categories
CREATE TABLE expense_category_catalog (
  category_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO expense_category_catalog (category_id, display_name) VALUES 
  ('food', 'Food'), ('vet', 'Veterinary'), ('toys', 'Toys') 
ON CONFLICT DO NOTHING;

-- Alert Status
CREATE TABLE alert_status_catalog (
  status_id text NOT NULL PRIMARY KEY,
  display_name text NOT NULL UNIQUE
);
INSERT INTO alert_status_catalog (status_id, display_name) VALUES 
  ('scheduled', 'Scheduled'), ('sent', 'Sent'), ('completed', 'Completed'), ('cancelled', 'Cancelled'), ('skipped', 'Saltado') 
ON CONFLICT DO NOTHING;

-- Currency
CREATE TABLE currency (
  currency_id text NOT NULL PRIMARY KEY,
  name text NOT NULL,
  symbol text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
INSERT INTO currency (currency_id, name, symbol) VALUES 
  ('CLP', 'Chilean Peso', '$'), ('USD', 'US Dollar', '$') 
ON CONFLICT DO NOTHING;

-- Food Types (Sequential ID)
CREATE TABLE food_type (
  food_type_id SERIAL PRIMARY KEY,
  name text NOT NULL UNIQUE
);
INSERT INTO food_type (name) VALUES 
  ('Doguito') 
ON CONFLICT DO NOTHING;

-- ===========================================
-- 3. GEOGRAPHY
-- ===========================================
CREATE TABLE region (
  region_id SERIAL PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE comuna (
  comuna_id SERIAL PRIMARY KEY,
  region_id integer NOT NULL REFERENCES region(region_id),
  name text NOT NULL
);

INSERT INTO region (region_id, name) VALUES
  (15, 'Región de Arica y Parinacota'),
  (1, 'Región de Tarapacá'),
  (2, 'Región de Antofagasta'),
  (3, 'Región de Atacama'),
  (4, 'Región de Coquimbo'),
  (5, 'Región de Valparaíso'),
  (13, 'Región Metropolitana de Santiago'),
  (6, 'Región del Libertador General Bernardo O''Higgins'),
  (7, 'Región del Maule'),
  (16, 'Región de Ñuble'),
  (8, 'Región del Biobío'),
  (9, 'Región de La Araucanía'),
  (14, 'Región de Los Ríos'),
  (10, 'Región de Los Lagos'),
  (11, 'Región Aysén del General Carlos Ibáñez del Campo'),
  (12, 'Región de Magallanes y de la Antártica Chilena');


SELECT setval('region_region_id_seq', 20, true);

-- =========================
-- COMUNAS POR REGIÓN
-- =========================

-- Región XV - Arica y Parinacota
INSERT INTO comuna (region_id, name) VALUES
  (15, 'Arica'),
  (15, 'Camarones'),
  (15, 'General Lagos'),
  (15, 'Putre');

-- Región I - Tarapacá
INSERT INTO comuna (region_id, name) VALUES
  (1, 'Alto Hospicio'),
  (1, 'Camiña'),
  (1, 'Colchane'),
  (1, 'Huara'),
  (1, 'Iquique'),
  (1, 'Pica'),
  (1, 'Pozo Almonte');

-- Región II - Antofagasta
INSERT INTO comuna (region_id, name) VALUES
  (2, 'Antofagasta'),
  (2, 'Calama'),
  (2, 'María Elena'),
  (2, 'Mejillones'),
  (2, 'Ollagüe'),
  (2, 'San Pedro de Atacama'),
  (2, 'Sierra Gorda'),
  (2, 'Taltal'),
  (2, 'Tocopilla');

-- Región III - Atacama
INSERT INTO comuna (region_id, name) VALUES
  (3, 'Alto del Carmen'),
  (3, 'Caldera'),
  (3, 'Chañaral'),
  (3, 'Copiapó'),
  (3, 'Diego de Almagro'),
  (3, 'Freirina'),
  (3, 'Huasco'),
  (3, 'Tierra Amarilla'),
  (3, 'Vallenar');

-- Región IV - Coquimbo
INSERT INTO comuna (region_id, name) VALUES
  (4, 'Andacollo'),
  (4, 'Canela'),
  (4, 'Combarbalá'),
  (4, 'Coquimbo'),
  (4, 'Illapel'),
  (4, 'La Higuera'),
  (4, 'La Serena'),
  (4, 'Los Vilos'),
  (4, 'Monte Patria'),
  (4, 'Ovalle'),
  (4, 'Paiguano'),
  (4, 'Punitaqui'),
  (4, 'Río Hurtado'),
  (4, 'Salamanca'),
  (4, 'Vicuña');

-- Región V - Valparaíso
INSERT INTO comuna (region_id, name) VALUES
  (5, 'Algarrobo'),
  (5, 'Cabildo'),
  (5, 'Calera'),
  (5, 'Calle Larga'),
  (5, 'Cartagena'),
  (5, 'Casablanca'),
  (5, 'Catemu'),
  (5, 'Concón'),
  (5, 'El Quisco'),
  (5, 'El Tabo'),
  (5, 'Hijuelas'),
  (5, 'Isla de Pascua'),
  (5, 'Juan Fernández'),
  (5, 'La Cruz'),
  (5, 'La Ligua'),
  (5, 'Limache'),
  (5, 'Llaillay'),
  (5, 'Los Andes'),
  (5, 'Nogales'),
  (5, 'Olmué'),
  (5, 'Panquehue'),
  (5, 'Papudo'),
  (5, 'Petorca'),
  (5, 'Puchuncaví'),
  (5, 'Putaendo'),
  (5, 'Quillota'),
  (5, 'Quilpué'),
  (5, 'Quintero'),
  (5, 'Rinconada'),
  (5, 'San Antonio'),
  (5, 'San Esteban'),
  (5, 'San Felipe'),
  (5, 'Santa María'),
  (5, 'Santo Domingo'),
  (5, 'Valparaíso'),
  (5, 'Villa Alemana'),
  (5, 'Viña del Mar'),
  (5, 'Zapallar');

-- Región XIII - Metropolitana de Santiago
INSERT INTO comuna (region_id, name) VALUES
  (13, 'Alhué'),
  (13, 'Buin'),
  (13, 'Calera de Tango'),
  (13, 'Cerrillos'),
  (13, 'Cerro Navia'),
  (13, 'Colina'),
  (13, 'Conchalí'),
  (13, 'Curacaví'),
  (13, 'El Bosque'),
  (13, 'El Monte'),
  (13, 'Estación Central'),
  (13, 'Huechuraba'),
  (13, 'Independencia'),
  (13, 'Isla de Maipo'),
  (13, 'La Cisterna'),
  (13, 'La Florida'),
  (13, 'La Granja'),
  (13, 'La Pintana'),
  (13, 'La Reina'),
  (13, 'Lampa'),
  (13, 'Las Condes'),
  (13, 'Lo Barnechea'),
  (13, 'Lo Espejo'),
  (13, 'Lo Prado'),
  (13, 'Macul'),
  (13, 'Maipú'),
  (13, 'María Pinto'),
  (13, 'Melipilla'),
  (13, 'Ñuñoa'),
  (13, 'Padre Hurtado'),
  (13, 'Paine'),
  (13, 'Pedro Aguirre Cerda'),
  (13, 'Peñaflor'),
  (13, 'Peñalolén'),
  (13, 'Pirque'),
  (13, 'Providencia'),
  (13, 'Pudahuel'),
  (13, 'Puente Alto'),
  (13, 'Quilicura'),
  (13, 'Quinta Normal'),
  (13, 'Recoleta'),
  (13, 'Renca'),
  (13, 'San Bernardo'),
  (13, 'San Joaquín'),
  (13, 'San José de Maipo'),
  (13, 'San Miguel'),
  (13, 'San Pedro'),
  (13, 'San Ramón'),
  (13, 'Santiago'),
  (13, 'Talagante'),
  (13, 'Tiltil'),
  (13, 'Vitacura');

-- Región VI - O'Higgins
INSERT INTO comuna (region_id, name) VALUES
  (6, 'Chépica'),
  (6, 'Chimbarongo'),
  (6, 'Codegua'),
  (6, 'Coinco'),
  (6, 'Coltauco'),
  (6, 'Doñihue'),
  (6, 'Graneros'),
  (6, 'La Estrella'),
  (6, 'Las Cabras'),
  (6, 'Litueche'),
  (6, 'Lolol'),
  (6, 'Machalí'),
  (6, 'Malloa'),
  (6, 'Marchihue'),
  (6, 'Mostazal'),
  (6, 'Nancagua'),
  (6, 'Navidad'),
  (6, 'Olivar'),
  (6, 'Palmilla'),
  (6, 'Paredones'),
  (6, 'Peralillo'),
  (6, 'Peumo'),
  (6, 'Pichidegua'),
  (6, 'Pichilemu'),
  (6, 'Placilla'),
  (6, 'Pumanque'),
  (6, 'Quinta de Tilcoco'),
  (6, 'Rancagua'),
  (6, 'Rengo'),
  (6, 'Requínoa'),
  (6, 'San Fernando'),
  (6, 'San Vicente'),
  (6, 'Santa Cruz');

-- Región VII - Maule
INSERT INTO comuna (region_id, name) VALUES
  (7, 'Cauquenes'),
  (7, 'Chanco'),
  (7, 'Colbún'),
  (7, 'Constitución'),
  (7, 'Curepto'),
  (7, 'Curicó'),
  (7, 'Empedrado'),
  (7, 'Hualañé'),
  (7, 'Licantén'),
  (7, 'Linares'),
  (7, 'Longaví'),
  (7, 'Maule'),
  (7, 'Molina'),
  (7, 'Parral'),
  (7, 'Pelarco'),
  (7, 'Pelluhue'),
  (7, 'Pencahue'),
  (7, 'Rauco'),
  (7, 'Retiro'),
  (7, 'Río Claro'),
  (7, 'Romeral'),
  (7, 'Sagrada Familia'),
  (7, 'San Clemente'),
  (7, 'San Javier'),
  (7, 'San Rafael'),
  (7, 'Talca'),
  (7, 'Teno'),
  (7, 'Vichuquén'),
  (7, 'Villa Alegre'),
  (7, 'Yerbas Buenas');

-- Región XVI - Ñuble
INSERT INTO comuna (region_id, name) VALUES
  (16, 'Bulnes'),
  (16, 'Chillán'),
  (16, 'Chillán Viejo'),
  (16, 'Cobquecura'),
  (16, 'Coelemu'),
  (16, 'Coihueco'),
  (16, 'El Carmen'),
  (16, 'Ninhue'),
  (16, 'Ñiquén'),
  (16, 'Pemuco'),
  (16, 'Pinto'),
  (16, 'Portezuelo'),
  (16, 'Quillón'),
  (16, 'Quirihue'),
  (16, 'Ránquil'),
  (16, 'San Carlos'),
  (16, 'San Fabián'),
  (16, 'San Ignacio'),
  (16, 'San Nicolás'),
  (16, 'Treguaco'),
  (16, 'Yungay');

-- Región VIII - Biobío
INSERT INTO comuna (region_id, name) VALUES
  (8, 'Alto Biobío'),
  (8, 'Antuco'),
  (8, 'Arauco'),
  (8, 'Cabrero'),
  (8, 'Cañete'),
  (8, 'Chiguayante'),
  (8, 'Concepción'),
  (8, 'Contulmo'),
  (8, 'Coronel'),
  (8, 'Curanilahue'),
  (8, 'Florida'),
  (8, 'Hualqui'),
  (8, 'Huépil'),
  (8, 'Laja'),
  (8, 'Lebu'),
  (8, 'Los Álamos'),
  (8, 'Los Ángeles'),
  (8, 'Lota'),
  (8, 'Mulchén'),
  (8, 'Nacimiento'),
  (8, 'Negrete'),
  (8, 'Penco'),
  (8, 'Quilaco'),
  (8, 'Quilleco'),
  (8, 'San Pedro de la Paz'),
  (8, 'San Rosendo'),
  (8, 'Santa Bárbara'),
  (8, 'Santa Juana'),
  (8, 'Talcahuano'),
  (8, 'Tirúa'),
  (8, 'Tomé'),
  (8, 'Tucapel'),
  (8, 'Yumbel');

-- Región IX - La Araucanía
INSERT INTO comuna (region_id, name) VALUES
  (9, 'Angol'),
  (9, 'Carahue'),
  (9, 'Cholchol'),
  (9, 'Collipulli'),
  (9, 'Cunco'),
  (9, 'Curacautín'),
  (9, 'Curarrehue'),
  (9, 'Ercilla'),
  (9, 'Freire'),
  (9, 'Galvarino'),
  (9, 'Gorbea'),
  (9, 'Lautaro'),
  (9, 'Loncoche'),
  (9, 'Lonquimay'),
  (9, 'Los Sauces'),
  (9, 'Lumaco'),
  (9, 'Melipeuco'),
  (9, 'Nueva Imperial'),
  (9, 'Padre Las Casas'),
  (9, 'Perquenco'),
  (9, 'Pitrufquén'),
  (9, 'Pucón'),
  (9, 'Purén'),
  (9, 'Renaico'),
  (9, 'Saavedra'),
  (9, 'Temuco'),
  (9, 'Teodoro Schmidt'),
  (9, 'Toltén'),
  (9, 'Traiguén'),
  (9, 'Victoria'),
  (9, 'Vilcún'),
  (9, 'Villarrica');

-- Región XIV - Los Ríos
INSERT INTO comuna (region_id, name) VALUES
  (14, 'Corral'),
  (14, 'Futrono'),
  (14, 'La Unión'),
  (14, 'Lago Ranco'),
  (14, 'Lanco'),
  (14, 'Los Lagos'),
  (14, 'Máfil'),
  (14, 'Mariquina'),
  (14, 'Paillaco'),
  (14, 'Panguipulli'),
  (14, 'Río Bueno'),
  (14, 'Valdivia');

-- Región X - Los Lagos
INSERT INTO comuna (region_id, name) VALUES
  (10, 'Ancud'),
  (10, 'Calbuco'),
  (10, 'Castro'),
  (10, 'Chaitén'),
  (10, 'Chonchi'),
  (10, 'Cochamó'),
  (10, 'Curaco de Vélez'),
  (10, 'Dalcahue'),
  (10, 'Fresia'),
  (10, 'Frutillar'),
  (10, 'Futaleufú'),
  (10, 'Hualaihué'),
  (10, 'Llanquihue'),
  (10, 'Los Muermos'),
  (10, 'Maullín'),
  (10, 'Osorno'),
  (10, 'Palena'),
  (10, 'Puerto Montt'),
  (10, 'Puerto Octay'),
  (10, 'Puerto Varas'),
  (10, 'Puqueldón'),
  (10, 'Purranque'),
  (10, 'Puyehue'),
  (10, 'Queilén'),
  (10, 'Quellón'),
  (10, 'Quemchi'),
  (10, 'Quinchao'),
  (10, 'Río Negro'),
  (10, 'San Juan de la Costa'),
  (10, 'San Pablo');

-- Región XI - Aysén
INSERT INTO comuna (region_id, name) VALUES
  (11, 'Aysén'),
  (11, 'Chile Chico'),
  (11, 'Cisnes'),
  (11, 'Cochrane'),
  (11, 'Coyhaique'),
  (11, 'Guaitecas'),
  (11, 'Lago Verde'),
  (11, 'O''Higgins'),
  (11, 'Río Ibáñez'),
  (11, 'Tortel');

-- Región XII - Magallanes
INSERT INTO comuna (region_id, name) VALUES
  (12, 'Antártica'),
  (12, 'Cabo de Hornos'),
  (12, 'Laguna Blanca'),
  (12, 'Natales'),
  (12, 'Porvenir'),
  (12, 'Primavera'),
  (12, 'Punta Arenas'),
  (12, 'Río Verde'),
  (12, 'San Gregorio'),
  (12, 'Timaukel'),
  (12, 'Torres del Paine');

-- ===========================================
-- 4. USERS AND MAIN ACTORS
-- ===========================================

-- App User (Extension of auth.users)
CREATE TABLE app_user (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  gender text,
  comuna_id integer REFERENCES comuna(comuna_id),
  birth_date date CHECK (birth_date IS NULL OR birth_date >= '1900-01-01'::date AND birth_date <= CURRENT_DATE),
  email text UNIQUE,
  rut text UNIQUE,
  avatar_url text,
  role_id text REFERENCES user_role_catalog(role_id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Personally Identifiable Information (PII)
CREATE TABLE user_pii (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES app_user(user_id),
  address_line text,
  phone text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User Devices (For Push Notifications)
CREATE TABLE user_device (
  device_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user(user_id),
  platform text CHECK (platform = ANY (ARRAY['web'::text, 'android'::text, 'ios'::text])),
  fcm_token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- External Caregivers (Walkers, Sitters, etc.)
CREATE TABLE caregiver (
  caregiver_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text UNIQUE,
  relation text,
  comuna_id integer REFERENCES comuna(comuna_id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Clinics and Vets
CREATE TABLE clinic (
  clinic_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  comuna_id integer REFERENCES comuna(comuna_id),
  address text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE vet (
  vet_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid REFERENCES clinic(clinic_id),
  full_name text NOT NULL,
  user_id uuid UNIQUE REFERENCES app_user(user_id),
  comuna_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ===========================================
-- 5. PETS
-- ===========================================

CREATE TABLE pet (
  pet_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user(user_id),
  name text NOT NULL,
  species_id text NOT NULL REFERENCES species_catalog(species_id),
  breed text,
  image_url text,
  sex_id text NOT NULL DEFAULT 'unknown'::text REFERENCES sex_catalog(sex_id),
  birth_date date,
  microchip text,
  neutered boolean NOT NULL DEFAULT false,
  origin_id text NOT NULL DEFAULT 'unknown'::text REFERENCES pet_origin_catalog(origin_id),
  acquired_at date,
  owner_since timestamp with time zone DEFAULT now(),
  status_id text NOT NULL DEFAULT 'active'::text REFERENCES pet_status_catalog(status_id),
  deceased_at date,
  cause_of_death text,
  current_weight numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Pet <-> Caregiver Relation
CREATE TABLE pet_caregiver (
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  caregiver_id uuid NOT NULL REFERENCES caregiver(caregiver_id),
  role_name text,
  permissions text[],
  charge numeric CHECK (charge > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (pet_id, caregiver_id)
);

-- Pet <-> Member Relation (Shared ownership/access)
CREATE TABLE pet_member (
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  member_user_id uuid NOT NULL REFERENCES app_user(user_id),
  member_role_id text NOT NULL REFERENCES user_role_catalog(role_id),
  permissions text[] DEFAULT ARRAY['view'::text, 'upload_docs'::text, 'create_events'::text],
  invited_by uuid REFERENCES app_user(user_id),
  invited_at timestamp with time zone DEFAULT now(),
  revoked_by uuid REFERENCES app_user(user_id),
  revoked_at timestamp with time zone,
  status text DEFAULT ''::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (pet_id, member_user_id)
);

-- Ownership History
CREATE TABLE pet_ownership_history (
  history_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  previous_owner_id uuid REFERENCES app_user(user_id),
  new_owner_id uuid REFERENCES app_user(user_id),
  transfer_date timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  document_id uuid, -- Reference added later to avoid circular dependency
  previous_status_id text NOT NULL REFERENCES pet_status_catalog(status_id),
  new_status_id text NOT NULL REFERENCES pet_status_catalog(status_id),
  confirmed_by_previous boolean DEFAULT false,
  confirmation_token text,
  token_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ===========================================
-- 6. DOCUMENTS AND STORAGE
-- ===========================================

CREATE TABLE document (
  doc_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_kind text NOT NULL, 
  owner_user_id uuid REFERENCES app_user(user_id),
  owner_pet_id uuid REFERENCES pet(pet_id),
  doc_category_id text NOT NULL REFERENCES doc_type_catalog(doc_type_id),
  title text,
  storage_path text NOT NULL,
  hash_sha256 text,
  created_by uuid REFERENCES app_user(user_id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone
);

-- Add Circular FK for ownership history document
ALTER TABLE pet_ownership_history 
ADD CONSTRAINT fk_ownership_document FOREIGN KEY (document_id) REFERENCES document(doc_id);

-- ===========================================
-- 7. EVENTS, ROUTINES AND HEALTH
-- ===========================================

-- Routines
CREATE TABLE routine (
  routine_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  user_id uuid REFERENCES app_user(user_id),
  routine_type_id text NOT NULL REFERENCES routine_type_catalog(routine_type_id),
  title text,
  description text,
  rrule text, -- Recurrence Rule (iCal format)
  time_local time without time zone,
  active boolean NOT NULL DEFAULT true,
  status_id text REFERENCES alert_status_catalog(status_id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Alerts and Notifications
CREATE TABLE alert (
  alert_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user(user_id),
  routine_id uuid REFERENCES routine(routine_id),
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  title text,
  body text,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  completed_by uuid REFERENCES app_user(user_id),
  status_id text NOT NULL DEFAULT 'scheduled'::text REFERENCES alert_status_catalog(status_id),
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels text[] NOT NULL DEFAULT '{email}'::text[] CHECK (channels <@ ARRAY['email'::text, 'sms'::text, 'push'::text]),
  priority smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Activity Log
CREATE TABLE activity_log (
  log_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id uuid REFERENCES routine(routine_id),
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  status_id text NOT NULL REFERENCES alert_status_catalog(status_id),
  notes text,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Vaccines (Base Catalog)
CREATE TABLE vaccine (
  vaccine_id SERIAL PRIMARY KEY,
  name text NOT NULL,
  species_id text NOT NULL REFERENCES species_catalog(species_id)
);

-- Main Events
CREATE TABLE event (
  event_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  user_id uuid NOT NULL REFERENCES app_user(user_id),
  e_type_id text NOT NULL REFERENCES event_type_catalog(event_type_id),
  ts timestamp with time zone NOT NULL DEFAULT now(),
  period_yyyymm integer,
  comuna_id integer REFERENCES comuna(comuna_id),
  clinic_id uuid REFERENCES clinic(clinic_id),
  vet_id uuid REFERENCES vet(vet_id),
  e_description text CHECK (length(e_description) <= 250),
  
  -- Event Specific Data
  duration_min integer,
  distance_m integer,
  dose_mg numeric,
  var_weight jsonb,
  details jsonb,
  
  -- Financial Data
  charge numeric CHECK (charge > 0::numeric),
  currency_id text REFERENCES currency(currency_id),
  
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Vaccine Events (Detailing batch and expiration)
CREATE TABLE vaccine_event (
  event_id uuid NOT NULL PRIMARY KEY REFERENCES event(event_id),
  vaccine_id integer NOT NULL REFERENCES vaccine(vaccine_id),
  next_due_date date,
  vaccine_batch text DEFAULT ''::text CHECK (length(vaccine_batch) <= 25),
  vaccine_dose_number integer CHECK (vaccine_dose_number >= 0),
  vaccine_expiration_date date CHECK (vaccine_expiration_date > CURRENT_DATE),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ===========================================
-- 8. FINANCES AND DIET
-- ===========================================

CREATE TABLE expense (
  expense_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_user(user_id),
  pet_id uuid REFERENCES pet(pet_id),
  category_id text NOT NULL REFERENCES expense_category_catalog(category_id),
  amount numeric NOT NULL CHECK (amount >= 0::numeric),
  currency_id text NOT NULL DEFAULT 'CLP'::text REFERENCES currency(currency_id),
  spent_at date NOT NULL,
  comuna_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE pet_diet (
  pet_diet_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES pet(pet_id),
  user_id uuid NOT NULL REFERENCES app_user(user_id),
  food_type_id integer NOT NULL REFERENCES food_type(food_type_id),
  brand text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  price numeric CHECK (price > 0::numeric),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ===========================================
-- 9. AUDITING
-- ===========================================

CREATE TABLE audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES app_user(user_id),
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  action text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text])),
  details jsonb,
  client_ip inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ===========================================
-- 10. FUNCTIONS AND TRIGGERS
-- ===========================================

-- Function to automatically calculate YYYYMM for events
CREATE OR REPLACE FUNCTION set_period_yyyymm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.period_yyyymm := (EXTRACT(YEAR FROM NEW.ts)::INT * 100) + EXTRACT(MONTH FROM NEW.ts)::INT;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_period_yyyymm
BEFORE INSERT OR UPDATE ON event
FOR EACH ROW EXECUTE FUNCTION set_period_yyyymm();

-- Function for automatic pet update auditing
CREATE OR REPLACE FUNCTION log_pet_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pet_id UUID;
  v_user_id UUID;
BEGIN
  v_pet_id := COALESCE(NEW.pet_id, OLD.pet_id);
  v_user_id := auth.uid(); -- Attempts to get the authenticated user
  
  INSERT INTO audit_log (user_id, resource_type, resource_id, action, status, created_at)
  VALUES (v_user_id, 'pet', v_pet_id, TG_OP, 'success', now());
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_pet_update
AFTER INSERT OR UPDATE OR DELETE ON pet
FOR EACH ROW EXECUTE FUNCTION log_pet_update();

-- ===========================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on main tables
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet ENABLE ROW LEVEL SECURITY;
ALTER TABLE event ENABLE ROW LEVEL SECURITY;
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccine_event ENABLE ROW LEVEL SECURITY;

-- Basic Policies

-- Users
CREATE POLICY "Users view their own profile" ON app_user 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users edit their own profile" ON app_user 
FOR UPDATE USING (user_id = auth.uid());

-- Pets
CREATE POLICY "Users view their own pets" ON pet 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users create their own pets" ON pet 
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Events
CREATE POLICY "Users view events for their pets" ON event 
FOR SELECT USING (pet_id IN (SELECT pet_id FROM pet WHERE user_id = auth.uid()));

-- Expenses
CREATE POLICY "Users view their own expenses" ON expense 
FOR SELECT USING (user_id = auth.uid());
