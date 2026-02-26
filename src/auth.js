export function createAuthController(supabaseClient, onSessionChanged) {
    let unsubscribeListener = null;

    function cleanupAuthParamsFromUrl() {
        const cleanUrl = new URL(window.location.href);
        const queryParamsToRemove = [
            "code",
            "token_hash",
            "type",
            "access_token",
            "refresh_token",
            "expires_in",
            "expires_at",
            "provider_token",
            "provider_refresh_token",
            "error",
            "error_code",
            "error_description",
            "auth_callback"
        ];
        queryParamsToRemove.forEach((paramName) => cleanUrl.searchParams.delete(paramName));

        const rawHash = window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash;
        const hashParams = new URLSearchParams(rawHash);
        queryParamsToRemove.forEach((paramName) => hashParams.delete(paramName));
        cleanUrl.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";

        const nextUrl = cleanUrl.toString();
        if (nextUrl !== window.location.href) {
            window.history.replaceState({}, document.title, nextUrl);
        }
    }

    async function consumeAuthRedirectIfPresent() {
        if (!supabaseClient) {
            return;
        }

        const currentUrl = new URL(window.location.href);
        const code = currentUrl.searchParams.get("code");
        const tokenHash = currentUrl.searchParams.get("token_hash");
        const tokenType = currentUrl.searchParams.get("type");

        const hashParams = new URLSearchParams(
            window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        let callbackHandled = false;

        if (code) {
            callbackHandled = true;
            const { error } = await supabaseClient.auth.exchangeCodeForSession(code);
            if (error) {
                console.error("Falha ao trocar codigo do magic link por sessao.", error);
            }
        } else if (tokenHash && tokenType) {
            callbackHandled = true;
            const { error } = await supabaseClient.auth.verifyOtp({
                token_hash: tokenHash,
                type: tokenType
            });
            if (error) {
                console.error("Falha ao validar token hash do magic link.", error);
            }
        } else if (accessToken && refreshToken) {
            callbackHandled = true;
            const { error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });
            if (error) {
                console.error("Falha ao restaurar sessao a partir do hash do magic link.", error);
            }
        }

        if (callbackHandled) {
            cleanupAuthParamsFromUrl();
        }
    }

    async function initialize() {
        if (!supabaseClient) {
            onSessionChanged(null);
            return;
        }

        await consumeAuthRedirectIfPresent();

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
        const redirectUrl = new URL(`${window.location.origin}${window.location.pathname}`);
        redirectUrl.searchParams.set("auth_callback", "1");
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: cleanEmail,
            options: {
                emailRedirectTo: redirectUrl.toString()
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
