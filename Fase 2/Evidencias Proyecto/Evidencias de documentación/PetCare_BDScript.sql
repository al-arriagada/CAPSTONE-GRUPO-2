-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE petcare.alert_status_catalog (
  status_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT alert_status_catalog_pkey PRIMARY KEY (status_id)
);

CREATE TABLE petcare.currency (
  currency_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  symbol text NOT NULL,
  CONSTRAINT currency_pkey PRIMARY KEY (currency_id)
);

CREATE TABLE petcare.doc_type_catalog (
  doc_type_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT doc_type_catalog_pkey PRIMARY KEY (doc_type_id)
);

CREATE TABLE petcare.event_type_catalog (
  event_type_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT event_type_catalog_pkey PRIMARY KEY (event_type_id)
);

CREATE TABLE petcare.expense_category_catalog (
  category_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT expense_category_catalog_pkey PRIMARY KEY (category_id)
);

CREATE TABLE petcare.pet_origin_catalog (
  origin_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT pet_origin_catalog_pkey PRIMARY KEY (origin_id)
);

CREATE TABLE petcare.pet_status_catalog (
  status_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT pet_status_catalog_pkey PRIMARY KEY (status_id)
);

CREATE TABLE petcare.region (
  region_id integer NOT NULL DEFAULT nextval('petcare.region_region_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT region_pkey PRIMARY KEY (region_id)
);

CREATE TABLE petcare.comuna (
  comuna_id integer NOT NULL DEFAULT nextval('petcare.comuna_comuna_id_seq'::regclass),
  region_id integer NOT NULL,
  name text NOT NULL,
  CONSTRAINT comuna_pkey PRIMARY KEY (comuna_id),
  CONSTRAINT comuna_region_id_fkey FOREIGN KEY (region_id) REFERENCES petcare.region(region_id)
);

CREATE TABLE petcare.food_type (
  food_type_id integer NOT NULL DEFAULT nextval('petcare.food_type_food_type_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT food_type_pkey PRIMARY KEY (food_type_id)
);

CREATE TABLE petcare.routine_type_catalog (
  routine_type_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT routine_type_catalog_pkey PRIMARY KEY (routine_type_id)
);

CREATE TABLE petcare.sex_catalog (
  sex_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT sex_catalog_pkey PRIMARY KEY (sex_id)
);

CREATE TABLE petcare.species_catalog (
  species_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT species_catalog_pkey PRIMARY KEY (species_id)
);

CREATE TABLE petcare.user_role_catalog (
  role_id text NOT NULL,
  display_name text NOT NULL UNIQUE,
  CONSTRAINT user_role_catalog_pkey PRIMARY KEY (role_id)
);

CREATE TABLE petcare.clinic (
  clinic_id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  comuna_id integer,
  address text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinic_pkey PRIMARY KEY (clinic_id),
  CONSTRAINT clinic_comuna_id_fkey FOREIGN KEY (comuna_id) REFERENCES petcare.comuna(comuna_id)
);

CREATE TABLE petcare.caregiver (
  caregiver_id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email USER-DEFINED UNIQUE,
  relation text,
  comuna_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT caregiver_pkey PRIMARY KEY (caregiver_id),
  CONSTRAINT caregiver_comuna_id_fkey FOREIGN KEY (comuna_id) REFERENCES petcare.comuna(comuna_id)
);

CREATE TABLE petcare.app_user (
  user_id uuid NOT NULL,
  full_name text,
  gender text,
  comuna_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  birth_date date CHECK (birth_date IS NULL OR birth_date >= '1900-01-01'::date AND birth_date <= CURRENT_DATE),
  email USER-DEFINED UNIQUE,
  rut text UNIQUE,
  avatar_url text,
  role_id text,
  CONSTRAINT app_user_pkey PRIMARY KEY (user_id),
  CONSTRAINT app_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT app_user_comuna_id_fkey FOREIGN KEY (comuna_id) REFERENCES petcare.comuna(comuna_id),
  CONSTRAINT app_user_role_id_fkey FOREIGN KEY (role_id) REFERENCES petcare.user_role_catalog(role_id)
);

CREATE TABLE petcare.pet (
  pet_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  species_id text NOT NULL,
  breed text,
  image_url text,
  sex_id text NOT NULL DEFAULT 'unknown'::text,
  birth_date date,
  microchip text,
  neutered boolean NOT NULL DEFAULT false,
  origin_id text NOT NULL DEFAULT 'unknown'::text,
  acquired_at date,
  owner_since timestamp with time zone DEFAULT now(),
  status_id text NOT NULL DEFAULT 'active'::text,
  deceased_at date,
  cause_of_death text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  current_weight numeric,
  deleted_at timestamp with time zone,
  CONSTRAINT pet_pkey PRIMARY KEY (pet_id),
  CONSTRAINT pet_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT pet_species_id_fkey FOREIGN KEY (species_id) REFERENCES petcare.species_catalog(species_id),
  CONSTRAINT pet_sex_id_fkey FOREIGN KEY (sex_id) REFERENCES petcare.sex_catalog(sex_id),
  CONSTRAINT pet_origin_id_fkey FOREIGN KEY (origin_id) REFERENCES petcare.pet_origin_catalog(origin_id),
  CONSTRAINT pet_status_id_fkey FOREIGN KEY (status_id) REFERENCES petcare.pet_status_catalog(status_id)
);

CREATE TABLE petcare.vet (
  vet_id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid,
  full_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid UNIQUE,
  comuna_id integer,
  CONSTRAINT vet_pkey PRIMARY KEY (vet_id),
  CONSTRAINT vet_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES petcare.clinic(clinic_id),
  CONSTRAINT vet_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id)
);

CREATE TABLE petcare.document (
  doc_id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_kind USER-DEFINED NOT NULL,
  owner_user_id uuid,
  owner_pet_id uuid,
  doc_category_id text NOT NULL,
  title text,
  storage_path text NOT NULL,
  hash_sha256 text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT document_pkey PRIMARY KEY (doc_id),
  CONSTRAINT document_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT document_owner_pet_id_fkey FOREIGN KEY (owner_pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT document_doc_category_id_fkey FOREIGN KEY (doc_category_id) REFERENCES petcare.doc_type_catalog(doc_type_id),
  CONSTRAINT document_created_by_fkey FOREIGN KEY (created_by) REFERENCES petcare.app_user(user_id)
);

CREATE TABLE petcare.vaccine (
  vaccine_id integer NOT NULL DEFAULT nextval('petcare.vaccine_vaccine_id_seq'::regclass),
  name text NOT NULL,
  species_id text NOT NULL,
  CONSTRAINT vaccine_pkey PRIMARY KEY (vaccine_id),
  CONSTRAINT vaccine_species_id_fkey FOREIGN KEY (species_id) REFERENCES petcare.species_catalog(species_id)
);

CREATE TABLE petcare.event (
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  user_id uuid NOT NULL,
  e_type_id text NOT NULL,
  ts timestamp with time zone NOT NULL DEFAULT now(),
  period_yyyymm integer,
  comuna_id integer,
  duration_min integer,
  distance_m integer,
  dose_mg numeric,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  clinic_id uuid,
  e_description text CHECK (length(e_description) <= 250),
  vet_id uuid,
  var_weight jsonb,
  charge numeric CHECK (charge > 0::numeric),
  currency_id text,
  CONSTRAINT event_pkey PRIMARY KEY (event_id),
  CONSTRAINT event_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT event_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT event_e_type_id_fkey FOREIGN KEY (e_type_id) REFERENCES petcare.event_type_catalog(event_type_id),
  CONSTRAINT event_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES petcare.vet(vet_id),
  CONSTRAINT event_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES petcare.clinic(clinic_id),
  CONSTRAINT event_comuna_id_fkey FOREIGN KEY (comuna_id) REFERENCES petcare.comuna(comuna_id),
  CONSTRAINT event_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES petcare.currency(currency_id)
);

CREATE TABLE petcare.vaccine_event (
  event_id uuid NOT NULL,
  vaccine_id integer NOT NULL,
  next_due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  vaccine_batch text DEFAULT ''::text CHECK (length(vaccine_batch) <= 25),
  vaccine_dose_number integer CHECK (vaccine_dose_number >= 0),
  vaccine_expiration_date date CHECK (vaccine_expiration_date > CURRENT_DATE),
  CONSTRAINT vaccine_event_pkey PRIMARY KEY (event_id),
  CONSTRAINT vaccine_event_event_id_fkey FOREIGN KEY (event_id) REFERENCES petcare.event(event_id),
  CONSTRAINT vaccine_event_vaccine_id_fkey FOREIGN KEY (vaccine_id) REFERENCES petcare.vaccine(vaccine_id)
);

CREATE TABLE petcare.expense (
  expense_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pet_id uuid,
  category_id text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0::numeric),
  currency_id text NOT NULL DEFAULT 'CLP'::text,
  spent_at date NOT NULL,
  comuna_id integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT expense_pkey PRIMARY KEY (expense_id),
  CONSTRAINT expense_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT expense_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT expense_category_id_fkey FOREIGN KEY (category_id) REFERENCES petcare.expense_category_catalog(category_id),
  CONSTRAINT expense_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES petcare.currency(currency_id)
);

CREATE TABLE petcare.pet_diet (
  pet_diet_id uuid NOT NULL DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  food_type_id integer NOT NULL,
  brand text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  price numeric CHECK (price > 0::numeric),
  user_id uuid NOT NULL,
  CONSTRAINT pet_diet_pkey PRIMARY KEY (pet_diet_id),
  CONSTRAINT pet_diet_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT pet_diet_food_type_id_fkey FOREIGN KEY (food_type_id) REFERENCES petcare.food_type(food_type_id),
  CONSTRAINT pet_diet_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id)
);

CREATE TABLE petcare.pet_caregiver (
  pet_id uuid NOT NULL,
  caregiver_id uuid NOT NULL,
  role_name text,
  permissions ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  charge numeric CHECK (charge > 0::numeric),
  CONSTRAINT pet_caregiver_pkey PRIMARY KEY (pet_id, caregiver_id),
  CONSTRAINT pet_caregiver_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT pet_caregiver_caregiver_id_fkey FOREIGN KEY (caregiver_id) REFERENCES petcare.caregiver(caregiver_id)
);

CREATE TABLE petcare.pet_member (
  pet_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  member_role_id text NOT NULL,
  permissions ARRAY DEFAULT ARRAY['view'::text, 'upload_docs'::text, 'create_events'::text],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_at timestamp with time zone DEFAULT now(),
  invited_by uuid,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  status text DEFAULT ''::text,
  CONSTRAINT pet_member_pkey PRIMARY KEY (pet_id, member_user_id),
  CONSTRAINT pet_member_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT pet_member_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT pet_member_member_role_id_fkey FOREIGN KEY (member_role_id) REFERENCES petcare.user_role_catalog(role_id),
  CONSTRAINT pet_member_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES petcare.app_user(user_id),
  CONSTRAINT pet_member_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES petcare.app_user(user_id)
);

CREATE TABLE petcare.pet_ownership_history (
  history_id uuid NOT NULL DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  previous_owner_id uuid,
  new_owner_id uuid,
  transfer_date timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  document_id uuid,
  previous_status_id text NOT NULL,
  new_status_id text NOT NULL,
  confirmed_by_previous boolean DEFAULT false,
  confirmation_token text,
  token_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pet_ownership_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT pet_ownership_history_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT pet_ownership_history_previous_owner_id_fkey FOREIGN KEY (previous_owner_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT pet_ownership_history_new_owner_id_fkey FOREIGN KEY (new_owner_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT pet_ownership_history_previous_status_id_fkey FOREIGN KEY (previous_status_id) REFERENCES petcare.pet_status_catalog(status_id),
  CONSTRAINT pet_ownership_history_new_status_id_fkey FOREIGN KEY (new_status_id) REFERENCES petcare.pet_status_catalog(status_id),
  CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES petcare.document(doc_id)
);

CREATE TABLE petcare.routine (
  routine_id uuid NOT NULL DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  routine_type_id text NOT NULL,
  rrule text,
  time_local time without time zone,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  title text,
  description text,
  status_id text,
  CONSTRAINT routine_pkey PRIMARY KEY (routine_id),
  CONSTRAINT routine_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT routine_routine_type_id_fkey FOREIGN KEY (routine_type_id) REFERENCES petcare.routine_type_catalog(routine_type_id),
  CONSTRAINT routine_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT routine_status_id_fkey FOREIGN KEY (status_id) REFERENCES petcare.alert_status_catalog(status_id)
);

CREATE TABLE petcare.alert (
  alert_id uuid NOT NULL DEFAULT gen_random_uuid(),
  routine_id uuid,
  pet_id uuid NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  completed_at timestamp with time zone,
  completed_by uuid,
  status_id text NOT NULL DEFAULT 'scheduled'::text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  title text,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels ARRAY NOT NULL DEFAULT '{email}'::text[] CHECK (channels <@ ARRAY['email'::text, 'sms'::text, 'push'::text]),
  priority smallint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT alert_pkey PRIMARY KEY (alert_id),
  CONSTRAINT alert_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT alert_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES petcare.app_user(user_id),
  CONSTRAINT alert_status_id_fkey FOREIGN KEY (status_id) REFERENCES petcare.alert_status_catalog(status_id),
  CONSTRAINT fk_alert_user FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id),
  CONSTRAINT alert_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES petcare.routine(routine_id)
);

CREATE TABLE petcare.activity_log (
  log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  routine_id uuid,
  pet_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  status_id text NOT NULL,
  notes text,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT activity_log_pkey PRIMARY KEY (log_id),
  CONSTRAINT activity_log_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES petcare.routine(routine_id),
  CONSTRAINT activity_log_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES petcare.pet(pet_id),
  CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT activity_log_status_id_fkey FOREIGN KEY (status_id) REFERENCES petcare.alert_status_catalog(status_id)
);

CREATE TABLE petcare.user_device (
  device_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text CHECK (platform = ANY (ARRAY['web'::text, 'android'::text, 'ios'::text])),
  fcm_token text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_device_pkey PRIMARY KEY (device_id),
  CONSTRAINT user_device_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id)
);

CREATE TABLE petcare.user_pii (
  user_id uuid NOT NULL,
  address_line text,
  phone text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_pii_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_pii_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id)
);

CREATE TABLE petcare.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  action text NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text])),
  details jsonb,
  client_ip inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES petcare.app_user(user_id)
);
