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
