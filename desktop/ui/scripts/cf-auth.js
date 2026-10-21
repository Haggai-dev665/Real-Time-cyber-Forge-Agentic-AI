/* ============================================================
   CyberForge — backend auth client
   Thin wrapper around the Rust Tauri commands (auth_login / auth_register …)
   which call the backend at /api/auth/* and keep the session token in the
   system credential store. The token is never returned to the page.
   Usage:  cfAuth.login(email, password)  ->  { success, user, message, sessionSaved }
   ============================================================ */
(function () {
  function invoke(cmd, args) {
    var T = window.__TAURI__;
    if (T && T.core && typeof T.core.invoke === 'function') {
      return T.core.invoke(cmd, args);
    }
    return Promise.reject(
      new Error('Desktop runtime unavailable — open this inside the CyberForge app.')
    );
  }

  window.cfAuth = {
    login: function (email, password) {
      return invoke('auth_login', { credentials: { email: email, password: password } });
    },
    register: function (firstName, lastName, email, password) {
      return invoke('auth_register', { data: { firstName: firstName, lastName: lastName, email: email, password: password } });
    },
    logout: function () {
      return invoke('auth_logout');
    },
    google: function () {
      return invoke('auth_google');
    },
    getUser: function () {
      return invoke('auth_get_user');
    },
    isAuthenticated: function () {
      return invoke('auth_is_authenticated');
    },
    available: function () {
      var T = window.__TAURI__;
      return !!(T && T.core && typeof T.core.invoke === 'function');
    }
  };
})();
