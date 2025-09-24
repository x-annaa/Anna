// ⚡ Supabase 初始化 (全局共用) supabaseClient.js
const SUPABASE_URL = "https://airkbwolmkidaokqhxjj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcmtid29sbWtpZGFva3FoeGpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDU0NzIsImV4cCI6MjA3NDIyMTQ3Mn0.vs0jWR6_FEeEhZ8h7-WruTyjWmxm2qmN5b-hzjvw2zQ";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


