// ⚡ Supabase 初始化 (全局共用) supabaseClient.js
const SUPABASE_URL = "https://ofaxbeydyeajdgwwqrzz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mYXhiZXlkeWVhamRnd3dxcnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NzQxMTQsImV4cCI6MjA3NDA1MDExNH0.mJGdh6BBEy2Mp83H7aBEo3wIFyIsUsVfqgTErgsvFdY";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
