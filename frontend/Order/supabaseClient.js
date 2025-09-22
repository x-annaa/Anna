// ⚡ Supabase 初始化 (全局共用) supabaseClient.js
const SUPABASE_URL = "";
const SUPABASE_KEY = "";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
