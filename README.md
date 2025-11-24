# PetCare

**PetCare** es una aplicación web diseñada para promover la **tenencia responsable de mascotas**, facilitando la organización, seguimiento y cumplimiento de rutinas esenciales de cuidado.  
La plataforma permite a los usuarios registrar a sus mascotas, programar recordatorios y recibir alertas automáticas mediante correo electrónico, favoreciendo el bienestar animal y la participación activa de los cuidadores.

---

## Descripción General

PetCare surge como una herramienta integral para el manejo de la información y las actividades cotidianas relacionadas con las mascotas.  
Su diseño se centra en la **usabilidad, accesibilidad y automatización de notificaciones**, permitiendo que los propietarios puedan mantener un registro actualizado del estado de sus mascotas y sus compromisos de cuidado (alimentación, paseos, vacunación, entre otros).

El sistema está construido sobre tecnologías modernas, con un enfoque **modular, seguro y escalable**, que facilita futuras expansiones hacia módulos de analítica o integración con servicios veterinarios.

---

## Tecnologías Utilizadas

| Capa | Tecnología | Descripción |
|------|-------------|--------------|
| **Frontend** | React + Vite + TailwindCSS | Interfaz rápida, moderna y adaptable. |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Edge Functions) | Gestión de datos, autenticación y ejecución de funciones en el borde. |
| **Notificaciones** | Resend | Envío de correos electrónicos automatizados. |
| **Control de versión** | Git + GitHub | Control de versiones y colaboración. |

---

## Funcionalidades Principales

- **Gestión de usuarios:** registro, inicio y cierre de sesión con validación integrada.  
- **Gestión de mascotas:** creación, visualización y edición de perfiles individuales.  
- **Rutinas personalizadas:** asignación de actividades específicas (alimentación, paseos, controles, entre otros).  
- **Alertas automáticas:** programación de recordatorios y envío de notificaciones por correo electrónico mediante Resend.  
- **Cumplimiento de rutinas:** seguimiento del estado (pendiente, completada, omitida) con visualización de progreso.  
- **Confirmación de acciones:** validación previa a la eliminación de registros o rutinas para evitar errores.  
- **Diseño responsivo:** interfaz adaptable a distintos dispositivos.

---

## Instalación y Ejecución Local

### 1. Clonar el repositorio

```bash
git clone https://github.com/<usuario>/petcare.git
cd petcare
```
### 2. Instalar dependencias
```bash
npm install
```
### 3. Configurar variables de entorno
Crear un archivo .env en la raíz del proyecto con el siguiente contenido (solicitar credenciales):
```bash
VITE_SUPABASE_URL=<url-de-supabase>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_RESEND_API_KEY=<api-key-de-resend>
```
### 4. Ejecutar en entorno de desarrollo
```bash
npm run dev
```
## Seguridad y Autenticación

PetCare utiliza Supabase Auth para la gestión de usuarios, aplicando políticas de control a nivel de fila (RLS) que aseguran que cada usuario acceda únicamente a su información.
Las Edge Functions permiten manejar eventos del lado del servidor, como el envío de notificaciones, sin exponer credenciales ni claves sensibles.

---

## Módulos en Desarrollo

Panel de reportes: visualización de porcentajes de cumplimiento y tendencias semanales o mensuales.

Módulo de gastos: registro y visualización de los gastos asociados a la mascota.