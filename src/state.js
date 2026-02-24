import {
    DEFAULT_SETTINGS,
    DEFAULT_SYNC_STATE,
    STATE_VERSION,
    STORAGE_KEY
} from "./constants.js";

function pad2(value) {
    return value.toString().padStart(2, "0");
}

function formatDayKey(dateObject) {
    return `${dateObject.getFullYear()}-${pad2(dateObject.getMonth() + 1)}-${pad2(dateObject.getDate())}`;
}

export function parseDayKey(dayKey) {
    const [year, month, day] = dayKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function parseTimeToParts(timeString = "00:00") {
    const [hoursText, minutesText] = timeString.split(":");
    const hours = Number.isFinite(Number(hoursText)) ? Number(hoursText) : 0;
    const minutes = Number.isFinite(Number(minutesText)) ? Number(minutesText) : 0;
    return [hours, minutes];
}

export function getEffectiveDayKey(timestampInput, endOfDayTime = "00:00") {
    const baseDate = new Date(timestampInput);
    if (Number.isNaN(baseDate.getTime())) {
        return formatDayKey(new Date());
    }

    const [endHour, endMinute] = parseTimeToParts(endOfDayTime);
    const shiftedDate = new Date(baseDate);
    const isBeforeCutoff =
        baseDate.getHours() < endHour ||
        (baseDate.getHours() === endHour && baseDate.getMinutes() < endMinute);

    if (isBeforeCutoff) {
        shiftedDate.setDate(shiftedDate.getDate() - 1);
    }

    shiftedDate.setHours(0, 0, 0, 0);
    return formatDayKey(shiftedDate);
}

export function createDefaultState() {
    const now = new Date();
    return {
        stateVersion: STATE_VERSION,
        profile: null,
        goal: 0,
        current: 0,
        history: [],
        monthlySummaries: [],
        lastEffectiveDayKey: getEffectiveDayKey(now, DEFAULT_SETTINGS.endOfDayTime),
        settings: { ...DEFAULT_SETTINGS },
        sync: { ...DEFAULT_SYNC_STATE },
        retention: {
            lastProcessedMonth: null
        }
    };
}

function normalizeSettings(value) {
    return {
        ...DEFAULT_SETTINGS,
        ...(value || {}),
        startOfWeek: Number((value || {}).startOfWeek ?? DEFAULT_SETTINGS.startOfWeek)
    };
}

function normalizeSync(value) {
    return {
        ...DEFAULT_SYNC_STATE,
        ...(value || {})
    };
}

function normalizeEvent(rawEvent, fallbackSettings) {
    if (!rawEvent || typeof rawEvent !== "object") {
        return null;
    }

    const timestamp = rawEvent.timestamp || new Date().toISOString();
    const effectiveDayKey =
        rawEvent.effectiveDayKey ||
        getEffectiveDayKey(timestamp, fallbackSettings.endOfDayTime);

    const hydrationAmountMl = Number(rawEvent.hydrationAmountMl ?? rawEvent.hydrationAmount ?? 0);
    const rawAmountMl = Number(rawEvent.rawAmountMl ?? rawEvent.rawAmount ?? 0);
    if (!Number.isFinite(hydrationAmountMl) || !Number.isFinite(rawAmountMl)) {
        return null;
    }

    return {
        eventId: String(rawEvent.eventId || rawEvent.id || generateEventId()),
        userId: rawEvent.userId || null,
        timestamp,
        effectiveDayKey,
        drinkId: String(rawEvent.drinkId || "water"),
        rawAmountMl,
        hydrationAmountMl,
        source: String(rawEvent.source || "manual")
    };
}

function normalizeSummaries(summaryList) {
    if (!Array.isArray(summaryList)) {
        return [];
    }

    return summaryList
        .filter(Boolean)
        .map((summary) => ({
            monthKey: String(summary.monthKey),
            averageIntakeMl: Number(summary.averageIntakeMl || 0),
            daysTracked: Number(summary.daysTracked || 0),
            daysMetGoal: Number(summary.daysMetGoal || 0),
            completionRate: Number(summary.completionRate || 0),
            createdAt: summary.createdAt || new Date().toISOString()
        }));
}

function migrateLegacyState(rawState) {
    const nextState = createDefaultState();
    const normalizedSettings = normalizeSettings({
        endOfDayTime: rawState.endOfDayTime,
        startOfWeek: rawState.startOfWeek
    });

    nextState.goal = Number(rawState.goal || 0);
    nextState.current = Number(rawState.current || 0);
    nextState.settings = normalizedSettings;
    nextState.profile = rawState.profile || null;
    nextState.history = (rawState.history || [])
        .map((eventItem) => normalizeEvent(eventItem, normalizedSettings))
        .filter(Boolean);
    nextState.lastEffectiveDayKey =
        rawState.lastEffectiveDayKey ||
        getEffectiveDayKey(new Date(), normalizedSettings.endOfDayTime);

    return nextState;
}

export function migrateState(rawState) {
    if (!rawState || typeof rawState !== "object") {
        return createDefaultState();
    }

    if (!rawState.stateVersion || rawState.stateVersion < STATE_VERSION) {
        return migrateLegacyState(rawState);
    }

    const nextState = createDefaultState();
    nextState.stateVersion = STATE_VERSION;
    nextState.profile = rawState.profile || null;
    nextState.goal = Number(rawState.goal || 0);
    nextState.current = Number(rawState.current || 0);
    nextState.settings = normalizeSettings(rawState.settings);
    nextState.sync = normalizeSync(rawState.sync);
    nextState.retention = {
        lastProcessedMonth: rawState.retention?.lastProcessedMonth || null
    };
    nextState.history = (rawState.history || [])
        .map((eventItem) => normalizeEvent(eventItem, nextState.settings))
        .filter(Boolean);
    nextState.monthlySummaries = normalizeSummaries(rawState.monthlySummaries);
    nextState.lastEffectiveDayKey =
        rawState.lastEffectiveDayKey ||
        getEffectiveDayKey(new Date(), nextState.settings.endOfDayTime);

    return nextState;
}

function safeParseState(rawStorageValue) {
    if (!rawStorageValue) {
        return null;
    }

    try {
        return JSON.parse(rawStorageValue);
    } catch (error) {
        console.error("Falha ao interpretar state salvo. Restaurando estado padrao.", error);
        return null;
    }
}

export function loadState() {
    const rawStorageValue = localStorage.getItem(STORAGE_KEY);
    const parsedState = safeParseState(rawStorageValue);
    return migrateState(parsedState);
}

export function saveState(stateObject) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateObject));
}

export function generateEventId() {
    if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function calculateDayIntake(historyList, dayKey) {
    return historyList
        .filter((eventItem) => eventItem.effectiveDayKey === dayKey)
        .reduce((sum, eventItem) => sum + eventItem.hydrationAmountMl, 0);
}

export function ensureDailyState(appState, now = new Date()) {
    const effectiveDayKey = getEffectiveDayKey(now, appState.settings.endOfDayTime);
    const isNewEffectiveDay = appState.lastEffectiveDayKey !== effectiveDayKey;

    if (isNewEffectiveDay) {
        appState.current = calculateDayIntake(appState.history, effectiveDayKey);
        appState.lastEffectiveDayKey = effectiveDayKey;
    }

    return appState;
}

export function addHydrationEvent(appState, drinkDefinition, rawAmountMl, source = "manual") {
    const timestamp = new Date().toISOString();
    const hydrationAmountMl = Math.round(rawAmountMl * drinkDefinition.hydrationFactor);
    const effectiveDayKey = getEffectiveDayKey(timestamp, appState.settings.endOfDayTime);

    const hydrationEvent = {
        eventId: generateEventId(),
        userId: appState.sync.userId || null,
        timestamp,
        effectiveDayKey,
        drinkId: drinkDefinition.id,
        rawAmountMl,
        hydrationAmountMl,
        source
    };

    appState.history.unshift(hydrationEvent);
    appState.current = calculateDayIntake(appState.history, effectiveDayKey);
    appState.lastEffectiveDayKey = effectiveDayKey;

    return hydrationEvent;
}

export function getCurrentProgressPercentage(appState) {
    if (!appState.goal || appState.goal <= 0) {
        return 0;
    }

    const rawPercentage = (appState.current / appState.goal) * 100;
    return Math.min(100, Math.max(0, rawPercentage));
}

export function getTodayHistory(appState) {
    const todayDayKey = getEffectiveDayKey(new Date(), appState.settings.endOfDayTime);
    return appState.history.filter((eventItem) => eventItem.effectiveDayKey === todayDayKey);
}

export function updateSettings(appState, partialSettings) {
    appState.settings = {
        ...appState.settings,
        ...partialSettings,
        startOfWeek: Number(partialSettings.startOfWeek ?? appState.settings.startOfWeek)
    };
    return appState;
}
