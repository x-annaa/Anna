// ======================
// 当前登录用户
// ======================
let currentUser = null;
let currentNetwork = null;

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

  logoutBtn.addEventListener("click", () => logoutModal.style.display = "flex");
  cancelLogout.addEventListener("click", () => logoutModal.style.display = "none");
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

  document.getElementById("cancelWithdraw").addEventListener("click", () => {
    withdrawModal.style.display = "none";
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

  document.getElementById("saveWithdrawPwd").addEventListener("click", async () => {
    const pwd = document.getElementById("withdrawPwd").value;
    const confirmPwd = document.getElementById("confirmWithdrawPwd").value;

    if (!/^\d{6}$/.test(pwd)) return alert("请输入6位数字密码");
    if (pwd !== confirmPwd) return alert("两次输入的密码不一致");

    const { error } = await supabaseClient.from("users")
      .update({ withdraw_password: pwd })
      .eq("id", currentUser.id);

    if (error) return alert("保存密码失败：" + error.message);

    localStorage.setItem("hasWithdrawPwd", "true");
    setPasswordBtn.textContent = "更新密码";
    currentUser.withdraw_password = pwd;
    alert("提现密码设置成功！");
    setPasswordModal.style.display = "none";
  });

  document.getElementById("cancelSetPwd").addEventListener("click", () => setPasswordModal.style.display = "none");

  document.getElementById("saveUpdatePwd").addEventListener("click", async () => {
    const oldPwd = document.getElementById("oldWithdrawPwd").value;
    const newPwd = document.getElementById("newWithdrawPwd").value;
    const confirmNewPwd = document.getElementById("confirmNewWithdrawPwd").value;

    if (oldPwd !== currentUser.withdraw_password) return alert("原密码错误！");
    if (!/^\d{6}$/.test(newPwd)) return alert("新密码必须是6位数字");
    if (newPwd !== confirmNewPwd) return alert("两次新密码不一致");

    const { error } = await supabaseClient.from("users")
      .update({ withdraw_password: newPwd })
      .eq("id", currentUser.id);

    if (error) return alert("更新密码失败：" + error.message);

    currentUser.withdraw_password = newPwd;
    alert("提现密码更新成功！");
    updatePasswordModal.style.display = "none";
  });

  document.getElementById("cancelUpdatePwd").addEventListener("click", () => updatePasswordModal.style.display = "none");

  document.getElementById("submitWithdrawFinal").addEventListener("click", async () => {
    const inputPwd = document.getElementById("inputWithdrawPwd").value;
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const address = document.getElementById("walletAddress").value;

    if (inputPwd !== currentUser.withdraw_password) return alert("密码错误！");
    if (!amount || amount < 10) return alert("提现金额必须 ≥ 10");
    if (!address) return alert("请输入钱包地址");
    if (amount > Number(currentUser.balance)) return alert("余额不足");

    const { error } = await supabaseClient.from("withdrawals")
      .insert([{ user_id: currentUser.id, amount, wallet_address: address, status: "pending" }]);

    if (error) return alert("提现申请失败：" + error.message);

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

  const networkConfig = {
    TRC20: {
      qr: "https://ffdrwsemmfvqlqhyjlnb.supabase.co/storage/v1/object/public/Photos/USDTQR/images%20(1).png",
      address: "TX6aSYyGVTf1NsXWzY3kUC9pTQP111111"
    },
    ERC20: {
      qr: "https://ffdrwsemmfvqlqhyjlnb.supabase.co/storage/v1/object/public/Photos/USDTQR/images%20(2).png",
      address: "0x1111111111111111111111111111111111111111"
    }
  };

  depositBtn.addEventListener("click", () => depositModal.style.display = "flex");

  document.querySelectorAll(".network-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentNetwork = btn.dataset.network;
      document.getElementById("depositQr").src = networkConfig[currentNetwork].qr;
      document.getElementById("depositAddress").textContent = networkConfig[currentNetwork].address;
    });
  });

  document.getElementById("copyAddressBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(document.getElementById("depositAddress").textContent)
      .then(() => alert("已复制钱包地址"));
  });

  document.getElementById("downloadQrBtn").addEventListener("click", () => {
    if (!currentNetwork) return alert("请先选择网络协议");
    const link = document.createElement("a");
    link.href = networkConfig[currentNetwork].qr;
    link.download = currentNetwork + "-qr.png";
    link.click();
  });

  document.getElementById("goTransferBtn").addEventListener("click", () => {
    if (!currentNetwork) return alert("请先选择网络协议");
    depositModal.style.display = "none";
    transferModal.style.display = "flex";
  });

  document.getElementById("cancelDeposit").addEventListener("click", () => depositModal.style.display = "none");
  document.getElementById("cancelTransfer").addEventListener("click", () => transferModal.style.display = "none");

  document.getElementById("submitDepositBtn").addEventListener("click", () => {
    const amount = parseFloat(document.getElementById("depositAmount").value);
    const fileInput = document.getElementById("proofFile");

    if (!amount || amount < 10) return alert("充值金额必须 ≥ 10");
    if (!fileInput.files.length) return alert("请上传转账截图！");

    // 调用后端接口提交充值申请
    alert("前端验证完成，文件上传和充值申请将由后端处理。");
  });

  // ====== 弹窗统一关闭逻辑 ======
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
    if (e.target.id === "cancelConfirmPwd") document.getElementById("confirmPwdModal").style.display = "none";
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
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
