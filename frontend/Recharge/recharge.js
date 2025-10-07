// frontend/Recharge/recharge.js
// =============================
// 充值文件上传逻辑 + 写入数据库 + 模态框控制（完整版 & 稳定版）
// =============================

document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM 元素 ----
  const depositBtn = document.getElementById("depositBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");

  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("status");
  const amountInput = document.getElementById("amountInput");

  const copyAddressBtn = document.getElementById("copyAddressBtn");
  const walletAddressEl = document.getElementById("walletAddress");

  // 检查 supabaseClient 是否存在
  if (typeof supabaseClient === "undefined") {
    console.error("supabaseClient 未定义，请确保已正确初始化 Supabase 客户端。");
    if (status) {
      status.textContent = "系统错误：未检测到 Supabase 客户端。";
      status.style.color = "red";
    }
    return;
  }

  // ---- 打开 / 关闭模态框 ----
  if (depositBtn && rechargeModal && cancelRecharge) {
    depositBtn.addEventListener("click", () => {
      rechargeModal.style.display = "flex";
      if (status) status.textContent = "";
      if (fileInput) fileInput.value = "";
      if (amountInput) amountInput.value = "";
    });

    cancelRecharge.addEventListener("click", () => {
      rechargeModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
      if (e.target === rechargeModal) rechargeModal.style.display = "none";
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") rechargeModal.style.display = "none";
    });
  }

  // ---- 钱包地址复制 ----
  if (copyAddressBtn && walletAddressEl) {
    copyAddressBtn.addEventListener("click", async () => {
      const address = walletAddressEl.textContent.trim();
      if (!address) {
        copyAddressBtn.textContent = "无地址可复制 ❌";
        setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);
        return;
      }
      try {
        await navigator.clipboard.writeText(address);
        copyAddressBtn.textContent = "已复制 ✅";
        setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);
      } catch (err) {
        console.error("复制失败：", err);
        copyAddressBtn.textContent = "复制失败 ❌";
        setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);
      }
    });
  }

  // ---- 上传与保存逻辑 ----
  if (!fileInput || !uploadBtn || !status || !amountInput) {
    console.error("Recharge 页面缺少必要的 DOM 元素。");
    return;
  }

  uploadBtn.addEventListener("click", async () => {
    // 输入校验
    const file = fileInput.files?.[0];
    const rawAmount = amountInput.value;
    const amount = parseFloat(rawAmount);

    if (!rawAmount || isNaN(amount) || amount <= 0) {
      status.textContent = "请输入有效的充值金额！";
      status.style.color = "red";
      return;
    }

    if (!file) {
      status.textContent = "请上传转账截图！";
      status.style.color = "red";
      return;
    }

    status.textContent = "上传中...";
    status.style.color = "#333";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "上传中...";

    // 安全文件名
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const safeFileName = `${Date.now()}_${rand}_${file.name.replace(/\s+/g, "_")}`;

    try {
      // 1) 上传到 Storage
      const { error: uploadError } = await supabaseClient.storage
        .from("Recharge")
        .upload(safeFileName, file);

      if (uploadError) throw uploadError;

      // 2) 获取公共 URL
      const { data: publicUrlData } = supabaseClient.storage
        .from("Recharge")
        .getPublicUrl(safeFileName);
      const publicUrl = publicUrlData?.publicUrl ?? "";

      // 3) 获取当前登录用户 UUID
      let userUUID = localStorage.getItem("currentUserUUID");
      let platformAccount = localStorage.getItem("platformAccount");

      if (!userUUID) throw new Error("未登录用户，无法提交充值记录。");

      // 4) 写入 recharges 表
      const payload = {
        user_id: userUUID,
        platform_account: platformAccount ?? null,
        amount: Number(amount.toFixed(2)),
        recharge_url: publicUrl,
        status: "pending",
      };

      const { error: insertError } = await supabaseClient
        .from("recharges")
        .insert([payload]);

      if (insertError) throw insertError;

      status.textContent = "✅ 上传成功，等待审核！";
      status.style.color = "green";

      fileInput.value = "";
      amountInput.value = "";

      console.log("充值记录保存成功：", { payload, storage: safeFileName });

      setTimeout(() => {
        rechargeModal.style.display = "none";
        status.textContent = "";
      }, 2000);

    } catch (err) {
      console.error("上传或写入失败：", err);
      status.textContent = "❌ 上传失败：" + (err.message || String(err));
      status.style.color = "red";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "上传";
    }
  });
});
