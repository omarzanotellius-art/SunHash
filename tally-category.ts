import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const body = await req.json();
    console.log("Category webhook payload:", JSON.stringify(body));

    const fields = body?.data?.fields || [];

    // -- Resolve field values --
    function resolveValue(field: any): string | null {
      if (field.value === null || field.value === undefined) return null;
      if (Array.isArray(field.value) && field.options) {
        return field.value.map((id: string) => {
          const opt = field.options.find((o: any) => o.id === id);
          return opt ? opt.text : id;
        }).join(", ");
      }
      if (Array.isArray(field.value)) return field.value.join(", ");
      return String(field.value);
    }

    const byLabel: Record<string, string | null> = {};
    const hidden: Record<string, string | null> = {};

    for (const field of fields) {
      const val = resolveValue(field);
      const norm = (field.label || "").toLowerCase().replace(/\s+/g, "_");
      byLabel[field.label] = val;
      byLabel[norm] = val;
      if (field.type === "HIDDEN_FIELDS") {
        hidden[field.label] = val;
        hidden[norm] = val;
      }
      console.log(`Field: "${field.label}" (${field.type}) = ${JSON.stringify(val)}`);
    }

    console.log("Hidden fields:", JSON.stringify(hidden));

    // -- Identify user & project --
    const userId    = hidden["user_id"]    || byLabel["user_id"]    || null;
    const userEmail = hidden["email"]      || byLabel["email"]      || null;
    const projectId = hidden["project_id"] || byLabel["project_id"] || null;

    if (!projectId) {
      console.error("No project_id in submission");
      return new Response(JSON.stringify({ error: "Missing project_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let resolvedUserId = userId;
    if (!resolvedUserId && userEmail) {
      const { data: userData } = await sb.auth.admin.listUsers({ perPage: 1000 });
      const match = userData?.users?.find((u: any) => u.email === userEmail);
      if (match) resolvedUserId = match.id;
    }

    if (!resolvedUserId) {
      console.error("Cannot resolve user");
      return new Response(JSON.stringify({ error: "Cannot identify user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // -- Detect which category form was submitted --
    // Tally passes the form ID in the payload
    const formId = body?.data?.formId || body?.formId || null;
    console.log("Form ID:", formId);

    const FORM_MAP: Record<string, string> = {
      "1ArXEg": "design",
      "0QEdP9": "construct",
      "D4VBel": "contract",
      "Gxr6Le": "intercon",
      "rjl5Vo": "financial",
      "xXdr2d": "permit",
    };

    const category = formId ? FORM_MAP[formId] : null;

    if (!category) {
      console.error("Unknown form ID:", formId);
      return new Response(JSON.stringify({ error: "Unknown form ID: " + formId }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Category detected:", category);

    // -- Score calculation --
    // Count answered non-hidden questions, score based on completeness + answer quality
    const answered = fields.filter((f: any) =>
      f.type !== "HIDDEN_FIELDS" &&
      f.value !== null &&
      f.value !== undefined &&
      f.value !== "" &&
      !(Array.isArray(f.value) && f.value.length === 0)
    );
    const total = fields.filter((f: any) => f.type !== "HIDDEN_FIELDS").length;

    console.log(`Answered: ${answered.length} / ${total}`);

    // Base score: completeness (0-70)
    const completeness = total > 0 ? (answered.length / total) : 0;
    let score = Math.round(completeness * 70);

    // Quality bonus (0-30): check for high-value answers
    // Penalise answers that indicate problems ("No", "Not started", "None", "Unknown")
    const lowQualityPatterns = /^(no|none|not started|unknown|n\/a|tbd|pending|not applicable)$/i;
    const highQualityCount = answered.filter((f: any) => {
      const val = String(f.value || "").trim();
      return val.length > 2 && !lowQualityPatterns.test(val);
    }).length;

    const qualityBonus = answered.length > 0
      ? Math.round((highQualityCount / answered.length) * 30)
      : 0;

    score = Math.min(100, score + qualityBonus);
    console.log(`Score: ${score} (completeness ${Math.round(completeness*70)} + quality ${qualityBonus})`);

    // -- Build update payload --
    const scoreField = `score_${category}`;
    const updateData: Record<string, any> = {
      [scoreField]: score,
      updated_at: new Date().toISOString(),
      tally_fields: byLabel, // merge latest fields
    };

    // Recalculate overall score from all category scores
    const { data: existing } = await sb
      .from("projects")
      .select("score_design, score_construct, score_contract, score_intercon, score_financial, score_permit")
      .eq("id", projectId)
      .single();

    if (existing) {
      const allScores: Record<string, number> = {
        score_design:    existing.score_design    ?? -1,
        score_construct: existing.score_construct ?? -1,
        score_contract:  existing.score_contract  ?? -1,
        score_intercon:  existing.score_intercon  ?? -1,
        score_financial: existing.score_financial ?? -1,
        score_permit:    existing.score_permit    ?? -1,
      };
      // Apply the new score
      allScores[scoreField] = score;

      // Overall = average of all scored categories (ignore -1 = not yet scored)
      const scored = Object.values(allScores).filter((s) => s >= 0);
      if (scored.length > 0) {
        updateData.score_overall = Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
        console.log("Overall score:", updateData.score_overall, "from", scored.length, "categories");
      }
    }

    const { error } = await sb
      .from("projects")
      .update(updateData)
      .eq("id", projectId)
      .eq("user_id", resolvedUserId);

    if (error) {
      console.error("DB update error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Updated project ${projectId}: ${scoreField} = ${score}`);
    return new Response(JSON.stringify({ ok: true, category, score, project_id: projectId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
