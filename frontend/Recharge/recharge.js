// frontend/Recharge/recharge.js
// =============================
// 充值文件上传逻辑 + 写入数据库 + 模态框控制（改进 & 更稳）
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

  // --- 基本检查 ---
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
      if (status) {
        status.textContent = "";
      }
      if (fileInput) fileInput.value = "";
      if (amountInput) amountInput.value = "";
    });

    cancelRecharge.addEventListener("click", () => {
      rechargeModal.style.display = "none";
    });

    // 点击模态框外部关闭
    window.addEventListener("click", (e) => {
      if (e.target === rechargeModal) rechargeModal.style.display = "none";
    });

    // ESC 关闭（增强体验）
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") rechargeModal.style.display = "none";
    });
  }

  // ---- 钱包地址复制 ----
  if (copyAddressBtn && walletAddressEl) {
    copyAddressBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(walletAddressEl.textContent.trim());
        copyAddressBtn.textContent = "已复制 ✅";
        setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);
      } catch (err) {
        console.error("复制失败：", err);
        copyAddressBtn.textContent = "复制失败";
        setTimeout(() => (copyAddressBtn.textContent = "复制"), 1800);
      }
    });
  }

  // ---- 上传与保存逻辑 ----
  if (!fileInput || !uploadBtn || !status || !amountInput) {
    console.error("Recharge 页面缺少必要的 DOM 元素（fileInput / uploadBtn / status / amountInput）。");
    return;
  }

  uploadBtn.addEventListener("click", async () => {
    // 输入校验
    const file = fileInput.files && fileInput.files[0];
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

    // 准备上传
    status.textContent = "上传中...";
    status.style.color = "#333";
    uploadBtn.disabled = true;
    uploadBtn.textContent = "上传中...";

    // 生成文件名（加时间戳与随机后缀，降低冲突概率）
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const safeFileName = `${Date.now()}_${rand}_${file.name.replace(/\s+/g, "_")}`;

    try {
      // 1) 上传到 Storage
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from("Recharge")
        .upload(safeFileName, file);

      if (uploadError) {
        // 如果是已存在冲突，可以尝试重试一次（加后缀）
        console.error("storage.upload 错误：", uploadError);
        throw uploadError;
      }

      // 2) 取公共 URL（getPublicUrl 在 supabase-js v2 是同步返回一个对象）
      const { data: publicUrlData } = supabaseClient.storage
        .from("Recharge")
        .getPublicUrl(safeFileName);

      const publicUrl = publicUrlData?.publicUrl ?? "";

      // 3) 获取当前登录用户（优先使用 getSession，然后回退到 getUser，再回退到 localStorage 存的 currentUserId）
      let userId = null;
      try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const session = sessionData?.session;
        if (session && session.user && session.user.id) {
          userId = session.user.id;
        }
      } catch (e) {
        // 不致命，继续尝试其他方法
        console.warn("auth.getSession() 出错（可忽略，尝试回退）：", e);
      }

      if (!userId) {
        try {
          const { data: userData } = await supabaseClient.auth.getUser();
          const user = userData?.user ?? userData; // 有些版本返回结构不同
          if (user && user.id) userId = user.id;
        } catch (e) {
          console.warn("auth.getUser() 回退尝试失败：", e);
        }
      }

      if (!userId) {
        // 最后再尝试从本地存储读 currentUserId（你在 me.js 中有写入）
        const localUUID = localStorage.getItem("currentUserUUID");
        if (localUUID) userId = localUUID;
      }

      if (!userId) {
        throw new Error("未登录用户，无法提交充值记录。");
      }

      // 4) 写入数据库 recharges 表
      const payload = {
        user_id: userId,
        amount: Number(amount.toFixed(2)),
        recharge_url: publicUrl,
        status: "pending",
      };

      const { data: insertData, error: insertError } = await supabaseClient
        .from("recharges")
        .insert([payload]);

      if (insertError) {
        console.error("插入 recharges 表失败：", insertError);
        throw insertError;
      }

      // 成功反馈（不显示 URL）
      status.textContent = "✅ 上传成功，等待审核！";
      status.style.color = "green";

      // 清空表单
      fileInput.value = "";
      amountInput.value = "";

      console.log("充值记录保存成功：", { payload, storage: safeFileName });

      // 自动关闭（短暂等待）
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
  }); // end uploadBtn click
});

// 获取当前用户
const userUUID = localStorage.getItem("currentUserUUID");      // uuid
const platformAccount = localStorage.getItem("platformAccount"); // 平台账号

const { error: insertError } = await supabaseClient.from("recharges").insert([
  {
    user_id: userUUID,
    platform_account: platformAccount,
    amount: amount,
    recharge_url: publicUrl,
    status: "pending",
  },
]);
