// ⚡ Supabase 初始化 (全局共用) supabaseClient.js
const SUPABASE_URL = "https://jetkopbzwgqjjefilyrw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpldGtvcGJ6d2dxamplZmlseXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjY3NTQsImV4cCI6MjA3NDE0Mjc1NH0.vUO63EX-Pyb3hWmI0GY2pfoeGD6mZZaz3n0pxYB_yU8";

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
