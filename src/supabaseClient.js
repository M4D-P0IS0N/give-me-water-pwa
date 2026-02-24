let cachedSupabaseClientPromise = null;

async function loadRuntimeConfig() {
    try {
        const runtimeModule = await import("./config.js");
        return runtimeModule.SUPABASE_CONFIG || null;
    } catch {
        return null;
    }
}

export async function getSupabaseClient() {
    if (cachedSupabaseClientPromise) {
        return cachedSupabaseClientPromise;
    }

    cachedSupabaseClientPromise = (async () => {
        const runtimeConfig = await loadRuntimeConfig();
        if (!runtimeConfig?.url || !runtimeConfig?.anonKey) {
            return null;
        }

        try {
            const supabaseModule = await import("https://esm.sh/@supabase/supabase-js@2.49.8");
            return supabaseModule.createClient(runtimeConfig.url, runtimeConfig.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
        } catch (error) {
            console.error("Falha ao inicializar cliente Supabase.", error);
            return null;
        }
    })();

    return cachedSupabaseClientPromise;
}

export async function getSupabaseRuntimeConfig() {
    return loadRuntimeConfig();
}
