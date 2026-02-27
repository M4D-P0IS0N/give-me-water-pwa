import { QUICK_ADD_ACTIONS, SW_MESSAGE_TYPES } from "./constants.js";

let reminderIntervalId = null;
let lastReminderBucket = null;

function parseTimeToMinutes(timeValue) {
    const [hourText, minuteText] = (timeValue || "00:00").split(":");
    const hourValue = Number(hourText || 0);
    const minuteValue = Number(minuteText || 0);
    return hourValue * 60 + minuteValue;
}

function toUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function supportsNotificationActions() {
    return typeof Notification !== "undefined" && Number(Notification.maxActions || 0) > 0;
}

function canSendRemindersNow(settings, currentDate) {
    const startMinutes = parseTimeToMinutes(settings.reminderStartTime);
    const endMinutes = parseTimeToMinutes(settings.reminderEndTime);
    const nowMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    if (startMinutes <= endMinutes) {
        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }

    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

async function showReminderNotification(swRegistration) {
    if (!swRegistration) {
        return;
    }

    const actions = supportsNotificationActions() ? QUICK_ADD_ACTIONS : [];
    await swRegistration.showNotification("Hora de se hidratar", {
        body: actions.length > 0
            ? "Pressione e segure para escolher uma quantidade rapida de agua."
            : "Toque para abrir o app e adicionar agua rapido.",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: "hydrate-reminder",
        renotify: true,
        actions,
        data: {
            fallbackUrl: "./index.html?quickAdd=250&source=push_fallback"
        }
    });
}

export async function sendReminderNow(swRegistration) {
    await showReminderNotification(swRegistration);
}

export async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return null;
    }

    try {
        const serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js");
        await navigator.serviceWorker.ready;
        return serviceWorkerRegistration;
    } catch (error) {
        console.error("Falha ao registrar Service Worker.", error);
        return null;
    }
}

export async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        return "unsupported";
    }

    if (Notification.permission === "granted") {
        return Notification.permission;
    }

    if (Notification.permission === "denied") {
        return Notification.permission;
    }

    try {
        return await Notification.requestPermission();
    } catch (error) {
        console.error("Erro ao solicitar permissao de notificacao.", error);
        return "default";
    }
}

export async function enablePushSubscription(swRegistration, vapidPublicKey) {
    if (!swRegistration || !("PushManager" in window) || !vapidPublicKey) {
        return null;
    }

    try {
        const existingSubscription = await swRegistration.pushManager.getSubscription();
        if (existingSubscription) {
            return existingSubscription;
        }

        return await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toUint8Array(vapidPublicKey)
        });
    } catch (error) {
        console.error("Falha ao registrar push subscription.", error);
        return null;
    }
}

export function startReminderLoop(getState, swRegistration) {
    if (reminderIntervalId) {
        window.clearInterval(reminderIntervalId);
    }

    const tick = async () => {
        if (typeof Notification === "undefined") {
            return;
        }

        const state = getState();
        const settings = state.settings;

        if (!settings.notificationsEnabled || Notification.permission !== "granted") {
            return;
        }

        if (state.goal > 0 && state.current >= state.goal) {
            return;
        }

        const now = new Date();
        if (!canSendRemindersNow(settings, now)) {
            return;
        }

        const intervalMinutes = Math.max(30, Number(settings.intervalMinutes || 120));
        const bucket = Math.floor(now.getTime() / (intervalMinutes * 60 * 1000));
        if (bucket === lastReminderBucket) {
            return;
        }

        lastReminderBucket = bucket;
        try {
            await showReminderNotification(swRegistration);
        } catch (error) {
            console.error("Falha ao exibir lembrete local.", error);
        }
    };

    tick();
    reminderIntervalId = window.setInterval(tick, 60 * 1000);
}

export function stopReminderLoop() {
    if (reminderIntervalId) {
        window.clearInterval(reminderIntervalId);
        reminderIntervalId = null;
    }
}

export function listenServiceWorkerMessages(onQuickAdd, onOpenQuickAdd) {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    navigator.serviceWorker.addEventListener("message", (messageEvent) => {
        const messageData = messageEvent.data;
        if (!messageData || typeof messageData !== "object") {
            return;
        }

        if (messageData.type === SW_MESSAGE_TYPES.QUICK_ADD) {
            onQuickAdd(Number(messageData.rawAmountMl || 0), "push_action");
        }

        if (messageData.type === SW_MESSAGE_TYPES.OPEN_QUICK_ADD) {
            onOpenQuickAdd();
        }
    });
}
