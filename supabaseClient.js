// ⚡ 初始化 Supabase
const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHJ3c2VtbWZ2cWxxaHlqbG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI1ODQsImV4cCI6MjA3MTg3ODU4NH0.x7TQHZ2af8O_f9ye__mT6eVstlH9BiyVkNVaOnL3h74";

// 导出 Supabase 客户端（供其他模块 import）
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 确认加载成功
console.log("✅ Supabase 已初始化:", SUPABASE_URL);
