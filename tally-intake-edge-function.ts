import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();

    // Tally sends fields as an array - map them by label
    const fields: Record<string, any> = {};
    if (body.data && body.data.fields) {
      for (const field of body.data.fields) {
        // Use the field label as key, lowercased and underscored
        const key = (field.label || field.key || "").toLowerCase().replace(/\s+/g, "_");
        fields[key] = Array.isArray(field.value)
          ? field.value.join(", ")
          : field.value;
      }
    }

    // Extract the user email from hidden field or respondent
    // Tally passes hidden fields if you set them up in the form URL
    const userEmail = fields["email"] || body.data?.respondentId || null;

    // Initialize Supabase with service role key (can bypass RLS)
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user by email to get their UUID
    let userId = null;
    if (userEmail) {
      const { data: users } = await sb.auth.admin.listUsers();
      const match = users?.users?.find((u: any) => u.email === userEmail);
      if (match) userId = match.id;
    }

    // Build project row from Tally fields
    // Adjust field key names to match your actual Tally question labels
    const project = {
      user_id: userId,
      name: fields["project_name"] || fields["name"] || "New Project",
      location: fields["location"] || fields["project_location"] || null,
      capacity_mw: parseFloat(fields["capacity"] || fields["capacity_mwp"] || "0") || null,
      stage: fields["stage"] || fields["project_stage"] || null,
      status: "in-progress",
      tally_response_id: body.data?.responseId || null,
      tally_fields: fields, // store full response as JSON
    };

    const { data, error } = await sb.from("projects").insert(project).select().single();

    if (error) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, project_id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
