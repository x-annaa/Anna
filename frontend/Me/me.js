// ======================
// 当前登录用户
// ======================
let currentUser = null;

// ======================
// 页面初始化
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("currentUser");
  if (!username) {
    window.location.href = "../index.html";
    return;
  }

  await loadUserInfo(username);

  // ====== Logout 弹窗 ======
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutModal = document.getElementById("logoutModal");
  const cancelLogout = document.getElementById("cancelLogout");
  const confirmLogout = document.getElementById("confirmLogout");

  logoutBtn.addEventListener("click", () => {
    logoutModal.style.display = "flex";
  });

  cancelLogout.addEventListener("click", () => {
    logoutModal.style.display = "none";
  });

  confirmLogout.addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("hasWithdrawPwd");
    window.location.href = "../index.html";
  });

  // ====== 提现逻辑 ======
  const withdrawBtn = document.getElementById("withdrawBtn");
  const withdrawModal = document.getElementById("withdrawModal");
  const withdrawBalance = document.getElementById("withdrawBalance");

  withdrawBtn.addEventListener("click", () => {
    withdrawBalance.textContent = document.getElementById("balance").textContent;
    withdrawModal.style.display = "flex";
  });

  document.getElementById("confirmWithdraw").addEventListener("click", () => {
    const amount = document.getElementById("withdrawAmount").value;
    const address = document.getElementById("walletAddress").value;

    if (!amount || !address) {
      alert("请输入金额和钱包地址");
      return;
    }

    if (localStorage.getItem("hasWithdrawPwd") === "true") {
      document.getElementById("confirmPwdModal").style.display = "flex";
    } else {
      alert("请先设置提现密码！");
    }
  });

  // ====== 设置/更新提现密码 ======
  const setPasswordBtn = document.getElementById("setPasswordBtn");
  const setPasswordModal = document.getElementById("setPasswordModal");
  const updatePasswordModal = document.getElementById("updatePasswordModal");

  setPasswordBtn.addEventListener("click", () => {
    if (localStorage.getItem("hasWithdrawPwd") === "true") {
      updatePasswordModal.style.display = "flex";
    } else {
      setPasswordModal.style.display = "flex";
    }
  });

  // ---- 设置密码 ----
  document.getElementById("saveWithdrawPwd").addEventListener("click", async () => {
    const pwd = document.getElementById("withdrawPwd").value;
    const confirmPwd = document.getElementById("confirmWithdrawPwd").value;

    if (!/^\d{6}$/.test(pwd)) {
      alert("请输入6位数字密码");
      return;
    }
    if (pwd !== confirmPwd) {
      alert("两次输入的密码不一致");
      return;
    }

    const { error } = await supabaseClient
      .from("users")
      .update({ withdraw_password: pwd })
      .eq("id", currentUser.id);

    if (error) {
      alert("保存密码失败：" + error.message);
      return;
    }

    localStorage.setItem("hasWithdrawPwd", "true");
    setPasswordBtn.textContent = "更新密码";
    currentUser.withdraw_password = pwd;
    alert("提现密码设置成功！");
    setPasswordModal.style.display = "none";
  });

  // ---- 更新密码 ----
  document.getElementById("saveUpdatePwd").addEventListener("click", async () => {
    const oldPwd = document.getElementById("oldWithdrawPwd").value;
    const newPwd = document.getElementById("newWithdrawPwd").value;
    const confirmNewPwd = document.getElementById("confirmNewWithdrawPwd").value;

    if (oldPwd !== currentUser.withdraw_password) {
      alert("原密码错误！");
      return;
    }
    if (!/^\d{6}$/.test(newPwd)) {
      alert("新密码必须是6位数字");
      return;
    }
    if (newPwd !== confirmNewPwd) {
      alert("两次新密码不一致");
      return;
    }

    const { error } = await supabaseClient
      .from("users")
      .update({ withdraw_password: newPwd })
      .eq("id", currentUser.id);

    if (error) {
      alert("更新密码失败：" + error.message);
      return;
    }

    currentUser.withdraw_password = newPwd;
    alert("提现密码更新成功！");
    updatePasswordModal.style.display = "none";
  });

  // ---- 确认提现密码 & 提交申请 ----
  document.getElementById("submitWithdrawFinal").addEventListener("click", async () => {
    const inputPwd = document.getElementById("inputWithdrawPwd").value;

    if (inputPwd !== currentUser.withdraw_password) {
      alert("密码错误！");
      return;
    }

    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const address = document.getElementById("walletAddress").value;

    if (!amount || amount < 10) {
      alert("提现金额必须 ≥ 10");
      return;
    }
    if (!address) {
      alert("请输入钱包地址");
      return;
    }
    if (amount > Number(currentUser.balance)) {
      alert("余额不足");
      return;
    }

    const { error } = await supabaseClient
      .from("withdrawals")
      .insert([{
        user_id: currentUser.id,
        amount: amount,
        wallet_address: address,
        status: "pending"
      }]);

    if (error) {
      alert("提现申请失败：" + error.message);
      return;
    }

    alert("提现申请已提交，等待后台审核！");

    withdrawModal.style.display = "none";
    document.getElementById("confirmPwdModal").style.display = "none";

    currentUser.balance -= amount;
    document.getElementById("balance").textContent = currentUser.balance.toFixed(2);
  });

  // ====== 充值逻辑 ======
  const depositBtn = document.getElementById("depositBtn");
  const depositModal = document.getElementById("depositModal");
  const transferModal = document.getElementById("transferModal");

  depositBtn.addEventListener("click", () => {
    depositModal.style.display = "flex";
  });

  document.getElementById("copyWallet").addEventListener("click", () => {
    const wallet = document.getElementById("depositWallet").textContent;
    navigator.clipboard.writeText(wallet).then(() => {
      alert("钱包地址已复制！");
    });
  });

  document.getElementById("cancelDeposit").addEventListener("click", () => {
    depositModal.style.display = "none";
  });

  document.getElementById("confirmDeposit").addEventListener("click", () => {
    depositModal.style.display = "none";
    transferModal.style.display = "flex";
  });

  document.getElementById("cancelTransfer").addEventListener("click", () => {
    transferModal.style.display = "none";
  });

  document.getElementById("submitTransfer").addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("transferAmount").value);
    const proofFile = document.getElementById("transferProof").files[0];
    const desc = document.getElementById("transferDesc").value;

    if (!amount || amount < 10) {
      alert("充值金额必须 ≥ 10 USDT");
      return;
    }
    if (!proofFile) {
      alert("请上传转账截图！");
      return;
    }

    // 上传图片到 Supabase Storage
    const fileExt = proofFile.name.split('.').pop();
    const filePath = `${currentUser.id}/${Date.now()}.${fileExt}`;
    let { error: uploadError } = await supabaseClient.storage
      .from("deposit-proofs")
      .upload(filePath, proofFile);

    if (uploadError) {
      alert("上传失败：" + uploadError.message);
      return;
    }

    const { data: { publicUrl } } = supabaseClient.storage
      .from("deposit-proofs")
      .getPublicUrl(filePath);

    // 写入数据库
    const { error } = await supabaseClient
      .from("deposits")
      .insert([{
        user_id: currentUser.id,
        amount: amount,
        proof_url: publicUrl,
        description: desc,
        status: "pending"
      }]);

    if (error) {
      alert("提交失败：" + error.message);
      return;
    }

    alert("充值申请已提交，等待后台审核！");
    transferModal.style.display = "none";
  });

  // ====== 事件代理：点击取消按钮或遮罩层关闭弹窗 ======
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }

    // 取消按钮统一处理
    const cancelIds = [
      "cancelWithdraw",
      "cancelConfirmPwd",
      "cancelSetPwd",
      "cancelUpdatePwd"
    ];
    if (cancelIds.includes(e.target.id)) {
      const modalMap = {
        "cancelWithdraw": "withdrawModal",
        "cancelConfirmPwd": "confirmPwdModal",
        "cancelSetPwd": "setPasswordModal",
        "cancelUpdatePwd": "updatePasswordModal"
      };
      document.getElementById(modalMap[e.target.id]).style.display = "none";
    }
  });

  // ESC 键关闭所有弹窗
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach((m) => (m.style.display = "none"));
    }
  });
});

// ======================
// 加载用户信息函数
// ======================
async function loadUserInfo(username) {
  if (!username) return;

  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, username, platform_account, balance, withdraw_password")
      .eq("username", username)
      .single();

    if (error || !data) {
      console.error("加载用户失败：", error?.message);
      document.getElementById("platformAccount").textContent = "错误";
      document.getElementById("balance").textContent = "错误";
      return;
    }

    currentUser = data;

    document.getElementById("username").textContent = data.username || "未知";
    document.getElementById("platformAccount").textContent = data.platform_account || "未知";
    document.getElementById("balance").textContent = (Number(data.balance) || 0).toFixed(2);

    window.currentUserId = data.id;
    localStorage.setItem("currentUserId", data.id);

    const setPasswordBtn = document.getElementById("setPasswordBtn");
    if (data.withdraw_password) {
      localStorage.setItem("hasWithdrawPwd", "true");
      setPasswordBtn.textContent = "更新密码";
    } else {
      localStorage.setItem("hasWithdrawPwd", "false");
      setPasswordBtn.textContent = "添加提现密码";
    }
  } catch (e) {
    console.error("加载用户信息异常：", e);
  }
}
