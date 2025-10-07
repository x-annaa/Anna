// frontend/Recharge/recharge.js
// =============================
// 充值文件上传逻辑 + 写入数据库 + 模态框控制（完整版）
// =============================

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM 元素 ---
  const depositBtn = document.getElementById("depositBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");

  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("status");
  const amountInput = document.getElementById("amountInput");

  const copyAddressBtn = document.getElementById("copyAddressBtn");
  const walletAddressEl = document.getElementById("walletAddress");

  // --- Supabase 客户端检查 ---
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
      status.textContent = "";
      fileInput.value = "";
      amountInput.value = "";
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
      const textToCopy = walletAddressEl.textContent.trim();
      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy);
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
    const file = fileInput.files?.[0];
    const amount = parseFloat(amountInput.value);

    // 校验输入
    if (!amount || isNaN(amount) || amount <= 0) {
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

    const safeFileName = `${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}_${file.name.replace(/\s+/g, "_")}`;

    try {
      // 上传到 Supabase Storage
      const { error: uploadError } = await supabaseClient.storage.from("Recharge").upload(safeFileName, file);
      if (uploadError) throw uploadError;

      // 获取公共 URL
      const { data: publicUrlData } = supabaseClient.storage.from("Recharge").getPublicUrl(safeFileName);
      const publicUrl = publicUrlData?.publicUrl ?? "";

      // 获取当前用户 UUID
      let userUUID = localStorage.getItem("currentUserUUID");
      let platformAccount = localStorage.getItem("platformAccount");

      if (!userUUID) {
        // 尝试从 Supabase Auth 获取
        const { data: userData } = await supabaseClient.auth.getUser();
        userUUID = userData?.user?.id ?? null;
      }

      if (!userUUID) throw new Error("未登录用户，无法提交充值记录。");

      if (!platformAccount) {
        // 从 users 表查询 platform_account
        const { data: userDbData } = await supabaseClient.from("users").select("platform_account").eq("uuid", userUUID).maybeSingle();
        platformAccount = userDbData?.platform_account ?? null;
      }

      // 写入数据库
      const { error: insertError } = await supabaseClient.from("recharges").insert([{
        user_id: userUUID,
        platform_account: platformAccount,
        amount: Number(amount.toFixed(2)),
        recharge_url: publicUrl,
        status: "pending",
      }]);

      if (insertError) throw insertError;

      // 成功反馈
      status.textContent = "✅ 上传成功，等待审核！";
      status.style.color = "green";
      fileInput.value = "";
      amountInput.value = "";

      console.log("充值记录保存成功：", { userUUID, platformAccount, amount, publicUrl });

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
