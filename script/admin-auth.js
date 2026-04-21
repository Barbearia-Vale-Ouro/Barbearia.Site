/**
 * admin-auth.js
 * Autenticação via API REST (Node.js + MySQL).
 * O token JWT retornado pelo servidor é armazenado em sessionStorage.
 */
(function () {
    'use strict';

    var TOKEN_KEY = 'bvo_admin_token';
    var API_LOGIN = '/api/auth/login';

    var AdminAuth = {
        /**
         * Realiza login via API.
         * Retorna Promise<{ success: boolean, error?: string }>
         */
        login: async function (username, password) {
            try {
                var res = await fetch(API_LOGIN, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username, password: password })
                });

                if (res.status === 429) {
                    return { success: false, error: 'Muitas tentativas. Aguarde 15 minutos.' };
                }

                var data = await res.json().catch(function () { return {}; });

                if (!res.ok) {
                    return { success: false, error: data.error || 'Usuário ou senha incorretos.' };
                }

                if (!data.token) {
                    return { success: false, error: 'Resposta inválida do servidor.' };
                }

                sessionStorage.setItem(TOKEN_KEY, data.token);
                return { success: true };
            } catch (e) {
                return { success: false, error: 'Servidor indisponível. Verifique se o Node.js está rodando.' };
            }
        },

        /**
         * Verifica se há token em sessionStorage.
         */
        isLoggedIn: function () {
            return !!sessionStorage.getItem(TOKEN_KEY);
        },

        /**
         * Retorna o token JWT armazenado.
         */
        getToken: function () {
            return sessionStorage.getItem(TOKEN_KEY) || '';
        },

        /**
         * Encerra a sessão.
         */
        logout: function () {
            sessionStorage.removeItem(TOKEN_KEY);
        },

        /**
         * Redireciona para login se não autenticado.
         */
        requireAuth: function () {
            if (!this.isLoggedIn()) {
                window.location.replace('admin-login.html');
            }
        }
    };

    window.AdminAuth = AdminAuth;
}());
