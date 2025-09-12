// 初始化 //
const { data, error } = await supabaseClient
  .from("users")
  .select("id, username, platform_account, balance, withdraw_password")
  .eq("username", username)
  .single();

// 前端使用 ES Module + Supabase CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ffdrwsemmfvqlqhyjlnb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHJ3c2VtbWZ2cWxxaHlqbG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI1ODQsImV4cCI6MjA3MTg3ODU4NH0.x7TQHZ2af8O_f9ye__mT6eVstlH9BiyVkNVaOnL3h74';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const status = document.getElementById('status');

uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    status.textContent = '请先选择文件！';
    status.style.color = 'red';
    return;
  }

  const fileName = `${Date.now()}_${file.name}`;
  status.textContent = '上传中...';
  status.style.color = 'black';

  try {
    const { data, error } = await supabase.storage
      .from('Recharge')
      .upload(fileName, file);

    if (error) throw error;

    const publicUrl = supabase.storage.from('Recharge').getPublicUrl(fileName).data.publicUrl;
    status.textContent = '上传成功！文件 URL: ' + publicUrl;
    status.style.color = 'green';
  } catch (err) {
    console.error(err);
    status.textContent = '上传失败: ' + err.message;
    status.style.color = 'red';
  }
});
