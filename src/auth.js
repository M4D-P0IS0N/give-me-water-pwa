export function createAuthController(supabaseClient, onSessionChanged) {
    let unsubscribeListener = null;

    async function initialize() {
        if (!supabaseClient) {
            onSessionChanged(null);
            return;
        }

        const {
            data: { session }
        } = await supabaseClient.auth.getSession();
        await onSessionChanged(session?.user || null);

        const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
            Promise.resolve(onSessionChanged(nextSession?.user || null)).catch((error) => {
                console.error("Falha ao processar mudanca de sessao.", error);
            });
        });

        unsubscribeListener = authListener?.subscription || null;
    }

    async function signInWithEmail(emailAddress) {
        if (!supabaseClient || !emailAddress) {
            return { success: false, message: "Supabase nao configurado ou email invalido." };
        }

        const cleanEmail = String(emailAddress).trim().toLowerCase();
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: cleanEmail,
            options: {
                emailRedirectTo: `${window.location.origin}${window.location.pathname}`
            }
        });

        if (error) {
            console.error("Falha no login por email.", error);
            return { success: false, message: error.message };
        }

        return { success: true, message: "Link de acesso enviado por email." };
    }

    async function signOut() {
        if (!supabaseClient) {
            return { success: false, message: "Supabase nao configurado." };
        }

        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error("Falha ao sair da sessao.", error);
            return { success: false, message: error.message };
        }

        return { success: true, message: "Sessao encerrada." };
    }

    function dispose() {
        if (unsubscribeListener) {
            unsubscribeListener.unsubscribe();
            unsubscribeListener = null;
        }
    }

    return {
        initialize,
        signInWithEmail,
        signOut,
        dispose
    };
}
