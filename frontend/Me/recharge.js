// ======================
// Supabase 初始化
// ======================
const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co"; // 替换为你的 URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHJ3c2VtbWZ2cWxxaHlqbG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI1ODQsImV4cCI6MjA3MTg3ODU4NH0.x7TQHZ2af8O_f9ye__mT6eVstlH9BiyVkNVaOnL3h74"; // 替换为你的 ANON KEY

// V2 SDK 初始化方法
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

// 当前登录用户 ID
const currentUserId = localStorage.getItem("currentUserId");
if (!currentUserId) {
  alert("请先登录！");
  window.location.href = "../index.html";
}

// ======================
// 元素获取
// ======================
const depositBtn = document.getElementById("depositBtn");
const depositFile = document.getElementById("depositFile");
const previewImg = document.getElementById("previewImg");

// ======================
// 点击按钮选择文件
// ======================
depositBtn.addEventListener("click", () => depositFile.click());

// ======================
// 文件选择后上传
// ======================
depositFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("请选择图片文件！");
    return;
  }

  const filePath = `recharges/${Date.now()}-${file.name}`;

  const { data, error } = await supabaseClient.storage
    .from("Recharge")
    .upload(filePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    console.error("上传失败:", error.message);
    alert("上传失败，请重试！");
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from("Recharge")
    .getPublicUrl(filePath);

  console.log("上传成功:", data);
  console.log("文件地址:", publicUrlData.publicUrl);
  alert("充值凭证已上传！");

  if (previewImg) {
    previewImg.src = publicUrlData.publicUrl;
    previewImg.style.display = "block";
  }
});
