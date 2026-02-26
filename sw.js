const CACHE_NAME = "givemewater-v24";
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./manifest.json",
    "./Imagens/AppIcon.png",
    "./icon-192.png",
    "./icon-512.png",
    "./src/main.js",
    "./src/constants.js",
    "./src/state.js",
    "./src/ui.js",
    "./src/analytics.js",
    "./src/mascot.js",
    "./src/push.js",
    "./src/sync.js",
    "./src/supabaseClient.js",
    "./src/auth.js",
    "./src/retention.js",
    "./Imagens/Oleo/oleo_0.png",
    "./Imagens/Oleo/oleo_25.png",
    "./Imagens/Oleo/oleo_50.png",
    "./Imagens/Oleo/oleo_75.png",
    "./Imagens/Oleo/oleo_100.png",
    "./Imagens/Robo/robo_0.png",
    "./Imagens/Robo/robo_25.png",
    "./Imagens/Robo/robo_50.png",
    "./Imagens/Robo/robo_75.png",
    "./Imagens/Robo/robo_100.png",
    "./Imagens/Robo/robo_100_semfundo.png",
    "./Imagens/Processed/Oleo/oleo_0.png",
    "./Imagens/Processed/Oleo/oleo_25.png",
    "./Imagens/Processed/Oleo/oleo_50.png",
    "./Imagens/Processed/Oleo/oleo_75.png",
    "./Imagens/Processed/Oleo/oleo_100.png",
    "./Imagens/Processed/Robo/robo_0.png",
    "./Imagens/Processed/Robo/robo_25.png",
    "./Imagens/Processed/Robo/robo_50.png",
    "./Imagens/Processed/Robo/robo_75.png",
    "./Imagens/Processed/Robo/robo_100.png",
    "./Imagens/Processed/Robo/robo_100_semfundo.png",
    "./Imagens/Processed/Robo/robo_100_completo_semfundo.png"
];

const QUICK_ACTION_TO_AMOUNT = {
    add_250: 250,
    add_500: 500,
    add_750: 750
};

const ACTION_DB_NAME = "givemewater_sw_actions";
const ACTION_DB_VERSION = 1;
const ACTION_STORE = "pending_quick_add";

function openActionDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(ACTION_DB_NAME, ACTION_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(ACTION_STORE)) {
                database.createObjectStore(ACTION_STORE, { keyPath: "id", autoIncrement: true });
            }
        };
    });
}

async function enqueuePendingQuickAdd(amountMl) {
    const database = await openActionDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(ACTION_STORE, "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore(ACTION_STORE).add({
            rawAmountMl: amountMl,
            source: "push_action_background",
            createdAt: new Date().toISOString()
        });
    });
    database.close();
}

async function readAndClearPendingQuickAdds() {
    const database = await openActionDatabase();
    const list = await new Promise((resolve, reject) => {
        const transaction = database.transaction(ACTION_STORE, "readonly");
        const request = transaction.objectStore(ACTION_STORE).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });

    await new Promise((resolve, reject) => {
        const transaction = database.transaction(ACTION_STORE, "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore(ACTION_STORE).clear();
    });

    database.close();
    return list;
}

async function broadcastToOpenClients(messagePayload) {
    const clientList = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    clientList.forEach((windowClient) => windowClient.postMessage(messagePayload));
    return clientList;
}

self.addEventListener("install", (installEvent) => {
    installEvent.waitUntil(
        caches.open(CACHE_NAME).then((cacheStore) => cacheStore.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (activateEvent) => {
    activateEvent.waitUntil(
        caches.keys().then((cacheKeys) =>
            Promise.all(
                cacheKeys.map((cacheKey) => {
                    if (cacheKey !== CACHE_NAME) {
                        return caches.delete(cacheKey);
                    }
                    return null;
                })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (fetchEvent) => {
    if (fetchEvent.request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(fetchEvent.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    fetchEvent.respondWith(
        caches.match(fetchEvent.request).then((cachedResponse) => {
            const networkPromise = fetch(fetchEvent.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cacheStore) => cacheStore.put(fetchEvent.request, clone));
                    }
                    return networkResponse;
                })
                .catch(() => cachedResponse);

            return cachedResponse || networkPromise;
        })
    );
});

self.addEventListener("message", (messageEvent) => {
    const messageData = messageEvent.data || {};
    if (messageData.type === "GET_PENDING_QUICK_ADDS") {
        if (messageEvent.ports && messageEvent.ports[0]) {
            messageEvent.waitUntil(
                readAndClearPendingQuickAdds()
                    .then((pendingActions) => {
                        messageEvent.ports[0].postMessage({
                            type: "PENDING_QUICK_ADDS",
                            actions: pendingActions
                        });
                    })
                    .catch((error) => {
                        messageEvent.ports[0].postMessage({
                            type: "PENDING_QUICK_ADDS",
                            actions: [],
                            error: String(error)
                        });
                    })
            );
        }
        return;
    }

    if (messageData.type !== "SHOW_REMINDER") {
        return;
    }

    const actions = Number(Notification.maxActions || 0) > 0
        ? [
            { action: "add_250", title: "+250ml" },
            { action: "add_500", title: "+500ml" },
            { action: "add_750", title: "+750ml" }
        ]
        : [];

    messageEvent.waitUntil(
        self.registration.showNotification("Hora de se hidratar", {
            body: actions.length > 0
                ? "Pressione e segure para adicionar agua rapidamente."
                : "Toque para abrir o quick add.",
            icon: "./icon-192.png",
            badge: "./icon-192.png",
            tag: "hydrate-reminder",
            renotify: true,
            actions,
            data: {
                fallbackUrl: "./index.html?openQuickAdd=1&source=push_fallback"
            }
        })
    );
});

self.addEventListener("push", (pushEvent) => {
    let payload = {};
    try {
        payload = pushEvent.data?.json?.() || {};
    } catch {
        payload = {};
    }

    const supportsActions = Number(Notification.maxActions || 0) > 0;
    const defaultActions = [
        { action: "add_250", title: "+250ml" },
        { action: "add_500", title: "+500ml" },
        { action: "add_750", title: "+750ml" }
    ];

    const notificationOptions = {
        body: payload.body || "Seu robo esta pedindo mais combustivel.",
        icon: payload.icon || "./icon-192.png",
        badge: payload.badge || "./icon-192.png",
        tag: payload.tag || "hydrate-reminder",
        renotify: true,
        data: {
            fallbackUrl: payload.fallbackUrl || "./index.html?openQuickAdd=1&source=push_fallback"
        },
        actions: supportsActions ? payload.actions || defaultActions : []
    };

    pushEvent.waitUntil(
        self.registration.showNotification(payload.title || "Lembrete de Hidratacao", notificationOptions)
    );
});

self.addEventListener("notificationclick", (clickEvent) => {
    clickEvent.notification.close();
    const clickedAction = clickEvent.action;
    const quickAddAmount = QUICK_ACTION_TO_AMOUNT[clickedAction] || 0;
    const fallbackUrl = clickEvent.notification.data?.fallbackUrl || "./index.html?openQuickAdd=1&source=push_fallback";

    clickEvent.waitUntil(
        (async () => {
            if (quickAddAmount > 0) {
                const clientList = await broadcastToOpenClients({
                    type: "QUICK_ADD",
                    rawAmountMl: quickAddAmount
                });

                if (clientList.length === 0) {
                    await enqueuePendingQuickAdd(quickAddAmount);
                }
                return;
            }

            const clientList = await broadcastToOpenClients({ type: "OPEN_QUICK_ADD" });
            if (clientList.length === 0) {
                await self.clients.openWindow(fallbackUrl);
            }
        })()
    );
});
