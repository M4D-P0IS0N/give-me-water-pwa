export function getDomRefs() {
    return {
        screens: {
            onboarding: document.getElementById("onboarding"),
            dashboard: document.getElementById("dashboard"),
            settings: document.getElementById("settings"),
            analytics: document.getElementById("analytics")
        },
        onboardingForm: document.getElementById("onboarding-form"),
        onboardingAuthEmailInput: document.getElementById("onboarding-auth-email"),
        onboardingAuthCodeInput: document.getElementById("onboarding-auth-code"),
        onboardingAuthStatus: document.getElementById("onboarding-auth-status"),
        currentIntake: document.getElementById("current-intake"),
        goalIntake: document.getElementById("goal-intake"),
        dehydrationAlert: document.getElementById("dehydration-alert"),
        drinkTypesContainer: document.getElementById("drink-types-container"),
        drinkAmountsContainer: document.getElementById("drink-amounts-container"),
        historyList: document.getElementById("history-list"),
        statAverage: document.getElementById("stat-avg-intake"),
        statCompletion: document.getElementById("stat-completion"),
        weeklyChart: document.getElementById("weekly-chart"),
        monthlyChart: document.getElementById("monthly-chart"),
        settingsForm: {
            goalOverride: document.getElementById("meta-override"),
            endOfDay: document.getElementById("end-of-day"),
            startOfWeek: document.getElementById("start-of-week"),
            notificationsEnabled: document.getElementById("notifications-enabled"),
            reminderStart: document.getElementById("reminder-start"),
            reminderEnd: document.getElementById("reminder-end"),
            reminderInterval: document.getElementById("reminder-interval")
        },
        controls: {
            openSettings: document.getElementById("btn-settings"),
            backSettings: document.getElementById("btn-back-settings"),
            recalculate: document.getElementById("btn-recalculate"),
            openAnalytics: document.getElementById("btn-analytics"),
            backAnalytics: document.getElementById("btn-back-analytics"),
            requestNotificationPermission: document.getElementById("btn-notification-permission"),
            onboardingSendCode: document.getElementById("btn-onboarding-send-code"),
            onboardingVerifyCode: document.getElementById("btn-onboarding-verify-code"),
            resetData: document.getElementById("btn-reset-data"),
            sendCode: document.getElementById("btn-send-code"),
            signIn: document.getElementById("btn-sign-in"),
            signOut: document.getElementById("btn-sign-out")
        },
        authEmailInput: document.getElementById("auth-email"),
        authCodeInput: document.getElementById("auth-code"),
        authAnonSection: document.getElementById("auth-anon-section"),
        authConnectedSection: document.getElementById("auth-connected-section"),
        authConnectedMessage: document.getElementById("auth-connected-message"),
        authStatus: document.getElementById("auth-status"),
        syncStatus: document.getElementById("sync-status"),
        notificationPermissionHelp: document.getElementById("notification-permission-help"),
        mascotRobot: document.getElementById("mascot-robot"),
        mascotOil: document.getElementById("mascot-oil"),
        mascotOilRing: document.getElementById("mascot-oil-ring"),
        mascotRobotPanel: document.getElementById("mascot-robot-panel"),
        mascotRobotShell: document.getElementById("mascot-robot-shell"),
        mascotPowerAura: document.getElementById("mascot-power-aura"),
        mascotPowerSparkles: document.getElementById("mascot-power-sparkles"),
        mascotPowerLightning: document.getElementById("mascot-power-lightning"),
        quickAddSheet: document.getElementById("quick-add-sheet"),
        closeQuickAdd: document.getElementById("btn-close-quick-add"),
        quickAddButtons: [...document.querySelectorAll(".quick-add-btn")]
    };
}

export function showScreen(domRefs, screenId) {
    Object.entries(domRefs.screens).forEach(([name, element]) => {
        element.classList.toggle("hidden", name !== screenId);
    });
}

export function renderDrinkTypes(domRefs, drinkList, selectedDrinkId, onSelectDrink) {
    domRefs.drinkTypesContainer.innerHTML = "";

    drinkList.forEach((drinkDefinition) => {
        const drinkButton = document.createElement("button");
        drinkButton.type = "button";
        drinkButton.className = "drink-btn";
        drinkButton.classList.toggle("selected", drinkDefinition.id === selectedDrinkId);
        drinkButton.dataset.drinkId = drinkDefinition.id;
        drinkButton.setAttribute("aria-label", `Selecionar bebida ${drinkDefinition.name}`);
        drinkButton.innerHTML = `
            <span class="drink-icon" aria-hidden="true">${drinkDefinition.icon}</span>
            <span class="drink-label">${drinkDefinition.name}</span>
        `;

        drinkButton.addEventListener("click", () => onSelectDrink(drinkDefinition.id));
        domRefs.drinkTypesContainer.appendChild(drinkButton);
    });
}

export function renderDrinkAmounts(domRefs, amountList, hasSelectedDrink, onAddDrinkAmount) {
    domRefs.drinkAmountsContainer.innerHTML = "";

    amountList.forEach((amountDefinition) => {
        const amountButton = document.createElement("button");
        amountButton.type = "button";
        amountButton.className = "drink-btn";
        amountButton.disabled = !hasSelectedDrink;
        amountButton.innerHTML = `
            <span class="drink-label">${amountDefinition.label}</span>
            <span class="drink-icon" aria-hidden="true">+</span>
        `;
        amountButton.setAttribute("aria-label", `Adicionar ${amountDefinition.label}`);
        amountButton.addEventListener("click", () => onAddDrinkAmount(amountDefinition.value));
        domRefs.drinkAmountsContainer.appendChild(amountButton);
    });
}

export function renderDashboard(domRefs, appState, todayEvents, drinkByIdMap) {
    domRefs.currentIntake.textContent = String(appState.current);
    domRefs.goalIntake.textContent = String(appState.goal || 0);

    if (appState.current < 0) {
        domRefs.currentIntake.style.color = "var(--danger)";
        domRefs.dehydrationAlert.classList.remove("hidden");
        domRefs.dehydrationAlert.innerHTML = `Alerta: falta recuperar <strong>${Math.abs(appState.current)}ml</strong> para zerar a desidratacao.`;
    } else {
        domRefs.currentIntake.style.color = "var(--accent)";
        domRefs.dehydrationAlert.classList.add("hidden");
        domRefs.dehydrationAlert.textContent = "";
    }

    renderHistory(domRefs, todayEvents, drinkByIdMap);
}

function renderHistory(domRefs, todayEvents, drinkByIdMap) {
    domRefs.historyList.innerHTML = "";
    if (todayEvents.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "history-item";
        emptyItem.textContent = "Nenhuma bebida registrada hoje.";
        domRefs.historyList.appendChild(emptyItem);
        return;
    }

    todayEvents.forEach((eventItem) => {
        const eventDate = new Date(eventItem.timestamp);
        const hourText = eventDate.getHours().toString().padStart(2, "0");
        const minuteText = eventDate.getMinutes().toString().padStart(2, "0");
        const drinkDefinition = drinkByIdMap.get(eventItem.drinkId);
        const isNegative = eventItem.hydrationAmountMl < 0;

        const historyElement = document.createElement("li");
        historyElement.className = "history-item";
        historyElement.innerHTML = `
            <span class="history-time">${hourText}:${minuteText}</span>
            <span class="history-desc">${drinkDefinition ? `${drinkDefinition.icon} ${drinkDefinition.name}` : "Bebida"} (${eventItem.rawAmountMl}ml)</span>
            <span class="history-amount ${isNegative ? "negative" : "positive"}">${isNegative ? "" : "+"}${eventItem.hydrationAmountMl}ml</span>
        `;
        domRefs.historyList.appendChild(historyElement);
    });
}

export function renderSettings(domRefs, appState) {
    domRefs.settingsForm.goalOverride.value = appState.goal || "";
    domRefs.settingsForm.endOfDay.value = appState.settings.endOfDayTime;
    domRefs.settingsForm.startOfWeek.value = String(appState.settings.startOfWeek);
    domRefs.settingsForm.notificationsEnabled.checked = Boolean(appState.settings.notificationsEnabled);
    domRefs.settingsForm.reminderStart.value = appState.settings.reminderStartTime;
    domRefs.settingsForm.reminderEnd.value = appState.settings.reminderEndTime;
    domRefs.settingsForm.reminderInterval.value = String(appState.settings.intervalMinutes);

    const notificationPermission =
        typeof Notification !== "undefined"
            ? Notification.permission
            : "unsupported";
    const isConnected = Boolean(appState.sync.userId);

    if (domRefs.controls.requestNotificationPermission) {
        if (notificationPermission === "granted") {
            domRefs.controls.requestNotificationPermission.textContent = "Permissao de notificacao concedida";
            domRefs.controls.requestNotificationPermission.disabled = true;
        } else if (notificationPermission === "denied") {
            domRefs.controls.requestNotificationPermission.textContent = "Notificacao bloqueada no navegador";
            domRefs.controls.requestNotificationPermission.disabled = false;
        } else if (notificationPermission === "unsupported") {
            domRefs.controls.requestNotificationPermission.textContent = "Notificacao nao suportada neste dispositivo";
            domRefs.controls.requestNotificationPermission.disabled = true;
        } else {
            domRefs.controls.requestNotificationPermission.textContent = "Ativar notificacoes do navegador";
            domRefs.controls.requestNotificationPermission.disabled = false;
        }
    }

    if (domRefs.notificationPermissionHelp) {
        if (notificationPermission === "granted") {
            domRefs.notificationPermissionHelp.textContent = "Permissao ativa: o app pode enviar lembretes em segundo plano.";
        } else if (notificationPermission === "denied") {
            domRefs.notificationPermissionHelp.textContent = "Permissao bloqueada: libere nas configuracoes do navegador para receber lembretes.";
        } else if (notificationPermission === "unsupported") {
            domRefs.notificationPermissionHelp.textContent = "Este navegador/dispositivo nao suporta notificacoes web push.";
        } else {
            domRefs.notificationPermissionHelp.textContent = "Permite que o navegador envie lembretes mesmo com o app em segundo plano.";
        }
    }

    if (domRefs.authAnonSection && domRefs.authConnectedSection) {
        domRefs.authAnonSection.classList.toggle("hidden", isConnected);
        domRefs.authConnectedSection.classList.toggle("hidden", !isConnected);
    }

    if (domRefs.authConnectedMessage) {
        domRefs.authConnectedMessage.textContent = isConnected
            ? `Conta sincronizada: ${appState.sync.email || "usuario autenticado"}.`
            : "";
    }
}

export function readSettingsForm(domRefs) {
    return {
        goalOverride: Number(domRefs.settingsForm.goalOverride.value || 0),
        endOfDayTime: domRefs.settingsForm.endOfDay.value || "00:00",
        startOfWeek: Number(domRefs.settingsForm.startOfWeek.value || 0),
        notificationsEnabled: domRefs.settingsForm.notificationsEnabled.checked,
        reminderStartTime: domRefs.settingsForm.reminderStart.value || "08:00",
        reminderEndTime: domRefs.settingsForm.reminderEnd.value || "22:00",
        intervalMinutes: Number(domRefs.settingsForm.reminderInterval.value || 120)
    };
}

export function renderWeeklyChart(domRefs, weeklyAnalytics, goalAmount) {
    domRefs.statAverage.textContent = `${weeklyAnalytics.averageIntake}ml`;
    domRefs.statCompletion.textContent = `${weeklyAnalytics.completionRate}%`;

    domRefs.weeklyChart.innerHTML = "";
    const maxIntake = Math.max(goalAmount || 0, ...weeklyAnalytics.days.map((dayItem) => dayItem.intake), 2000);

    weeklyAnalytics.days.forEach((dayItem) => {
        const wrapElement = document.createElement("div");
        wrapElement.className = "weekly-bar-wrap";
        const heightPercent = maxIntake > 0 ? Math.max(2, Math.round((dayItem.intake / maxIntake) * 100)) : 2;

        wrapElement.innerHTML = `
            <div class="weekly-bar ${dayItem.isGoalMet ? "goal-met" : ""}" style="height: ${heightPercent}%"></div>
            <span class="weekly-label">${dayItem.dayLabel}</span>
        `;
        domRefs.weeklyChart.appendChild(wrapElement);
    });
}

export function renderMonthlyChart(domRefs, monthlySeries, goalAmount) {
    domRefs.monthlyChart.innerHTML = "";
    const validPoints = monthlySeries.filter((point) => point.intake !== null);
    if (validPoints.length === 0) {
        return;
    }

    const width = 420;
    const height = 252;
    const padding = {
        top: 20,
        right: 16,
        bottom: 68,
        left: 56
    };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const totalDays = monthlySeries.length;
    const dayDenominator = Math.max(1, totalDays - 1);
    const rawMaxIntake = Math.max(goalAmount || 0, ...validPoints.map((point) => point.intake), 2000);

    let yStep = 500;
    if (rawMaxIntake > 5000) {
        yStep = 2000;
    } else if (rawMaxIntake > 3000) {
        yStep = 1000;
    }
    const maxIntake = Math.ceil(rawMaxIntake / yStep) * yStep;
    domRefs.monthlyChart.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const toX = (dayValue) => {
        return padding.left + ((dayValue - 1) / dayDenominator) * plotWidth;
    };
    const toY = (intakeValue) => {
        const safeIntake = Math.max(0, intakeValue);
        return padding.top + (1 - safeIntake / maxIntake) * plotHeight;
    };

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const areaGradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    areaGradient.setAttribute("id", "monthlyAreaGradient");
    areaGradient.setAttribute("x1", "0");
    areaGradient.setAttribute("y1", "0");
    areaGradient.setAttribute("x2", "0");
    areaGradient.setAttribute("y2", "1");
    const gradientTop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    gradientTop.setAttribute("offset", "0%");
    gradientTop.setAttribute("stop-color", "rgba(4, 165, 229, 0.44)");
    const gradientBottom = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    gradientBottom.setAttribute("offset", "100%");
    gradientBottom.setAttribute("stop-color", "rgba(30, 102, 245, 0.05)");
    areaGradient.appendChild(gradientTop);
    areaGradient.appendChild(gradientBottom);
    defs.appendChild(areaGradient);
    domRefs.monthlyChart.appendChild(defs);

    const axisTitleY = document.createElementNS("http://www.w3.org/2000/svg", "text");
    axisTitleY.setAttribute("class", "line-chart-axis-title");
    axisTitleY.setAttribute("x", String(padding.left));
    axisTitleY.setAttribute("y", "14");
    axisTitleY.textContent = "Hidratacao (ml)";
    domRefs.monthlyChart.appendChild(axisTitleY);

    for (let intakeLabelValue = 0; intakeLabelValue <= maxIntake; intakeLabelValue += yStep) {
        const yCoordinate = toY(intakeLabelValue);

        const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        gridLine.setAttribute("x1", String(padding.left));
        gridLine.setAttribute("y1", String(yCoordinate));
        gridLine.setAttribute("x2", String(padding.left + plotWidth));
        gridLine.setAttribute("y2", String(yCoordinate));
        gridLine.setAttribute("class", "line-chart-grid");
        domRefs.monthlyChart.appendChild(gridLine);

        const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        yLabel.setAttribute("class", "line-chart-axis-label");
        yLabel.setAttribute("x", String(padding.left - 8));
        yLabel.setAttribute("y", String(yCoordinate + 4));
        yLabel.setAttribute("text-anchor", "end");
        yLabel.textContent = `${intakeLabelValue}ml`;
        domRefs.monthlyChart.appendChild(yLabel);
    }

    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxis.setAttribute("x1", String(padding.left));
    yAxis.setAttribute("y1", String(padding.top));
    yAxis.setAttribute("x2", String(padding.left));
    yAxis.setAttribute("y2", String(padding.top + plotHeight));
    yAxis.setAttribute("class", "line-chart-axis");
    domRefs.monthlyChart.appendChild(yAxis);

    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxis.setAttribute("x1", String(padding.left));
    xAxis.setAttribute("y1", String(padding.top + plotHeight));
    xAxis.setAttribute("x2", String(padding.left + plotWidth));
    xAxis.setAttribute("y2", String(padding.top + plotHeight));
    xAxis.setAttribute("class", "line-chart-axis");
    domRefs.monthlyChart.appendChild(xAxis);

    const xTickStep = totalDays <= 10 ? 1 : totalDays <= 20 ? 2 : totalDays <= 26 ? 4 : 6;
    const drawnXDays = new Set();
    let lastDrawnDay = 1;
    const drawXTick = (dayValue) => {
        if (drawnXDays.has(dayValue)) {
            return;
        }
        drawnXDays.add(dayValue);
        lastDrawnDay = dayValue;
        const xCoordinate = toX(dayValue);

        const tickLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tickLine.setAttribute("x1", String(xCoordinate));
        tickLine.setAttribute("y1", String(padding.top + plotHeight));
        tickLine.setAttribute("x2", String(xCoordinate));
        tickLine.setAttribute("y2", String(padding.top + plotHeight + 4));
        tickLine.setAttribute("class", "line-chart-axis");
        domRefs.monthlyChart.appendChild(tickLine);

        const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        xLabel.setAttribute("class", "line-chart-axis-label");
        xLabel.setAttribute("x", String(xCoordinate));
        xLabel.setAttribute("y", String(height - 40));
        xLabel.setAttribute("text-anchor", "middle");
        xLabel.textContent = String(dayValue);
        domRefs.monthlyChart.appendChild(xLabel);
    };

    for (let dayValue = 1; dayValue <= totalDays; dayValue += xTickStep) {
        drawXTick(dayValue);
    }
    const minimumDistanceToLastTick = Math.max(2, Math.ceil(xTickStep / 2));
    if (totalDays - lastDrawnDay >= minimumDistanceToLastTick) {
        drawXTick(totalDays);
    }

    const axisTitleX = document.createElementNS("http://www.w3.org/2000/svg", "text");
    axisTitleX.setAttribute("class", "line-chart-axis-title");
    axisTitleX.setAttribute("x", String(padding.left + plotWidth / 2));
    axisTitleX.setAttribute("y", String(height - 12));
    axisTitleX.setAttribute("text-anchor", "middle");
    axisTitleX.textContent = "Dias do mes";
    domRefs.monthlyChart.appendChild(axisTitleX);

    if (goalAmount > 0) {
        const goalY = toY(goalAmount);
        const goalLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        goalLine.setAttribute("x1", String(padding.left));
        goalLine.setAttribute("y1", String(goalY));
        goalLine.setAttribute("x2", String(padding.left + plotWidth));
        goalLine.setAttribute("y2", String(goalY));
        goalLine.setAttribute("class", "line-chart-goal");
        domRefs.monthlyChart.appendChild(goalLine);
    }

    const linePoints = validPoints.map((pointValue) => {
        const xCoordinate = toX(pointValue.day);
        const yCoordinate = toY(pointValue.intake);
        return `${xCoordinate},${Math.max(0, yCoordinate)}`;
    });
    const firstDayX = toX(validPoints[0].day);
    const lastDayX = toX(validPoints[validPoints.length - 1].day);
    const areaPoints = [`${firstDayX},${padding.top + plotHeight}`];
    areaPoints.push(...linePoints);
    areaPoints.push(`${lastDayX},${padding.top + plotHeight}`);

    if (validPoints.length === 1) {
        const pointText = linePoints[0];
        areaPoints[0] = `${pointText.split(",")[0]},${padding.top + plotHeight}`;
        areaPoints[2] = `${pointText.split(",")[0]},${padding.top + plotHeight}`;
    }

    const areaPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    areaPolygon.setAttribute("class", "line-chart-area");
    areaPolygon.setAttribute("fill", "url(#monthlyAreaGradient)");
    areaPolygon.setAttribute("points", areaPoints.join(" "));
    domRefs.monthlyChart.appendChild(areaPolygon);

    const linePolyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    linePolyline.setAttribute("class", "line-chart-path");
    linePolyline.setAttribute("points", linePoints.join(" "));
    domRefs.monthlyChart.appendChild(linePolyline);

    linePoints.forEach((pointText) => {
        const [xCoordinate, yCoordinate] = pointText.split(",");
        const pointCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        pointCircle.setAttribute("class", "line-chart-point");
        pointCircle.setAttribute("cx", xCoordinate);
        pointCircle.setAttribute("cy", yCoordinate);
        pointCircle.setAttribute("r", "2");
        domRefs.monthlyChart.appendChild(pointCircle);
    });
}

export function showQuickAddSheet(domRefs, show) {
    domRefs.quickAddSheet.classList.toggle("hidden", !show);
}
