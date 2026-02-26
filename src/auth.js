export function createAuthController(supabaseClient, onSessionChanged) {
    let unsubscribeListener = null;
    const AUTH_URL_PARAM_NAMES = [
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

    function parseAuthCallbackError() {
        const currentUrl = new URL(window.location.href);
        const rawErrorCode = currentUrl.searchParams.get("error_code") || "";
        const rawErrorDescription = currentUrl.searchParams.get("error_description") || "";
        if (!rawErrorCode && !rawErrorDescription) {
            return null;
        }

        if (rawErrorCode === "otp_expired") {
            return "Seu codigo expirou. Solicite um novo codigo e digite no app.";
        }

        const decodedDescription = rawErrorDescription
            ? decodeURIComponent(rawErrorDescription.replace(/\+/g, " "))
            : "";

        return decodedDescription || `Falha na autenticacao (${rawErrorCode || "erro desconhecido"}).`;
    }

    function buildEmailRedirectUrl() {
        const redirectUrl = new URL("./index.html", window.location.href);
        redirectUrl.searchParams.set("auth_callback", "1");
        return redirectUrl.toString();
    }

    function cleanupAuthParamsFromUrl() {
        const cleanUrl = new URL(window.location.href);
        AUTH_URL_PARAM_NAMES.forEach((paramName) => cleanUrl.searchParams.delete(paramName));

        const rawHash = window.location.hash.startsWith("#")
            ? window.location.hash.slice(1)
            : window.location.hash;
        const hashParams = new URLSearchParams(rawHash);
        AUTH_URL_PARAM_NAMES.forEach((paramName) => hashParams.delete(paramName));
        cleanUrl.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";

        const nextUrl = cleanUrl.toString();
        if (nextUrl !== window.location.href) {
            window.history.replaceState({}, document.title, nextUrl);
        }
    }

    async function consumeAuthRedirectIfPresent() {
        if (!supabaseClient) {
            return { message: null };
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
        const callbackErrorMessage = parseAuthCallbackError();

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

        const hasAuthArtifactsInUrl = AUTH_URL_PARAM_NAMES.some(
            (paramName) => currentUrl.searchParams.has(paramName) || hashParams.has(paramName)
        );
        if (callbackHandled || hasAuthArtifactsInUrl) {
            cleanupAuthParamsFromUrl();
        }

        return { message: callbackErrorMessage };
    }

    async function initialize() {
        if (!supabaseClient) {
            onSessionChanged(null);
            return;
        }

        const callbackResult = await consumeAuthRedirectIfPresent();
        if (callbackResult.message) {
            console.warn(callbackResult.message);
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

    async function sendLoginCode(emailAddress) {
        if (!supabaseClient || !emailAddress) {
            return { success: false, message: "Supabase nao configurado ou email invalido." };
        }

        const cleanEmail = String(emailAddress).trim().toLowerCase();
        const { error } = await supabaseClient.auth.signInWithOtp({
            email: cleanEmail,
            options: {
                shouldCreateUser: true,
                emailRedirectTo: buildEmailRedirectUrl()
            }
        });

        if (error) {
            console.error("Falha no login por email.", error);
            return { success: false, message: error.message };
        }

        return {
            success: true,
            message: "Codigo enviado por email. Nao abra o link: digite o codigo no app para sincronizar."
        };
    }

    async function verifyLoginCode(emailAddress, otpCode) {
        if (!supabaseClient || !emailAddress || !otpCode) {
            return { success: false, message: "Informe email e codigo/link." };
        }

        const cleanEmail = String(emailAddress).trim().toLowerCase();
        const rawCredential = String(otpCode).trim();
        let error = null;

        if (rawCredential.startsWith("http://") || rawCredential.startsWith("https://")) {
            try {
                const parsedUrl = new URL(rawCredential);
                const code = parsedUrl.searchParams.get("code");
                const tokenHash = parsedUrl.searchParams.get("token_hash");
                const tokenType = parsedUrl.searchParams.get("type") || "email";
                const hashParams = new URLSearchParams(parsedUrl.hash.startsWith("#")
                    ? parsedUrl.hash.slice(1)
                    : parsedUrl.hash);
                const accessToken = hashParams.get("access_token");
                const refreshToken = hashParams.get("refresh_token");

                if (code) {
                    ({ error } = await supabaseClient.auth.exchangeCodeForSession(code));
                } else if (tokenHash) {
                    ({ error } = await supabaseClient.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: tokenType
                    }));
                } else if (accessToken && refreshToken) {
                    ({ error } = await supabaseClient.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    }));
                } else {
                    return { success: false, message: "Link invalido. Cole o link completo do email." };
                }
            } catch {
                return { success: false, message: "Formato invalido. Informe codigo ou link completo." };
            }
        } else {
            const cleanToken = rawCredential;
            ({ error } = await supabaseClient.auth.verifyOtp({
                email: cleanEmail,
                token: cleanToken,
                type: "email"
            }));
        }

        if (error) {
            console.error("Falha ao validar credencial OTP.", error);
            return { success: false, message: error.message };
        }

        cleanupAuthParamsFromUrl();
        return { success: true, message: "Login concluido. Sincronizando dados..." };
    }

    async function signInWithEmail(emailAddress) {
        return sendLoginCode(emailAddress);
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
        sendLoginCode,
        verifyLoginCode,
        signInWithEmail,
        signOut,
        dispose
    };
}
