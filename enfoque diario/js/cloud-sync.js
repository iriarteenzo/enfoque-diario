// Conector REST opcional para el plan gratuito de Supabase (0 dependencias)
const SUPABASE_URL = '';      // Ej: 'https://supabase.co'
const SUPABASE_ANON_KEY = ''; // Tu clave pública anon de Supabase

export const cloudSync = {
  isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  },

  async sendMagicLink(email) {
    if (!this.isConfigured()) {
      throw new Error('Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/cloud-sync.js para activar la nube.');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Introduce un correo electrónico válido.');
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/magiclink`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('No se pudo enviar el enlace de acceso.');
    return true;
  },

  async pushState(accessToken, userId, state) {
    if (!this.isConfigured() || !accessToken || !userId) return;
    await fetch(`${SUPABASE_URL}/rest/v1/user_agendas`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        payload: state,
        updated_at: new Date().toISOString()
      })
    });
  }
};
