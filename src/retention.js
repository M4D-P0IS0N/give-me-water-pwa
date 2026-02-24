import { calculateDayIntake, getEffectiveDayKey } from "./state.js";

function getMonthKeyFromDayKey(dayKey) {
    return dayKey.slice(0, 7);
}

function getPreviousMonthKey(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const current = new Date(year, month - 1, 1);
    current.setMonth(current.getMonth() - 1);
    return `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, "0")}`;
}

function calculateMonthlySummary(events, goalMl) {
    const totalsByDay = new Map();

    for (const eventItem of events) {
        const previousValue = totalsByDay.get(eventItem.effectiveDayKey) || 0;
        totalsByDay.set(eventItem.effectiveDayKey, previousValue + eventItem.hydrationAmountMl);
    }

    const dayTotals = [...totalsByDay.values()];
    const daysTracked = dayTotals.length;
    const daysMetGoal = dayTotals.filter((dayValue) => dayValue >= goalMl && goalMl > 0).length;
    const averageIntakeMl = daysTracked > 0
        ? Math.round(dayTotals.reduce((sum, dayValue) => sum + dayValue, 0) / daysTracked)
        : 0;
    const completionRate = daysTracked > 0
        ? Math.round((daysMetGoal / daysTracked) * 100)
        : 0;

    return {
        averageIntakeMl,
        daysTracked,
        daysMetGoal,
        completionRate
    };
}

export function runMonthlyRetention(appState, referenceDate = new Date()) {
    const referenceDayKey = getEffectiveDayKey(referenceDate, appState.settings.endOfDayTime);
    const currentMonthKey = getMonthKeyFromDayKey(referenceDayKey);

    if (appState.retention.lastProcessedMonth === currentMonthKey) {
        return appState;
    }

    const targetMonthKey = getPreviousMonthKey(currentMonthKey);
    const targetMonthEvents = appState.history.filter(
        (eventItem) => getMonthKeyFromDayKey(eventItem.effectiveDayKey) === targetMonthKey
    );

    if (targetMonthEvents.length > 0) {
        const monthlySummary = calculateMonthlySummary(targetMonthEvents, appState.goal);
        const summaryObject = {
            monthKey: targetMonthKey,
            ...monthlySummary,
            createdAt: new Date().toISOString()
        };

        appState.monthlySummaries = appState.monthlySummaries
            .filter((summary) => summary.monthKey !== targetMonthKey)
            .concat(summaryObject)
            .sort((left, right) => right.monthKey.localeCompare(left.monthKey));
    }

    appState.history = appState.history.filter(
        (eventItem) => getMonthKeyFromDayKey(eventItem.effectiveDayKey) === currentMonthKey
    );

    appState.current = calculateDayIntake(appState.history, referenceDayKey);
    appState.lastEffectiveDayKey = referenceDayKey;
    appState.retention.lastProcessedMonth = currentMonthKey;

    return appState;
}
