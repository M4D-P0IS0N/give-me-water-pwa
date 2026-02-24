import { LOCAL_EVENT_SOURCE } from "./constants.js";
import { requestNotificationPermission, startReminderLoop } from "./push.js";
import { showQuickAddSheet, showScreen } from "./ui.js";

export function bindUiEvents({
    domRefs,
    renderSettings,
    renderAnalyticsIfVisible,
    applySettingsAndReturn,
    readOnboardingFormData,
    calculateGoalMlFromOnboarding,
    getAppState,
    applyState,
    addDrink,
    resetAllData,
    syncPushSubscriptionState,
    getAuthController,
    listenServiceWorkerMessages,
    getServiceWorkerRegistration
}) {
    domRefs.onboardingForm.addEventListener("submit", async (submitEvent) => {
        submitEvent.preventDefault();
        const onboardingData = readOnboardingFormData();
        const goalMl = calculateGoalMlFromOnboarding(onboardingData);
        const appState = getAppState();

        const nextState = {
            ...appState,
            profile: onboardingData,
            goal: goalMl
        };
        applyState(nextState);
        showScreen(domRefs, "dashboard");

        if (getAppState().settings.notificationsEnabled) {
            await requestNotificationPermission();
        }
    });

    domRefs.controls.openSettings.addEventListener("click", () => {
        renderSettings(domRefs, getAppState());
        showScreen(domRefs, "settings");
    });

    domRefs.controls.backSettings.addEventListener("click", () => {
        applySettingsAndReturn();
    });

    domRefs.controls.resetData?.addEventListener("click", async () => {
        const shouldReset = window.confirm(
            "Isso vai apagar os dados locais e, se voce estiver logado, tambem os dados da nuvem. Deseja continuar?"
        );
        if (!shouldReset) {
            return;
        }

        const resetResult = await resetAllData();
        domRefs.syncStatus.textContent = resetResult.message;
    });

    domRefs.controls.recalculate.addEventListener("click", () => {
        showScreen(domRefs, "onboarding");
    });

    domRefs.controls.openAnalytics.addEventListener("click", () => {
        renderAnalyticsIfVisible();
        showScreen(domRefs, "analytics");
        renderAnalyticsIfVisible();
    });

    domRefs.controls.backAnalytics.addEventListener("click", () => {
        showScreen(domRefs, "dashboard");
    });

    domRefs.controls.requestNotificationPermission.addEventListener("click", async () => {
        const permissionResult = await requestNotificationPermission();
        domRefs.syncStatus.textContent = `Permissao de notificacao: ${permissionResult}`;
        await syncPushSubscriptionState();
        startReminderLoop(() => getAppState(), getServiceWorkerRegistration());
    });

    domRefs.controls.signIn.addEventListener("click", async () => {
        const authController = getAuthController();
        if (!authController) {
            domRefs.syncStatus.textContent = "Supabase nao configurado.";
            return;
        }

        const result = await authController.signInWithEmail(domRefs.authEmailInput.value);
        domRefs.syncStatus.textContent = result.message;
    });

    domRefs.controls.signOut.addEventListener("click", async () => {
        const authController = getAuthController();
        if (!authController) {
            domRefs.syncStatus.textContent = "Supabase nao configurado.";
            return;
        }

        const result = await authController.signOut();
        domRefs.syncStatus.textContent = result.message;
    });

    domRefs.quickAddButtons.forEach((quickAddButton) => {
        quickAddButton.addEventListener("click", () => {
            const amountMl = Number(quickAddButton.dataset.amount || 0);
            if (amountMl > 0) {
                addDrink("water", amountMl, LOCAL_EVENT_SOURCE.PUSH_QUICK_ADD);
            }
            showQuickAddSheet(domRefs, false);
        });
    });

    domRefs.closeQuickAdd.addEventListener("click", () => {
        showQuickAddSheet(domRefs, false);
    });

    listenServiceWorkerMessages(
        (quickAddAmountMl) => {
            if (quickAddAmountMl > 0) {
                addDrink("water", quickAddAmountMl, LOCAL_EVENT_SOURCE.PUSH_ACTION);
                showScreen(domRefs, "dashboard");
            }
        },
        () => {
            showQuickAddSheet(domRefs, true);
            showScreen(domRefs, "dashboard");
        }
    );
}
