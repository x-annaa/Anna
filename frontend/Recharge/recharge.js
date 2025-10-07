// frontend/Recharge/recharge.js
// =============================
// 充值文件上传逻辑 + 模态框控制（优化版）
// =============================

document.addEventListener("DOMContentLoaded", () => {
  // ---- 充值模态框控制 ----
  const depositBtn = document.getElementById("depositBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");

  if (depositBtn && rechargeModal && cancelRecharge) {
    depositBtn.addEventListener("click", () => {
      rechargeModal.style.display = "flex";
      // 重置状态文字与文件选择框
      document.getElementById("status").textContent = "";
      document.getElementById("fileInput").value = "";
    });

    cancelRecharge.addEventListener("click", () => {
      rechargeModal.style.display = "none";
    });

    // 点击模态框外部关闭
    window.addEventListener("click", (e) => {
      if (e.target === rechargeModal) {
        rechargeModal.style.display = "none";
      }
    });
  }

  // ---- 文件上传逻辑 ----
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
    status.style.color = "#333";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "上传中...";

    try {
      // ⚡ 使用全局 supabaseClient
      const { error } = await supabaseClient.storage
        .from("Recharge")
        .upload(fileName, file);

      if (error) throw error;

      // ✅ 上传成功（只提示成功，不显示 URL）
      status.textContent = "✅ 上传成功！";
      status.style.color = "green";

      // 清空文件选择
      fileInput.value = "";

      console.log("上传成功 ✅ 文件名：", fileName);

      // 2 秒后自动关闭弹窗
      setTimeout(() => {
        rechargeModal.style.display = "none";
        status.textContent = "";
      }, 2000);
    } catch (err) {
      console.error("上传失败 ❌", err);
      status.textContent = "❌ 上传失败：" + err.message;
      status.style.color = "red";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "上传";
    }
  });
});
