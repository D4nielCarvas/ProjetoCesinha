const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://wxtfbrtimijsayfbyrcl.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient = null;

if (supabaseUrl && supabaseKey) {
    try {
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });
    } catch (err) {
        console.warn('[Supabase Config Warning] Não foi possível inicializar o cliente Supabase:', err.message);
    }
}

module.exports = {
    supabase: supabaseClient,
    isSupabaseConfigured: () => !!supabaseClient
};
