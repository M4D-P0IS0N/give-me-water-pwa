export const STORAGE_KEY = "givemewater_state_v2";
export const STATE_VERSION = 2;
export const APP_VERSION = "v0.21.0";

export const DRINKS = [
    { id: "water", name: "Agua", hydrationFactor: 1.0, icon: "💧" },
    { id: "green_tea", name: "Cha Verde", hydrationFactor: 0.9, icon: "🍵" },
    { id: "coffee", name: "Cafe", hydrationFactor: 0.6, icon: "☕" },
    { id: "juice", name: "Suco", hydrationFactor: 0.95, icon: "🧃" },
    { id: "milk", name: "Leite", hydrationFactor: 1.3, icon: "🥛" },
    { id: "soda", name: "Refrigerante", hydrationFactor: 0.8, icon: "🥤" },
    { id: "energy", name: "Energetico", hydrationFactor: 0.55, icon: "⚡" },
    { id: "beer", name: "Cerveja", hydrationFactor: -0.4, icon: "🍺" },
    { id: "wine", name: "Vinho Tinto", hydrationFactor: -0.95, icon: "🍷" },
    { id: "caipirinha", name: "Caipirinha", hydrationFactor: -1.5, icon: "🍸" }
];

export const AMOUNTS = [
    { value: 177, label: "177ml" },
    { value: 354, label: "354ml" },
    { value: 236, label: "236ml" },
    { value: 473, label: "473ml" },
    { value: 250, label: "250ml" },
    { value: 330, label: "330ml" },
    { value: 350, label: "350ml" },
    { value: 500, label: "500ml" },
    { value: 700, label: "700ml" },
    { value: 1000, label: "1L" }
];

export const MASCOT_LEVELS = [0, 25, 50, 75, 100];
export const SHORT_WEEK_DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export const DEFAULT_SETTINGS = {
    endOfDayTime: "00:00",
    startOfWeek: 0,
    notificationsEnabled: false,
    reminderStartTime: "08:00",
    reminderEndTime: "22:00",
    intervalMinutes: 120
};

export const DEFAULT_SYNC_STATE = {
    userId: null,
    email: null,
    lastSyncedAt: null,
    pendingCount: 0
};

export const QUICK_ADD_ACTIONS = [
    { action: "add_250", title: "+250ml" },
    { action: "add_500", title: "+500ml" },
    { action: "add_750", title: "+750ml" }
];

export const SW_MESSAGE_TYPES = {
    SHOW_REMINDER: "SHOW_REMINDER",
    QUICK_ADD: "QUICK_ADD",
    OPEN_QUICK_ADD: "OPEN_QUICK_ADD"
};

export const LOCAL_EVENT_SOURCE = {
    MANUAL: "manual",
    PUSH_ACTION: "push_action",
    PUSH_QUICK_ADD: "push_quick_add",
    SYNC: "sync"
};
