// frontend/Recharge/recharge.js
// =============================
// 充值文件上传逻辑 + 写入数据库 + 模态框控制
// =============================

document.addEventListener("DOMContentLoaded", () => {
  // ---- 充值模态框控制 ----
  const depositBtn = document.getElementById("depositBtn");
  const rechargeModal = document.getElementById("rechargeModal");
  const cancelRecharge = document.getElementById("cancelRecharge");

  if (depositBtn && rechargeModal && cancelRecharge) {
    depositBtn.addEventListener("click", () => {
      rechargeModal.style.display = "flex";
      document.getElementById("status").textContent = "";
      document.getElementById("fileInput").value = "";
      document.getElementById("amountInput").value = "";
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

  // ---- 钱包地址复制 ----
  const copyAddressBtn = document.getElementById("copyAddressBtn");
  const walletAddress = document.getElementById("walletAddress");
  if (copyAddressBtn && walletAddress) {
    copyAddressBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(walletAddress.textContent);
      copyAddressBtn.textContent = "已复制 ✅";
      setTimeout(() => (copyAddressBtn.textContent = "复制"), 2000);
    });
  }

  // ---- 文件上传逻辑 + 写入数据库 ----
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const status = document.getElementById("status");
  const amountInput = document.getElementById("amountInput");

  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
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

    const fileName = `${Date.now()}_${file.name}`;

    try {
      // 上传截图到 Supabase Storage
      const { error: uploadError } = await supabaseClient.storage
        .from("Recharge")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 获取公共 URL
      const { data: publicUrlData } = supabaseClient
        .storage
        .from("Recharge")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      // 获取当前登录用户
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();
      if (userError || !user) throw new Error("未登录用户，无法提交充值记录。");

      // 写入数据库表 recharges
      const { error: insertError } = await supabaseClient.from("recharges").insert([
        {
          user_id: user.id,
          amount: amount,
          recharge_url: publicUrl,
          status: "pending",
        },
      ]);

      if (insertError) throw insertError;

      status.textContent = "✅ 上传成功，等待审核！";
      status.style.color = "green";

      // 清空输入
      fileInput.value = "";
      amountInput.value = "";

      console.log("充值记录已保存 ✅", { amount, publicUrl });

      // 2秒后自动关闭
      setTimeout(() => {
        rechargeModal.style.display = "none";
        status.textContent = "";
      }, 2000);
    } catch (err) {
      console.error("上传或写入失败 ❌", err);
      status.textContent = "❌ 上传失败：" + err.message;
      status.style.color = "red";
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = "上传";
    }
  });
});
