import { buildMonthlySeries, buildWeeklyAnalytics } from "./analytics.js";
import { setupAuthentication, syncPushSubscription } from "./appAuthSync.js";
import { bindUiEvents } from "./appEventBindings.js";
import { calculateGoalMlFromOnboarding, readOnboardingFormData } from "./appHelpers.js";
import {
    consumePendingQuickAddsFromServiceWorker,
    parseQuickAddFromUrl
} from "./appQuickAdd.js";
import { AMOUNTS, DRINKS, LOCAL_EVENT_SOURCE } from "./constants.js";
import { renderMascotLevel, setupMascotMotion } from "./mascot.js";
import {
    listenServiceWorkerMessages,
    registerServiceWorker,
    startReminderLoop
} from "./push.js";
import { runMonthlyRetention } from "./retention.js";
import {
    addHydrationEvent,
    createDefaultState,
    ensureDailyState,
    getTodayHistory,
    loadState,
    saveState,
    updateSettings
} from "./state.js";
import { getSupabaseClient, getSupabaseRuntimeConfig } from "./supabaseClient.js";
import { createSyncEngine } from "./sync.js";
import {
    getDomRefs,
    readSettingsForm,
    renderDashboard,
    renderDrinkAmounts,
    renderDrinkTypes,
    renderMonthlyChart,
    renderSettings,
    renderWeeklyChart,
    showQuickAddSheet,
    showScreen
} from "./ui.js";

const drinkMapById = new Map(DRINKS.map((drinkItem) => [drinkItem.id, drinkItem]));
const domRefs = getDomRefs();

let appState = runMonthlyRetention(ensureDailyState(loadState()));
let selectedDrinkId = DRINKS[0].id;
let serviceWorkerRegistration = null;
let authController = null;
let runtimeConfig = null;
let retentionSyncTimerId = null;
let lastMonthlySummarySignature = "";
let profileSyncTimerId = null;
let lastProfileSettingsSignature = "";

function getMonthlySummarySignature(stateObject) {
    return (stateObject.monthlySummaries || [])
        .map((summaryItem) => summaryItem.monthKey)
        .sort()
        .join("|");
}

function getProfileSettingsSignature(stateObject) {
    return JSON.stringify({
        profile: stateObject.profile || null,
        goal: Number(stateObject.goal || 0),
        settings: stateObject.settings || {}
    });
}

function scheduleMonthlyRetentionSync() {
    if (retentionSyncTimerId) {
        window.clearTimeout(retentionSyncTimerId);
    }

    retentionSyncTimerId = window.setTimeout(async () => {
        try {
            await syncEngine.syncMonthlySummariesAndPruneCloud();
        } catch (error) {
            console.error("Falha ao sincronizar summaries mensais com a nuvem.", error);
        }
    }, 400);
}

function scheduleProfileSync() {
    if (profileSyncTimerId) {
        window.clearTimeout(profileSyncTimerId);
    }

    profileSyncTimerId = window.setTimeout(async () => {
        try {
            await syncEngine.syncProfileAndSettings();
        } catch (error) {
            console.error("Falha ao sincronizar perfil/configuracoes na nuvem.", error);
        }
    }, 450);
}

function applyState(nextState, shouldRender = true) {
    appState = runMonthlyRetention(ensureDailyState(nextState));
    saveState(appState);
    const nextSignature = getMonthlySummarySignature(appState);
    if (nextSignature !== lastMonthlySummarySignature) {
        lastMonthlySummarySignature = nextSignature;
        scheduleMonthlyRetentionSync();
    }
    const nextProfileSignature = getProfileSettingsSignature(appState);
    if (nextProfileSignature !== lastProfileSettingsSignature) {
        lastProfileSettingsSignature = nextProfileSignature;
        scheduleProfileSync();
    }
    if (shouldRender) {
        renderApplication();
    }
}

async function deleteIndexedDatabase(databaseName) {
    if (!("indexedDB" in window)) {
        return;
    }

    await new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(databaseName);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

async function resetAllData() {
    const stateBeforeReset = appState;

    try {
        await syncEngine.resetUserData();
    } catch (error) {
        console.error("Falha ao limpar dados na nuvem.", error);
        return {
            success: false,
            message: `Falha ao limpar nuvem: ${error.message || "erro desconhecido"}`
        };
    }

    await deleteIndexedDatabase("givemewater_sw_actions");

    const freshState = createDefaultState();
    freshState.settings = { ...stateBeforeReset.settings };
    if (stateBeforeReset.sync.userId) {
        freshState.sync = {
            ...stateBeforeReset.sync,
            pendingCount: 0,
            lastSyncedAt: new Date().toISOString()
        };
    }

    applyState(freshState);
    showQuickAddSheet(domRefs, false);
    showScreen(domRefs, "onboarding");

    return {
        success: true,
        message: stateBeforeReset.sync.userId
            ? "Dados locais e da nuvem foram resetados."
            : "Dados locais foram resetados."
    };
}

function mergeRemoteEvents(remoteEvents) {
    if (!Array.isArray(remoteEvents) || remoteEvents.length === 0) {
        return;
    }

    const eventMap = new Map(appState.history.map((eventItem) => [eventItem.eventId, eventItem]));
    remoteEvents.forEach((eventItem) => eventMap.set(eventItem.eventId, eventItem));

    applyState({
        ...appState,
        history: [...eventMap.values()].sort((left, right) => {
            return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
        })
    });
}

const syncEngine = createSyncEngine(
    () => appState,
    (nextState) => applyState(nextState),
    mergeRemoteEvents
);

function updateStatusTexts() {
    const syncSource = appState.sync.userId ? "cloud+local" : "local only";
    const pendingText = `fila ${appState.sync.pendingCount || 0}`;
    const lastSyncText = appState.sync.lastSyncedAt
        ? `ultimo sync ${new Date(appState.sync.lastSyncedAt).toLocaleTimeString()}`
        : "sem sync remoto";
    domRefs.syncStatus.textContent = `Sync: ${syncSource} (${pendingText}, ${lastSyncText})`;
    domRefs.authStatus.textContent = appState.sync.email
        ? `Usuario: ${appState.sync.email}`
        : "Usuario: anonimo";
}

function renderAnalyticsIfVisible() {
    if (!domRefs.screens.analytics || domRefs.screens.analytics.classList.contains("hidden")) {
        return;
    }

    const weeklyAnalytics = buildWeeklyAnalytics(appState);
    const monthlySeries = buildMonthlySeries(appState);
    renderWeeklyChart(domRefs, weeklyAnalytics, appState.goal);
    renderMonthlyChart(domRefs, monthlySeries, appState.goal);
}

function renderApplication() {
    const todayEvents = getTodayHistory(appState);
    renderDashboard(domRefs, appState, todayEvents, drinkMapById);
    renderMascotLevel(domRefs, appState);
    renderSettings(domRefs, appState);
    updateStatusTexts();

    renderDrinkTypes(domRefs, DRINKS, selectedDrinkId, (newDrinkId) => {
        selectedDrinkId = newDrinkId;
        renderApplication();
    });

    renderDrinkAmounts(domRefs, AMOUNTS, Boolean(selectedDrinkId), (rawAmountMl) => {
        addDrink(selectedDrinkId, rawAmountMl, LOCAL_EVENT_SOURCE.MANUAL);
    });

    renderAnalyticsIfVisible();
}

async function addDrink(drinkId, rawAmountMl, source) {
    const drinkDefinition = drinkMapById.get(drinkId);
    if (!drinkDefinition) {
        return;
    }

    const nextState = { ...appState };
    const hydrationEvent = addHydrationEvent(nextState, drinkDefinition, rawAmountMl, source);
    applyState(nextState);

    try {
        await syncEngine.handleLocalHydrationEvent(hydrationEvent);
    } catch (error) {
        console.error("Falha ao sincronizar novo consumo.", error);
    }
}

async function applySettingsAndReturn() {
    const settingsData = readSettingsForm(domRefs);
    const nextState = { ...appState };

    if (settingsData.goalOverride > 0) {
        nextState.goal = settingsData.goalOverride;
    }

    updateSettings(nextState, {
        endOfDayTime: settingsData.endOfDayTime,
        startOfWeek: settingsData.startOfWeek,
        notificationsEnabled: settingsData.notificationsEnabled,
        reminderStartTime: settingsData.reminderStartTime,
        reminderEndTime: settingsData.reminderEndTime,
        intervalMinutes: settingsData.intervalMinutes
    });

    applyState(nextState);
    showScreen(domRefs, "dashboard");
    startReminderLoop(() => appState, serviceWorkerRegistration);
}

async function syncPushSubscriptionState() {
    await syncPushSubscription({
        getSupabaseClient,
        runtimeConfig,
        serviceWorkerRegistration,
        appState
    });
}

async function bootstrapApplication() {
    serviceWorkerRegistration = await registerServiceWorker();
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            consumePendingQuickAddsFromServiceWorker({
                serviceWorkerRegistration,
                addDrink
            });
        });
    }
    setupMascotMotion(domRefs);
    bindUiEvents({
        domRefs,
        renderSettings,
        renderAnalyticsIfVisible,
        applySettingsAndReturn,
        readOnboardingFormData,
        calculateGoalMlFromOnboarding,
        getAppState: () => appState,
        applyState,
        addDrink,
        resetAllData,
        syncPushSubscriptionState,
        getAuthController: () => authController,
        listenServiceWorkerMessages,
        getServiceWorkerRegistration: () => serviceWorkerRegistration
    });

    const authSetup = await setupAuthentication({
        getSupabaseClient,
        getSupabaseRuntimeConfig,
        syncEngine,
        onUserChanged: () => {
            applyState({ ...appState });
            if (appState.goal > 0) {
                showScreen(domRefs, "dashboard");
            }
        },
        onSyncPushNeeded: syncPushSubscriptionState
    });
    authController = authSetup.authController;
    runtimeConfig = authSetup.runtimeConfig;

    await syncEngine.refreshPendingCount();
    await syncPushSubscriptionState();
    scheduleMonthlyRetentionSync();

    startReminderLoop(() => appState, serviceWorkerRegistration);

    showScreen(domRefs, appState.goal > 0 ? "dashboard" : "onboarding");
    renderApplication();

    await consumePendingQuickAddsFromServiceWorker({
        serviceWorkerRegistration,
        addDrink
    });
    parseQuickAddFromUrl({
        addDrink,
        showDashboard: () => showScreen(domRefs, "dashboard"),
        showQuickAdd: (show) => showQuickAddSheet(domRefs, show)
    });
}

bootstrapApplication();
