// ======================
// Supabase 初始化
// ======================
const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co"; // 替换为你的 URL
const SUPABASE_ANON_KEY = "你的匿名 Key"; // 替换为你的 ANON KEY

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

  // 可选：检查文件类型，只允许图片
  if (!file.type.startsWith("image/")) {
    alert("请选择图片文件！");
    return;
  }

  const filePath = `recharges/${Date.now()}-${file.name}`;

  // 上传到 Supabase Storage
  const { data, error } = await supabaseClient.storage
    .from("Recharge")
    .upload(filePath, file, { cacheControl: "3600", upsert: true });

  if (error) {
    console.error("上传失败:", error.message);
    alert("上传失败，请重试！");
    return;
  }

  // 获取公开访问 URL
  const { data: publicUrlData } = supabaseClient.storage
    .from("Recharge")
    .getPublicUrl(filePath);

  console.log("上传成功:", data);
  console.log("文件地址:", publicUrlData.publicUrl);
  alert("充值凭证已上传！");

  // 显示预览
  if (previewImg) {
    previewImg.src = publicUrlData.publicUrl;
    previewImg.style.display = "block";
  }

  // 可选：这里暂不写数据库
  // 后续你可以再把 publicUrlData.publicUrl 写入数据库
});
