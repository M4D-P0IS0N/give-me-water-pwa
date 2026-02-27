import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import webpush from "https://code4fukui.github.io/web-push/src/index.js";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const DEFAULT_SETTINGS = {
    notificationsEnabled: false,
    reminderStartTime: "08:00",
    reminderEndTime: "22:00",
    intervalMinutes: 120,
    endOfDayTime: "00:00"
};

const REMINDER_PAYLOAD = {
    title: "\u26a0\ufe0fBeep boop!\ud83e\udd16 Hora de hidrata\u00e7\u00e3o.",
    body: "Eu tomo \u00f3leo\ud83d\udee2\ufe0f, voc\u00ea toma \u00e1gua!\ud83d\udca7",
    tag: "hydrate-reminder",
    fallbackUrl: "./index.html?openQuickAdd=1&source=push_server",
    actions: [
        { action: "add_250", title: "+250ml" },
        { action: "add_500", title: "+500ml" },
        { action: "add_750", title: "+750ml" }
    ]
};

type ReminderSettings = {
    notificationsEnabled: boolean;
    reminderStartTime: string;
    reminderEndTime: string;
    intervalMinutes: number;
    endOfDayTime: string;
};

type ProfileRow = {
    user_id: string;
    timezone: string | null;
    settings_json: {
        goal?: number;
        settings?: Partial<ReminderSettings>;
    } | null;
};

type PushSubscriptionRow = {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
};

type RequestPayload = {
    dryRun?: boolean;
    userId?: string;
};

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function parseTimeToMinutes(timeValue: string): number {
    const [hourText, minuteText] = (timeValue || "00:00").split(":");
    const hourValue = Number(hourText || 0);
    const minuteValue = Number(minuteText || 0);
    return hourValue * 60 + minuteValue;
}

function clampIntervalMinutes(rawInterval: number): number {
    if (!Number.isFinite(rawInterval) || rawInterval <= 0) {
        return DEFAULT_SETTINGS.intervalMinutes;
    }
    return Math.min(720, Math.max(30, Math.round(rawInterval)));
}

function normalizeReminderSettings(profile: ProfileRow): {
    timezone: string;
    goalMl: number;
    settings: ReminderSettings;
} {
    const timezone = profile.timezone || "UTC";
    const goalMl = Number(profile.settings_json?.goal || 0);
    const incomingSettings = profile.settings_json?.settings || {};
    const settings = {
        notificationsEnabled: Boolean(
            incomingSettings.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled
        ),
        reminderStartTime: incomingSettings.reminderStartTime || DEFAULT_SETTINGS.reminderStartTime,
        reminderEndTime: incomingSettings.reminderEndTime || DEFAULT_SETTINGS.reminderEndTime,
        intervalMinutes: clampIntervalMinutes(
            Number(incomingSettings.intervalMinutes ?? DEFAULT_SETTINGS.intervalMinutes)
        ),
        endOfDayTime: incomingSettings.endOfDayTime || DEFAULT_SETTINGS.endOfDayTime
    };

    return {
        timezone,
        goalMl,
        settings
    };
}

function getZonedDateParts(timezone: string, baseDate = new Date()): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
} {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    });

    const partMap = formatter
        .formatToParts(baseDate)
        .filter((part) => part.type !== "literal")
        .reduce<Record<string, string>>((accumulator, part) => {
            accumulator[part.type] = part.value;
            return accumulator;
        }, {});

    return {
        year: Number(partMap.year),
        month: Number(partMap.month),
        day: Number(partMap.day),
        hour: Number(partMap.hour),
        minute: Number(partMap.minute)
    };
}

function canSendNow(settings: ReminderSettings, nowMinutes: number): boolean {
    const startMinutes = parseTimeToMinutes(settings.reminderStartTime);
    const endMinutes = parseTimeToMinutes(settings.reminderEndTime);
    if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function getEffectiveDayKeyFromParts(
    dateParts: { year: number; month: number; day: number; hour: number; minute: number },
    endOfDayTime: string
): string {
    const [endHour, endMinute] = (endOfDayTime || "00:00").split(":").map(Number);
    const shiftedDate = new Date(
        Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, dateParts.hour, dateParts.minute)
    );
    const beforeCutoff =
        dateParts.hour < (endHour || 0) ||
        (dateParts.hour === (endHour || 0) && dateParts.minute < (endMinute || 0));
    if (beforeCutoff) {
        shiftedDate.setUTCDate(shiftedDate.getUTCDate() - 1);
    }

    return `${shiftedDate.getUTCFullYear()}-${pad2(shiftedDate.getUTCMonth() + 1)}-${pad2(
        shiftedDate.getUTCDate()
    )}`;
}

async function loadAllSubscriptions(
    supabaseAdmin: ReturnType<typeof createClient>
): Promise<PushSubscriptionRow[]> {
    const pageSize = 1000;
    let pageOffset = 0;
    const rows: PushSubscriptionRow[] = [];

    while (true) {
        const { data, error } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id,user_id,endpoint,p256dh,auth")
            .range(pageOffset, pageOffset + pageSize - 1);

        if (error) {
            throw new Error(`Erro ao carregar push_subscriptions: ${error.message}`);
        }

        const batch = (data || []) as PushSubscriptionRow[];
        rows.push(...batch);
        if (batch.length < pageSize) {
            break;
        }
        pageOffset += pageSize;
    }

    return rows;
}

async function loadProfilesMap(
    supabaseAdmin: ReturnType<typeof createClient>,
    userIds: string[]
): Promise<Map<string, ProfileRow>> {
    const profileMap = new Map<string, ProfileRow>();
    const chunkSize = 500;

    for (let startIndex = 0; startIndex < userIds.length; startIndex += chunkSize) {
        const idChunk = userIds.slice(startIndex, startIndex + chunkSize);
        if (idChunk.length === 0) {
            continue;
        }

        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("user_id,timezone,settings_json")
            .in("user_id", idChunk);

        if (error) {
            throw new Error(`Erro ao carregar profiles: ${error.message}`);
        }

        for (const profileRow of (data || []) as ProfileRow[]) {
            profileMap.set(profileRow.user_id, profileRow);
        }
    }

    return profileMap;
}

async function getDayIntakeMl(
    supabaseAdmin: ReturnType<typeof createClient>,
    userId: string,
    dayKey: string
): Promise<number> {
    const pageSize = 1000;
    let pageOffset = 0;
    let totalIntake = 0;

    while (true) {
        const { data, error } = await supabaseAdmin
            .from("hydration_events")
            .select("hydration_amount_ml")
            .eq("user_id", userId)
            .eq("effective_day_key", dayKey)
            .range(pageOffset, pageOffset + pageSize - 1);

        if (error) {
            throw new Error(`Erro ao carregar hydration_events: ${error.message}`);
        }

        const batch = data || [];
        for (const row of batch) {
            totalIntake += Number(row.hydration_amount_ml || 0);
        }

        if (batch.length < pageSize) {
            break;
        }
        pageOffset += pageSize;
    }

    return totalIntake;
}

async function acquireDispatchBucket(
    supabaseAdmin: ReturnType<typeof createClient>,
    userId: string,
    intervalMinutes: number
): Promise<boolean> {
    const bucketValue = Math.floor(Date.now() / (intervalMinutes * 60 * 1000));
    const bucketKey = String(bucketValue);
    const { error } = await supabaseAdmin
        .from("push_reminder_dispatches")
        .insert({ user_id: userId, bucket_key: bucketKey });

    if (!error) {
        return true;
    }

    if (String(error.code) === "23505") {
        return false;
    }

    throw new Error(`Erro ao registrar bucket de reminder: ${error.message}`);
}

function isGoneSubscriptionError(error: unknown): boolean {
    const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
    if (statusCode === 404 || statusCode === 410) {
        return true;
    }

    const errorText = String((error as { body?: string })?.body || error || "").toLowerCase();
    return errorText.includes("410") || errorText.includes("404");
}

function readBearerToken(authHeader: string | null): string {
    if (!authHeader) {
        return "";
    }
    const [scheme, token] = authHeader.split(" ");
    if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
        return "";
    }
    return token.trim();
}

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("GMW_SUPABASE_URL");
        const serviceRoleKey =
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
            Deno.env.get("GMW_SUPABASE_SERVICE_ROLE_KEY");
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
        const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
        const cronSecret = Deno.env.get("CRON_SECRET") || "";

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
                JSON.stringify({
                    error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (or GMW_* fallback)."
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        if (!vapidPublicKey || !vapidPrivateKey) {
            return new Response(
                JSON.stringify({ error: "Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY." }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        if (cronSecret) {
            const bearerToken = readBearerToken(request.headers.get("authorization"));
            if (!bearerToken || bearerToken !== cronSecret) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        const body = (await request.json().catch(() => ({}))) as RequestPayload;
        const dryRun = Boolean(body.dryRun);
        const targetUserId = body.userId ? String(body.userId) : null;

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

        const allSubscriptions = await loadAllSubscriptions(supabaseAdmin);
        const filteredSubscriptions = targetUserId
            ? allSubscriptions.filter((item) => item.user_id === targetUserId)
            : allSubscriptions;
        if (filteredSubscriptions.length === 0) {
            return new Response(
                JSON.stringify({
                    ok: true,
                    dryRun,
                    subscriptionsScanned: 0,
                    notificationsSent: 0,
                    skipped: { no_subscription: targetUserId ? 1 : 0 }
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
        for (const subscription of filteredSubscriptions) {
            const list = subscriptionsByUser.get(subscription.user_id) || [];
            list.push(subscription);
            subscriptionsByUser.set(subscription.user_id, list);
        }

        const userIds = [...subscriptionsByUser.keys()];
        const profilesMap = await loadProfilesMap(supabaseAdmin, userIds);

        const result = {
            ok: true,
            dryRun,
            subscriptionsScanned: filteredSubscriptions.length,
            usersScanned: userIds.length,
            usersEligible: 0,
            notificationsSent: 0,
            subscriptionsRemoved: 0,
            skipped: {
                no_profile: 0,
                notifications_disabled: 0,
                outside_window: 0,
                goal_not_defined: 0,
                goal_already_met: 0,
                already_sent_this_bucket: 0
            }
        };

        for (const userId of userIds) {
            const profileRow = profilesMap.get(userId);
            if (!profileRow) {
                result.skipped.no_profile += 1;
                continue;
            }

            const { timezone, goalMl, settings } = normalizeReminderSettings(profileRow);
            if (!settings.notificationsEnabled) {
                result.skipped.notifications_disabled += 1;
                continue;
            }

            if (goalMl <= 0) {
                result.skipped.goal_not_defined += 1;
                continue;
            }

            let dateParts;
            try {
                dateParts = getZonedDateParts(timezone);
            } catch {
                dateParts = getZonedDateParts("UTC");
            }

            const nowMinutes = dateParts.hour * 60 + dateParts.minute;
            if (!canSendNow(settings, nowMinutes)) {
                result.skipped.outside_window += 1;
                continue;
            }

            const effectiveDayKey = getEffectiveDayKeyFromParts(dateParts, settings.endOfDayTime);
            const intakeMl = await getDayIntakeMl(supabaseAdmin, userId, effectiveDayKey);
            if (intakeMl >= goalMl) {
                result.skipped.goal_already_met += 1;
                continue;
            }

            if (!dryRun) {
                const canDispatch = await acquireDispatchBucket(
                    supabaseAdmin,
                    userId,
                    settings.intervalMinutes
                );
                if (!canDispatch) {
                    result.skipped.already_sent_this_bucket += 1;
                    continue;
                }
            }

            result.usersEligible += 1;
            const userSubscriptions = subscriptionsByUser.get(userId) || [];
            for (const subscriptionRow of userSubscriptions) {
                if (dryRun) {
                    result.notificationsSent += 1;
                    continue;
                }

                try {
                    const pushSubscription = {
                        endpoint: subscriptionRow.endpoint,
                        keys: {
                            p256dh: subscriptionRow.p256dh,
                            auth: subscriptionRow.auth
                        }
                    };

                    await webpush.sendNotification(
                        pushSubscription,
                        JSON.stringify(REMINDER_PAYLOAD)
                    );
                    result.notificationsSent += 1;
                } catch (error) {
                    console.error("Erro ao enviar push.", error);
                    if (isGoneSubscriptionError(error)) {
                        const { error: deleteError } = await supabaseAdmin
                            .from("push_subscriptions")
                            .delete()
                            .eq("id", subscriptionRow.id);
                        if (!deleteError) {
                            result.subscriptionsRemoved += 1;
                        }
                    }
                }
            }
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("send-reminders fatal error", error);
        return new Response(JSON.stringify({ error: String(error) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
