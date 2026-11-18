const SUPABASE_URL = 'https://zjtkxgljnjdcwoptzmet.supabase.co/rest/v1'; // <-- Pega tu Project REST API URL aquí (debe terminar en /rest/v1)
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''; // <-- Carga la clave desde variable de entorno
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''; // <-- Carga la clave desde variable de entorno

const SESSION_KEY = 'enfoque_sb_session';

export const cloudSync = {
  isConfigured() {
    return Boolean(SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20);
  },

  // Captura el token si el usuario acaba de hacer clic en el Magic Link de su correo
  captureSessionFromUrl() {
    if (!window.location.hash.includes('access_token=')) return this.getSession();

    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      // Decodificar el payload del JWT para obtener user_id y email sin librerías
      function decodeJWTPayload(token) {
        let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        // Pad with '=' if necessary
        while (base64.length % 4) {
          base64 += '=';
        }
        return JSON.parse(atob(base64));
      }
      const payload = decodeJWTPayload(accessToken);
      const session = {
        accessToken,
        refreshToken,
        userId: payload.sub,
        email: payload.email
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      const sessionStr = localStorage.getItem(SESSION_KEY);
      if (!sessionStr) return null;
      return JSON.parse(sessionStr);
      return session;
    }
    return null;
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },
  async sendMagicLink(email) {
    if (!this.isConfigured()) return false;
    const redirectTo = window.location.origin + window.location.pathname;
    // Ensure we use only the origin for the auth endpoint
    const supabaseOrigin = (() => {
      try {
        return new URL(SUPABASE_URL).origin;
      } catch {
        return SUPABASE_URL;
      }
    })();
    const res = await fetch(`${supabaseOrigin}/auth/v1/magiclink`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        options: { emailRedirectTo: redirectTo }
      })
    });
    if (!res.ok) throw new Error('No se pudo enviar el enlace. Verifica el correo o los límites de envío.');
    return true;
  },
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.accessToken}`
        }
    const res = await fetch(
      `${SUPABASE_URL}/user_agendas?user_id=eq.${session.userId}&select=payload,updated_at`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.accessToken}`
        }
      }
    );
    );
    if (!res.ok) {
      if (res.status === 401) this.logout();
    await fetch(`${SUPABASE_REST_URL}/user_agendas`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
    await fetch(`${SUPABASE_URL}/user_agendas`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: session.userId,
        payload: state,
        updated_at: new Date().toISOString()
      })
    });
    });
  }
};
