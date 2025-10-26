// supabase/functions/generate-alerts/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RRule } from "https://esm.sh/rrule@2.8.1"; // Librería para procesar RRULE

// Cliente Supabase (Service Role)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "petcare" } }, // Asegúrate que el schema sea correcto
);

console.log("Function generate-alerts initializing...");

Deno.serve(async (req) => {
  // Opcional: Validación del Cron Job (igual que en send-alerts)
  const secret = Deno.env.get("CRON_SECRET");
  const hasHeader = req.headers.has("x-cron-key");
  if (hasHeader && secret && req.headers.get("x-cron-key") !== secret) {
    console.warn("generate-alerts: forbidden - wrong x-cron-key");
    return new Response("forbidden", { status: 403 });
  }

  console.log("generate-alerts: Running job at", new Date().toISOString());

  try {
    // --- CAMBIO 1: Definir el rango de fechas para "HOY" (UTC) ---
    const nowUTC = new Date();
    const todayStartUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(), 0, 0, 0, 0));
    const todayEndUTC = new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(), 23, 59, 59, 999));

    console.log(`Generating alerts for range (UTC): ${todayStartUTC.toISOString()} to ${todayEndUTC.toISOString()}`);
    // --- FIN CAMBIO 1 ---

    // --- 2. Obtener todas las rutinas ACTIVAS que tienen RRULE ---
    const { data: routines, error: routineError } = await supabase
      .from("routine")
      .select("routine_id, pet_id, user_id, title, rrule, time_local")
      .eq("active", true)
      .not("rrule", "is", null); // Solo las que tienen regla de recurrencia

    if (routineError) throw routineError;
    if (!routines || routines.length === 0) {
      console.log("No active routines with rrules found.");
      return new Response("No active routines with rrules.", { status: 200 });
    }

    console.log(`Found ${routines.length} active routines with rrules.`);
    let createdCount = 0;

    // --- 3. Procesar cada rutina ---
    for (const routine of routines) {
      console.log(`Processing routine ${routine.routine_id}: ${routine.title}`);

      if (!routine.rrule || !routine.time_local) {
          console.warn(`Skipping routine ${routine.routine_id}: missing rrule or time_local.`);
          continue;
      }

      try {
        // --- 4. Interpretar la RRULE ---
        const rule = RRule.fromString(routine.rrule);

        // --- CAMBIO 2: Obtener ocurrencias para "HOY" (UTC) ---
        const occurrencesUTC = rule.between(todayStartUTC, todayEndUTC, true); // true = inc

        if (occurrencesUTC.length > 0) {
          // --- CAMBIO 3: Actualizar mensaje de log ---
          console.log(`Routine ${routine.routine_id} has ${occurrencesUTC.length} occurrences today (UTC).`);

          for (const occurrenceDateUTC of occurrencesUTC) {
            // --- 6. Calcular la hora exacta (scheduled_at) ---
            const [hours, minutes] = routine.time_local.split(":").map(Number);

            // Creamos la fecha base de la ocurrencia (solo año, mes, día) en UTC
            const scheduledDate = new Date(Date.UTC(
                occurrenceDateUTC.getUTCFullYear(),
                occurrenceDateUTC.getUTCMonth(),
                occurrenceDateUTC.getUTCDate(),
                hours,
                minutes,
                0, 0
            ));

            const scheduledTimestamp = scheduledDate.toISOString();
            console.log(`  - Calculated scheduled_at (UTC): ${scheduledTimestamp}`);

            // --- 7. Verificar si ya existe una alerta para evitar duplicados ---
            const { count, error: checkError } = await supabase
              .from("alert")
              .select("alert_id", { count: "exact", head: true })
              .eq("routine_id", routine.routine_id)
              .eq("scheduled_at", scheduledTimestamp);

            if (checkError) {
              console.error(`Error checking for existing alert (routine ${routine.routine_id}):`, checkError);
              continue; // Salta esta ocurrencia, sigue con la siguiente
            }

            if (count === 0) {
              // --- 8. Crear la nueva alerta ---
              console.log(`  - Creating new alert for routine ${routine.routine_id} at ${scheduledTimestamp}`);
              const { error: insertError } = await supabase
                .from("alert")
                .insert({
                  routine_id: routine.routine_id,
                  pet_id: routine.pet_id,
                  user_id: routine.user_id,
                  title: routine.title,
                  scheduled_at: scheduledTimestamp,
                  status_id: "scheduled",
                  channels: ["email"], // O basado en preferencias del usuario/rutina
                  // body: '', // Podrías añadir un body por defecto o de la rutina
                });

              if (insertError) {
                console.error(`Error inserting alert for routine ${routine.routine_id}:`, insertError);
              } else {
                createdCount++;
                console.log(`  - Alert created successfully.`);
              }
            } else {
              console.log(`  - Alert already exists for routine ${routine.routine_id} at ${scheduledTimestamp}. Skipping.`);
            }
          } // fin loop ocurrencias
        } else {
            // --- CAMBIO 4: Actualizar mensaje de log ---
            console.log(`Routine ${routine.routine_id} has no occurrences today (UTC).`);
        }
      } catch (e) {
        console.error(`Error processing RRULE "${routine.rrule}" for routine ${routine.routine_id}:`, e);
        // Continúa con la siguiente rutina
      }
    } // fin loop rutinas

    console.log(`generate-alerts: Finished. Created ${createdCount} new alerts.`);
    return new Response(`OK. Created ${createdCount} alerts.`, { status: 200 });

  } catch (err) {
    console.error("generate-alerts: Unhandled error:", err);
    return new Response(err.message || "Internal Server Error", { status: 500 });
  }
});