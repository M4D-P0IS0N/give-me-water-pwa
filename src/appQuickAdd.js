import { LOCAL_EVENT_SOURCE } from "./constants.js";

export function parseQuickAddFromUrl({ addDrink, showDashboard, showQuickAdd }) {
    const params = new URLSearchParams(window.location.search);
    const quickAddAmount = Number(params.get("quickAdd") || 0);
    const shouldOpenQuickAdd = params.get("openQuickAdd") === "1";
    const source = params.get("source") || LOCAL_EVENT_SOURCE.PUSH_QUICK_ADD;

    if (quickAddAmount > 0) {
        addDrink("water", quickAddAmount, source);
        showDashboard();
    }

    if (shouldOpenQuickAdd) {
        showQuickAdd(true);
        showDashboard();
    }

    if (quickAddAmount > 0 || shouldOpenQuickAdd) {
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
    }
}

export async function consumePendingQuickAddsFromServiceWorker({
    serviceWorkerRegistration,
    addDrink
}) {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    const workerTarget =
        navigator.serviceWorker.controller ||
        serviceWorkerRegistration?.active ||
        serviceWorkerRegistration?.waiting;

    if (!workerTarget) {
        return;
    }

    const channel = new MessageChannel();
    const responsePromise = new Promise((resolve) => {
        channel.port1.onmessage = (responseEvent) => {
            resolve(responseEvent.data || null);
        };
    });

    workerTarget.postMessage({ type: "GET_PENDING_QUICK_ADDS" }, [channel.port2]);
    const responseData = await Promise.race([
        responsePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
    ]);

    if (!responseData || !Array.isArray(responseData.actions)) {
        return;
    }

    for (const actionItem of responseData.actions) {
        const amountMl = Number(actionItem.rawAmountMl || 0);
        if (amountMl > 0) {
            await addDrink("water", amountMl, actionItem.source || LOCAL_EVENT_SOURCE.PUSH_ACTION);
        }
    }
}
