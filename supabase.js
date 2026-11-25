// Darsak frontend Supabase client — fery90game project
const SUPABASE_URL = "https://twchvyxflykaljyqwpvx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NRnPXPnxgSUVmNGLVIimAw_2Nng1m0g";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
