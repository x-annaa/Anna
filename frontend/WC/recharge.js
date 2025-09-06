// 元素
const withdrawBtn = document.getElementById("withdrawBtn");
const withdrawModal = document.getElementById("withdrawModal");
const cancelWithdraw = document.getElementById("cancelWithdraw");
const confirmWithdraw = document.getElementById("confirmWithdraw");
const withdrawAmount = document.getElementById("withdrawAmount");

const addWithdrawPwd = document.getElementById("addWithdrawPwd");
const setPwdModal = document.getElementById("setPwdModal");
const cancelSetPwd = document.getElementById("cancelSetPwd");
const saveSetPwd = document.getElementById("saveSetPwd");
const newWithdrawPwd = document.getElementById("newWithdrawPwd");
const confirmWithdrawPwd = document.getElementById("confirmWithdrawPwd");

const checkPwdModal = document.getElementById("checkPwdModal");
const cancelCheckPwd = document.getElementById("cancelCheckPwd");
const confirmCheckPwd = document.getElementById("confirmCheckPwd");
const inputWithdrawPwd = document.getElementById("inputWithdrawPwd");

let hasWithdrawPwd = false; // 从数据库加载
let withdrawAmountValue = 0;

// ======================
// 1. 打开提现窗口
// ======================
withdrawBtn.addEventListener("click", () => {
  withdrawModal.style.display = "flex";
});

// ======================
// 2. 设置提现密码
// ======================
addWithdrawPwd.addEventListener("click", (e) => {
  e.preventDefault();
  withdrawModal.style.display = "none";
  setPwdModal.style.display = "flex";
});

cancelSetPwd.addEventListener("click", () => {
  setPwdModal.style.display = "none";
});

saveSetPwd.addEventListener("click", async () => {
  const pwd1 = newWithdrawPwd.value.trim();
  const pwd2 = confirmWithdrawPwd.value.trim();

  if (!pwd1 || pwd1 !== pwd2) {
    alert("两次输入的密码不一致！");
    return;
  }

  // 存到数据库 (简单存明文，推荐存 hash)
  const { error } = await supabaseClient
    .from("users")
    .update({ withdraw_password: pwd1 })
    .eq("id", window.currentUserId);

  if (error) {
    alert("设置提现密码失败：" + error.message);
    return;
  }

  hasWithdrawPwd = true;
  alert("提现密码设置成功！");
  setPwdModal.style.display = "none";
});

// ======================
// 3. 提交提现
// ======================
confirmWithdraw.addEventListener("click", async () => {
  withdrawAmountValue = parseFloat(withdrawAmount.value);

  if (!withdrawAmountValue || withdrawAmountValue <= 0) {
    alert("请输入有效的提现金额！");
    return;
  }

  if (hasWithdrawPwd) {
    withdrawModal.style.display = "none";
    checkPwdModal.style.display = "flex";
  } else {
    await submitWithdraw(null);
  }
});

// ======================
// 4. 输入提现密码确认
// ======================
cancelCheckPwd.addEventListener("click", () => {
  checkPwdModal.style.display = "none";
});

confirmCheckPwd.addEventListener("click", async () => {
  const pwd = inputWithdrawPwd.value.trim();

  // 校验密码
  const { data, error } = await supabaseClient
    .from("users")
    .select("withdraw_password, balance")
    .eq("id", window.currentUserId)
    .single();

  if (error || !data) {
    alert("查询用户失败！");
    return;
  }

  if (pwd !== data.withdraw_password) {
    alert("提现密码错误！");
    return;
  }

  await submitWithdraw(pwd);
});

// ======================
// 5. 提交提现到数据库
// ======================
async function submitWithdraw(password) {
  // 扣减余额 + 写提现记录
  const { error } = await supabaseClient
    .from("withdrawals")
    .insert({
      user_id: window.currentUserId,
      amount: withdrawAmountValue,
      status: "pending", // 等后台审核
      created_at: new Date().toISOString(),
    });

  if (error) {
    alert("提现申请失败：" + error.message);
    return;
  }

  // 扣除余额（只是前端演示，后台要二次校验！）
  await supabaseClient
    .from("users")
    .update({ balance: supabaseClient.rpc('decrement_balance', { uid: window.currentUserId, amt: withdrawAmountValue }) })
    .eq("id", window.currentUserId);

  alert("提现申请已提交，等待审核！");
  checkPwdModal.style.display = "none";
  withdrawModal.style.display = "none";
}
