import { createAuthController } from "./auth.js";
import { enablePushSubscription } from "./push.js";
import { arrayBufferToBase64 } from "./appHelpers.js";

export async function syncPushSubscription({
    getSupabaseClient,
    runtimeConfig,
    serviceWorkerRegistration,
    appState
}) {
    const supabaseClient = await getSupabaseClient();
    if (!supabaseClient || !serviceWorkerRegistration || !runtimeConfig?.vapidPublicKey) {
        return;
    }

    if (typeof Notification === "undefined") {
        return;
    }

    if (!appState.sync.userId || Notification.permission !== "granted") {
        return;
    }

    const subscription = await enablePushSubscription(serviceWorkerRegistration, runtimeConfig.vapidPublicKey);
    if (!subscription) {
        return;
    }

    const subscriptionJson = subscription.toJSON();
    const keyData = subscription.getKey("p256dh");
    const authData = subscription.getKey("auth");
    if (!keyData || !authData) {
        return;
    }

    const payload = {
        user_id: appState.sync.userId,
        endpoint: subscriptionJson.endpoint,
        p256dh: arrayBufferToBase64(keyData),
        auth: arrayBufferToBase64(authData),
        user_agent: navigator.userAgent
    };

    const { error } = await supabaseClient
        .from("push_subscriptions")
        .upsert(payload, { onConflict: "endpoint" });

    if (error) {
        console.error("Falha ao salvar push subscription na nuvem.", error);
    }
}

export async function setupAuthentication({
    getSupabaseClient,
    getSupabaseRuntimeConfig,
    syncEngine,
    onUserChanged,
    onSyncPushNeeded
}) {
    const runtimeConfig = await getSupabaseRuntimeConfig();
    const supabaseClient = await getSupabaseClient();
    await syncEngine.setSupabaseClient(supabaseClient);

    const authController = createAuthController(supabaseClient, async (user) => {
        await syncEngine.setUserSession(user);
        await onSyncPushNeeded();
        onUserChanged();
    });

    await authController.initialize();

    return {
        authController,
        runtimeConfig
    };
}
