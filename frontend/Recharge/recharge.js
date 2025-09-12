// frontend/Recharge/recharge.js

// =============================
// 充值文件上传逻辑
// =============================

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("status");

  if (!fileInput || !uploadBtn || !status) {
    console.error("Recharge 页面缺少必要的 DOM 元素！");
    return;
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      status.textContent = "请先选择文件！";
      status.style.color = "red";
      return;
    }

    const fileName = `${Date.now()}_${file.name}`;
    status.textContent = "上传中...";
    status.style.color = "black";

    try {
      // ⚡ 使用全局 supabaseClient
      const { error } = await supabaseClient.storage
        .from("Recharge")
        .upload(fileName, file);

      if (error) throw error;

      // 获取文件的公共 URL
      const { data: publicUrlData } = supabaseClient
        .storage
        .from("Recharge")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      status.textContent = "上传成功！文件 URL: " + publicUrl;
      status.style.color = "green";

      console.log("上传成功 ✅ 文件地址：", publicUrl);
    } catch (err) {
      console.error("上传失败 ❌", err);
      status.textContent = "上传失败: " + err.message;
      status.style.color = "red";
    }
  });
});
