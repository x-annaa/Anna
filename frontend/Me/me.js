let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("currentUser");
  if (!username) {
    window.location.href = "../index.html";
    return;
  }

  await loadUserInfo(username);

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

    if (!amount || !address) return alert("请输入金额和钱包地址");

    if (localStorage.getItem("hasWithdrawPwd") === "true") {

      document.getElementById("confirmPwdModal").style.display = "flex";
    } else {

      submitWithdraw();
    }
  });

  async function submitWithdraw() {
    const inputPwdField = document.getElementById("inputWithdrawPwd");
    const inputPwd = inputPwdField ? inputPwdField.value : null;

    if (localStorage.getItem("hasWithdrawPwd") === "true") {
      if (inputPwd !== currentUser.withdraw_password) return alert("提现密码错误！");
    }

    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const address = document.getElementById("walletAddress").value;

    if (!amount || amount < 10) return alert("提现金额必须 ≥ 10");
    if (!address) return alert("请输入钱包地址");
    if (amount > Number(currentUser.balance)) return alert("余额不足");

    const { error } = await supabaseClient.from("withdrawals").insert([{
      user_id: currentUser.id,
      amount,
      wallet_address: address,
      status: "pending"
    }]);
    if (error) return alert("提现申请失败：" + error.message);

    alert("提现申请已提交，等待后台审核！");

    withdrawModal.style.display = "none";
    if (inputPwdField) document.getElementById("confirmPwdModal").style.display = "none";

    currentUser.balance -= amount;
    document.getElementById("balance").textContent = currentUser.balance.toFixed(2);
  }

  document.getElementById("submitWithdrawFinal").addEventListener("click", submitWithdraw);

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

    const { error } = await supabaseClient
      .from("users")
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

    const { error } = await supabaseClient
      .from("users")
      .update({ withdraw_password: newPwd })
      .eq("id", currentUser.id);
    if (error) return alert("更新密码失败：" + error.message);

    currentUser.withdraw_password = newPwd;
    alert("提现密码更新成功！");
    updatePasswordModal.style.display = "none";
  });
  document.getElementById("cancelUpdatePwd").addEventListener("click", () => updatePasswordModal.style.display = "none");

  const changeLoginPwdBtn = document.getElementById("changeLoginPwdBtn");
  const changeLoginPwdModal = document.getElementById("changeLoginPwdModal");

  changeLoginPwdBtn.addEventListener("click", () => {
    changeLoginPwdModal.style.display = "flex";
    document.getElementById("currentLoginPwd").value = "";
    document.getElementById("newLoginPwd").value = "";
    document.getElementById("confirmLoginPwd").value = "";
  });
  document.getElementById("cancelChangeLoginPwd").addEventListener("click", () => changeLoginPwdModal.style.display = "none");

  document.getElementById("saveChangeLoginPwd").addEventListener("click", async () => {
    const currentPwd = document.getElementById("currentLoginPwd").value;
    const newPwd = document.getElementById("newLoginPwd").value;
    const confirmPwd = document.getElementById("confirmLoginPwd").value;

    if (!currentPwd || !newPwd || !confirmPwd) return alert("请输入完整信息");

    const { data: user, error } = await supabaseClient
      .from("users")
      .select("id, password")
      .eq("id", currentUser.id)
      .maybeSingle();
    if (error || !user) return alert("获取用户信息失败");
    if (user.password !== currentPwd) return alert("当前登录密码错误");
    if (newPwd.length < 6) return alert("新密码长度必须 ≥ 6");
    if (newPwd !== confirmPwd) return alert("两次输入的新密码不一致");

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ password: newPwd })
      .eq("id", currentUser.id);
    if (updateErr) return alert("修改失败：" + updateErr.message);

    currentUser.password = newPwd;
    alert("登录密码修改成功！");
    changeLoginPwdModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) e.target.style.display = "none";
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
  });
});

async function loadUserInfo(username) {
  if (!username) return;
  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, username, platform_account, balance, withdraw_password, password")
      .eq("username", username)
      .single();
    if (error || !data) throw new Error(error?.message || "用户不存在");

    currentUser = data;
    document.getElementById("username").textContent = data.username || "未知";
    document.getElementById("platformAccount").textContent = data.platform_account || "未知";
    document.getElementById("balance").textContent = (Number(data.balance) || 0).toFixed(2);
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
    document.getElementById("platformAccount").textContent = "错误";
    document.getElementById("balance").textContent = "错误";
  }
}
