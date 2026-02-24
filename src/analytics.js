import { SHORT_WEEK_DAYS } from "./constants.js";
import { getEffectiveDayKey, parseDayKey } from "./state.js";

function groupIntakeByDay(historyList) {
    const intakeByDayKey = new Map();

    historyList.forEach((eventItem) => {
        const previousValue = intakeByDayKey.get(eventItem.effectiveDayKey) || 0;
        intakeByDayKey.set(eventItem.effectiveDayKey, previousValue + eventItem.hydrationAmountMl);
    });

    return intakeByDayKey;
}

function startOfWeek(referenceDate, startOfWeekSetting) {
    const dayOfWeek = referenceDate.getDay();
    const diff = (dayOfWeek - Number(startOfWeekSetting) + 7) % 7;
    const result = new Date(referenceDate);
    result.setDate(referenceDate.getDate() - diff);
    result.setHours(0, 0, 0, 0);
    return result;
}

export function buildWeeklyAnalytics(appState, referenceTimestamp = new Date()) {
    const intakeByDay = groupIntakeByDay(appState.history);
    const referenceDayKey = getEffectiveDayKey(referenceTimestamp, appState.settings.endOfDayTime);
    const referenceDate = parseDayKey(referenceDayKey);
    const weekStartDate = startOfWeek(referenceDate, appState.settings.startOfWeek);

    const weeklyDays = [];
    let totalWeekIntake = 0;
    let daysMetGoal = 0;

    for (let index = 0; index < 7; index += 1) {
        const dayDate = new Date(weekStartDate);
        dayDate.setDate(weekStartDate.getDate() + index);
        const dayKey = `${dayDate.getFullYear()}-${(dayDate.getMonth() + 1).toString().padStart(2, "0")}-${dayDate
            .getDate()
            .toString()
            .padStart(2, "0")}`;

        const intake = intakeByDay.get(dayKey) || 0;
        const isGoalMet = appState.goal > 0 && intake >= appState.goal;
        if (isGoalMet) {
            daysMetGoal += 1;
        }

        totalWeekIntake += intake;
        weeklyDays.push({
            dayKey,
            dayLabel: SHORT_WEEK_DAYS[dayDate.getDay()],
            intake,
            isGoalMet
        });
    }

    return {
        days: weeklyDays,
        averageIntake: Math.round(totalWeekIntake / 7),
        completionRate: appState.goal > 0 ? Math.round((daysMetGoal / 7) * 100) : 0
    };
}

export function buildMonthlySeries(appState, referenceTimestamp = new Date()) {
    const intakeByDay = groupIntakeByDay(appState.history);
    const referenceDayKey = getEffectiveDayKey(referenceTimestamp, appState.settings.endOfDayTime);
    const referenceDate = parseDayKey(referenceDayKey);
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const dayLimit = referenceDate.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const points = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dayKey = `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        if (day > dayLimit) {
            points.push({ day, dayKey, intake: null });
            continue;
        }

        points.push({
            day,
            dayKey,
            intake: intakeByDay.get(dayKey) || 0
        });
    }

    return points;
}
