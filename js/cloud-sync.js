<<<<<<< HEAD:js/cloud-sync.js
create table user_agendas (
  user_id uuid references auth.users not null primary key,
  payload jsonb not null,
  updated_at timestamptz default now()
);
alter table user_agendas enable row level security;
create policy "Usuarios gestionan su propia agenda"
  on user_agendas for all using (auth.uid() = user_id);

// Conector ligero vía REST API de Supabase (0 dependencias externas)
const SUPABASE_URL = ''; // Pega aquí tu URL gratuita de Supabase (ej. https://supabase.co)
const SUPABASE_ANON_KEY = ''; // Pega aquí tu Anon Key pública

export const cloudSync = {
  isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  },

  async sendMagicLink(email) {
    if (!this.isConfigured()) {
      throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/cloud-sync.js para activar la nube.');
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/magiclink`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('No se pudo enviar el enlace de acceso.');
    return true;
  },

  async pushState(accessToken, userId, state) {
    if (!this.isConfigured() || !accessToken) return;
    await fetch(`${SUPABASE_URL}/rest/v1/user_agendas`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ user_id: userId, payload: state, updated_at: new Date().toISOString() })
    });
  }
};
=======
const SUPABASE_URL = 'https://supabase.com/dashboard/project/zjtkxgljnjdcwoptzmet'; // <-- Pega tu Project URL aquí
const SUPABASE_ANON_KEY = 'sb_publishable_d350CFHfO3QAMjRd7o5VmQ_siqvMr8z';         // <-- Pega tu anon public key aquí

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
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const session = {
        accessToken,
        refreshToken,
        userId: payload.sub,
        email: payload.email
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      // Limpia el token de la barra de direcciones por seguridad
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
    if (!this.isConfigured()) {
      throw new Error('Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en js/cloud-sync.js');
    }
    const redirectTo = window.location.origin + window.location.pathname;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/magiclink`, {
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

  async pullState(session) {
    if (!this.isConfigured() || !session) return null;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_agendas?user_id=eq.${session.userId}&select=payload,updated_at`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.accessToken}`
        }
      }
    );
    if (!res.ok) {
      if (res.status === 401) this.logout();
      return null;
    }
    const rows = await res.json();
    return rows?.[0]?.payload || null;
  },

  async pushState(session, state) {
    if (!this.isConfigured() || !session) return;
    await fetch(`${SUPABASE_URL}/rest/v1/user_agendas`, {
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
  }
};
>>>>>>> 072f10974782e651387a3a9a147dae9ad9e3c077:enfoque diario/js/cloud-sync.js
