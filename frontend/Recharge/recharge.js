// frontend/Recharge/recharge.js
// =============================
// 充值文件上传逻辑 + 写入数据库 + 模态框控制（稳定版，UUID 支持 platform_account）
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

  // --- 检查 supabaseClient ---
  if (typeof supabaseClient === "undefined") {
    console.error("supabaseClient 未定义");
    if (status) {
      status.textContent = "系统错误：未检测到 Supabase 客户端";
      status.style.color = "red";
    }
    return;
  }

  // ---- 模态框控制 ----
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
  copyAddressBtn?.addEventListener("click", () => {
    try {
      const walletAddress = copyAddressBtn.dataset.wallet;
      if (!walletAddress) throw new Error("钱包地址为空");

      const tempInput = document.createElement("input");
      tempInput.value = walletAddress;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);

      copyAddressBtn.textContent = "已复制 ✅";
      setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);

      console.log("复制成功：", walletAddress);
    } catch (err) {
      console.error("复制失败：", err);
      copyAddressBtn.textContent = "复制失败";
      setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);
    }
  });

  // ---- 上传与保存逻辑 ----
  if (!fileInput || !uploadBtn || !status || !amountInput) {
    console.error("Recharge 页面缺少必要的 DOM 元素");
    return;
  }

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    const rawAmount = amountInput.value;
    const amount = parseFloat(rawAmount);

    // 校验
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

    const rand = Math.floor(Math.random() * 9000) + 1000;
    const safeFileName = `${Date.now()}_${rand}_${file.name.replace(/\s+/g, "_")}`;

    try {
      // 上传到 Storage
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("Recharge")
        .upload(safeFileName, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from("Recharge")
        .getPublicUrl(safeFileName);
      const publicUrl = publicUrlData?.publicUrl ?? "";

      // 获取用户 UUID
      let userId = null;
      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData?.session;
        if (session?.user?.id) userId = session.user.id;
      } catch {}

      if (!userId) {
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          const user = userData?.user ?? userData;
          if (user?.id) userId = user.id;
        } catch {}
      }

      if (!userId) userId = localStorage.getItem("currentUserUUID");
      if (!userId) throw new Error("未登录用户，无法提交充值记录");

      // 获取 platform_account
      let platformAccount = null;
      try {
        const { data: userInfo, error: userInfoError } = await supabaseClient
          .from("users")
          .select("platform_account")
          .eq("uuid", userId)  // ⚠️ 使用 uuid 类型字段
          .single();
        if (userInfoError) console.warn("获取平台账号失败:", userInfoError);
        platformAccount = userInfo?.platform_account ?? null;
      } catch (e) {
        console.warn("获取平台账号异常:", e);
      }

      // 写入数据库
      const payload = {
        user_id: userId,
        platform_account: platformAccount,
        amount: Number(amount.toFixed(2)),
        recharge_url: publicUrl,
        status: "pending",
      };

      const { data: insertData, error: insertError } = await supabaseClient
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
