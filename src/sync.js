const SYNC_DB_NAME = "givemewater_sync_queue";
const SYNC_DB_VERSION = 1;
const EVENT_STORE_NAME = "queued_events";

function openQueueDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(EVENT_STORE_NAME)) {
                database.createObjectStore(EVENT_STORE_NAME, { keyPath: "eventId" });
            }
        };
    });
}

async function putQueuedEvent(hydrationEvent) {
    const database = await openQueueDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(EVENT_STORE_NAME, "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore(EVENT_STORE_NAME).put(hydrationEvent);
    });
    database.close();
}

async function deleteQueuedEvent(eventId) {
    const database = await openQueueDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(EVENT_STORE_NAME, "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore(EVENT_STORE_NAME).delete(eventId);
    });
    database.close();
}

async function listQueuedEvents() {
    const database = await openQueueDatabase();
    const events = await new Promise((resolve, reject) => {
        const transaction = database.transaction(EVENT_STORE_NAME, "readonly");
        const request = transaction.objectStore(EVENT_STORE_NAME).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
    database.close();
    return events;
}

async function getQueuedEventCount() {
    const database = await openQueueDatabase();
    const count = await new Promise((resolve, reject) => {
        const transaction = database.transaction(EVENT_STORE_NAME, "readonly");
        const request = transaction.objectStore(EVENT_STORE_NAME).count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || 0);
    });
    database.close();
    return count;
}

async function clearQueuedEvents() {
    const database = await openQueueDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(EVENT_STORE_NAME, "readwrite");
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve();
        transaction.objectStore(EVENT_STORE_NAME).clear();
    });
    database.close();
}

function eventToDatabaseRow(hydrationEvent, userId) {
    return {
        event_id: hydrationEvent.eventId,
        user_id: userId,
        timestamp_utc: hydrationEvent.timestamp,
        effective_day_key: hydrationEvent.effectiveDayKey,
        drink_id: hydrationEvent.drinkId,
        raw_amount_ml: hydrationEvent.rawAmountMl,
        hydration_amount_ml: hydrationEvent.hydrationAmountMl,
        source: hydrationEvent.source
    };
}

function rowToHydrationEvent(databaseRow) {
    return {
        eventId: databaseRow.event_id,
        userId: databaseRow.user_id,
        timestamp: databaseRow.timestamp_utc,
        effectiveDayKey: databaseRow.effective_day_key,
        drinkId: databaseRow.drink_id,
        rawAmountMl: databaseRow.raw_amount_ml,
        hydrationAmountMl: databaseRow.hydration_amount_ml,
        source: databaseRow.source || "sync"
    };
}

function monthlySummaryToDatabaseRow(summaryItem, userId) {
    return {
        user_id: userId,
        month_key: summaryItem.monthKey,
        average_intake_ml: Number(summaryItem.averageIntakeMl || 0),
        days_tracked: Number(summaryItem.daysTracked || 0),
        days_met_goal: Number(summaryItem.daysMetGoal || 0),
        completion_rate: Number(summaryItem.completionRate || 0)
    };
}

export function createSyncEngine(getState, setState, mergeRemoteEvents) {
    let supabaseClient = null;
    let realtimeChannel = null;
    const prunedMonthKeySet = new Set();

    function updateSyncStatus(partialSyncState) {
        const currentState = getState();
        setState({
            ...currentState,
            sync: {
                ...currentState.sync,
                ...partialSyncState
            }
        });
    }

    async function refreshPendingCount() {
        try {
            const pendingCount = await getQueuedEventCount();
            updateSyncStatus({ pendingCount });
        } catch (error) {
            console.error("Falha ao atualizar contador de fila sync.", error);
        }
    }

    async function sendEventToCloud(hydrationEvent) {
        const state = getState();
        if (!supabaseClient || !state.sync.userId) {
            return false;
        }

        const payload = eventToDatabaseRow(hydrationEvent, state.sync.userId);
        const { error } = await supabaseClient
            .from("hydration_events")
            .upsert(payload, { onConflict: "event_id" });

        if (error) {
            console.error("Erro ao enviar evento para nuvem.", error);
            return false;
        }

        updateSyncStatus({ lastSyncedAt: new Date().toISOString() });
        return true;
    }

    async function flushQueue() {
        if (!supabaseClient || !getState().sync.userId) {
            return;
        }

        const queuedEvents = await listQueuedEvents();
        for (const queuedEvent of queuedEvents) {
            const sentSuccessfully = await sendEventToCloud(queuedEvent);
            if (sentSuccessfully) {
                await deleteQueuedEvent(queuedEvent.eventId);
            }
        }

        await refreshPendingCount();
    }

    async function handleLocalHydrationEvent(hydrationEvent) {
        await putQueuedEvent(hydrationEvent);
        await refreshPendingCount();
        await flushQueue();
    }

    async function pullCloudSnapshot() {
        if (!supabaseClient || !getState().sync.userId) {
            return;
        }

        const userId = getState().sync.userId;
        const [{ data: cloudEvents, error: cloudEventsError }, { data: cloudSummaries, error: cloudSummaryError }] = await Promise.all([
            supabaseClient
                .from("hydration_events")
                .select("*")
                .eq("user_id", userId)
                .order("timestamp_utc", { ascending: false })
                .limit(1500),
            supabaseClient
                .from("monthly_summaries")
                .select("*")
                .eq("user_id", userId)
                .order("month_key", { ascending: false })
        ]);

        if (cloudEventsError) {
            console.error("Erro ao puxar hydration_events da nuvem.", cloudEventsError);
        } else {
            mergeRemoteEvents((cloudEvents || []).map(rowToHydrationEvent));
        }

        if (cloudSummaryError) {
            console.error("Erro ao puxar monthly_summaries da nuvem.", cloudSummaryError);
        } else {
            const currentState = getState();
            setState({
                ...currentState,
                monthlySummaries: (cloudSummaries || []).map((summaryRow) => ({
                    monthKey: summaryRow.month_key,
                    averageIntakeMl: summaryRow.average_intake_ml,
                    daysTracked: summaryRow.days_tracked,
                    daysMetGoal: summaryRow.days_met_goal,
                    completionRate: summaryRow.completion_rate,
                    createdAt: summaryRow.created_at
                }))
            });
        }
    }

    async function attachRealtime() {
        if (!supabaseClient || !getState().sync.userId) {
            return;
        }

        if (realtimeChannel) {
            await supabaseClient.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        realtimeChannel = supabaseClient
            .channel("hydration-events-channel")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "hydration_events",
                    filter: `user_id=eq.${getState().sync.userId}`
                },
                (payload) => {
                    mergeRemoteEvents([rowToHydrationEvent(payload.new)]);
                }
            )
            .subscribe();
    }

    async function syncMonthlySummariesAndPruneCloud() {
        const state = getState();
        if (!supabaseClient || !state.sync.userId) {
            return;
        }

        const summaries = Array.isArray(state.monthlySummaries) ? state.monthlySummaries : [];
        for (const summaryItem of summaries) {
            if (!summaryItem?.monthKey) {
                continue;
            }

            const summaryPayload = monthlySummaryToDatabaseRow(summaryItem, state.sync.userId);
            const { error: upsertSummaryError } = await supabaseClient
                .from("monthly_summaries")
                .upsert(summaryPayload, { onConflict: "user_id,month_key" });

            if (upsertSummaryError) {
                console.error("Erro ao sincronizar summary mensal.", upsertSummaryError);
                continue;
            }

            if (prunedMonthKeySet.has(summaryItem.monthKey)) {
                continue;
            }

            const { error: deleteEventsError } = await supabaseClient
                .from("hydration_events")
                .delete()
                .eq("user_id", state.sync.userId)
                .like("effective_day_key", `${summaryItem.monthKey}%`);

            if (deleteEventsError) {
                console.error("Erro ao limpar eventos detalhados antigos na nuvem.", deleteEventsError);
                continue;
            }

            prunedMonthKeySet.add(summaryItem.monthKey);
        }

        updateSyncStatus({ lastSyncedAt: new Date().toISOString() });
    }

    async function setSupabaseClient(clientInstance) {
        supabaseClient = clientInstance;
        await refreshPendingCount();
    }

    async function setUserSession(userSession) {
        updateSyncStatus({
            userId: userSession?.id || null,
            email: userSession?.email || null
        });
        await attachRealtime();
        await pullCloudSnapshot();
        await flushQueue();
        await syncMonthlySummariesAndPruneCloud();
    }

    async function resetUserData() {
        const state = getState();
        if (supabaseClient && state.sync.userId) {
            const userId = state.sync.userId;
            const [
                deleteEventsResponse,
                deleteSummariesResponse,
                deletePushSubscriptionsResponse
            ] = await Promise.all([
                supabaseClient.from("hydration_events").delete().eq("user_id", userId),
                supabaseClient.from("monthly_summaries").delete().eq("user_id", userId),
                supabaseClient.from("push_subscriptions").delete().eq("user_id", userId)
            ]);

            const cloudErrors = [
                deleteEventsResponse.error,
                deleteSummariesResponse.error,
                deletePushSubscriptionsResponse.error
            ].filter(Boolean);
            if (cloudErrors.length > 0) {
                throw new Error(cloudErrors.map((errorItem) => errorItem.message).join(" | "));
            }
        }

        await clearQueuedEvents();
        await refreshPendingCount();
        prunedMonthKeySet.clear();
    }

    return {
        setSupabaseClient,
        setUserSession,
        handleLocalHydrationEvent,
        refreshPendingCount,
        flushQueue,
        pullCloudSnapshot,
        syncMonthlySummariesAndPruneCloud,
        resetUserData
    };
}
