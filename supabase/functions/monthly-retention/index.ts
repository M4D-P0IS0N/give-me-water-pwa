import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type RetentionPayload = {
    userId: string;
    monthKey: string;
};

function buildPreviousMonth(monthKey: string): string {
    const [yearText, monthText] = monthKey.split("-");
    const currentDate = new Date(Number(yearText), Number(monthText) - 1, 1);
    currentDate.setMonth(currentDate.getMonth() - 1);
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl =
            Deno.env.get("SUPABASE_URL") ||
            Deno.env.get("GMW_SUPABASE_URL");
        const serviceRoleKey =
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
            Deno.env.get("GMW_SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
                JSON.stringify({
                    error: "Missing Supabase URL or Service Role key. Expected SUPABASE_* or GMW_* env vars."
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const payload = (await request.json()) as RetentionPayload;
        if (!payload?.userId || !payload?.monthKey) {
            return new Response(
                JSON.stringify({ error: "userId and monthKey are required." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const targetMonth = buildPreviousMonth(payload.monthKey);
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        const { data: events, error: eventError } = await supabaseAdmin
            .from("hydration_events")
            .select("effective_day_key, hydration_amount_ml")
            .eq("user_id", payload.userId)
            .like("effective_day_key", `${targetMonth}%`);

        if (eventError) {
            return new Response(JSON.stringify({ error: eventError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const totalsByDay = new Map<string, number>();
        for (const row of events || []) {
            const previous = totalsByDay.get(row.effective_day_key) || 0;
            totalsByDay.set(row.effective_day_key, previous + Number(row.hydration_amount_ml || 0));
        }

        const dayValues = [...totalsByDay.values()];
        const daysTracked = dayValues.length;
        const averageIntakeMl = daysTracked > 0
            ? Math.round(dayValues.reduce((sum, value) => sum + value, 0) / daysTracked)
            : 0;

        const summaryPayload = {
            user_id: payload.userId,
            month_key: targetMonth,
            average_intake_ml: averageIntakeMl,
            days_tracked: daysTracked,
            days_met_goal: 0,
            completion_rate: 0
        };

        const { error: upsertError } = await supabaseAdmin
            .from("monthly_summaries")
            .upsert(summaryPayload, { onConflict: "user_id,month_key" });

        if (upsertError) {
            return new Response(JSON.stringify({ error: upsertError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { error: deleteError } = await supabaseAdmin
            .from("hydration_events")
            .delete()
            .eq("user_id", payload.userId)
            .like("effective_day_key", `${targetMonth}%`);

        if (deleteError) {
            return new Response(JSON.stringify({ error: deleteError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        return new Response(
            JSON.stringify({
                ok: true,
                monthSummarized: targetMonth,
                eventCount: events?.length || 0
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
