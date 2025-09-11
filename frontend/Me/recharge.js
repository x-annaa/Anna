// ======================
// 充值凭证上传 - 只上传到 Supabase Storage
// ======================

// 确保 supabaseClient 已初始化
if (!window.supabaseClient) {
  alert("Supabase 尚未初始化！");
  throw new Error("Supabase 未初始化");
}

// 获取按钮和文件输入框
const depositBtn = document.getElementById("depositBtn");
const depositFile = document.getElementById("depositFile");

// 点击充值按钮，触发文件选择
depositBtn.addEventListener("click", () => depositFile.click());

// 文件选择后上传
depositFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // 验证文件类型（可选）
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    alert("仅支持 PNG/JPG 格式的图片");
    return;
  }

  // 验证文件大小（可选，最大 5MB）
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("文件大小不能超过 5MB");
    return;
  }

  // 生成唯一文件路径
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/\s+/g, "_"); // 替换空格
  const filePath = `recharges/${timestamp}-${sanitizedFileName}`;

  try {
    // 上传文件到 bucket "Recharge"
    const { data, error } = await supabaseClient.storage
      .from("Recharge")
      .upload(filePath, file);

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

    alert("充值凭证已上传！\n可通过以下链接访问文件：\n" + publicUrlData.publicUrl);
  } catch (e) {
    console.error("上传异常:", e);
    alert("上传过程中出现异常，请重试！");
  } finally {
    // 清空文件输入框，方便下次上传
    depositFile.value = "";
  }
});
