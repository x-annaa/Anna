// 只初始化一次，全局挂载
if (!window.supabaseClient) {
  const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHJ3c2VtbWZ2cWxxaHlqbG5iLCJpYXQiOjE3NTYzMDI1ODQsImV4cCI6MjA3MTg3ODU4NH0.x7TQHZ2af8O_f9ye__mT6eVstlH9BiyVkNVaOnL3h74"; // ⚠️ 请换成你的 anon key

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
</script>
