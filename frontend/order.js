// home.js / order.js 公用逻辑

// 更新 Coins 和 Balance UI
function updateBalanceUI(coinsRaw, balanceRaw) {
  const coins = Number(coinsRaw) || 0;
  const balance = Number(balanceRaw) || 0;

  // 我的页面
  const myCoins = document.getElementById("coins");
  const myBalance = document.getElementById("balance");

  // 订单页面
  const orderCoins = document.getElementById("orderCoins");
  const orderBalance = document.getElementById("orderBalance");

  if (myCoins) myCoins.textContent = coins.toFixed(2);
  if (myBalance) myBalance.textContent = balance.toFixed(2);
  if (orderCoins) orderCoins.textContent = coins.toFixed(2);
  if (orderBalance) orderBalance.textContent = balance.toFixed(2);

  // 按钮控制逻辑：coins 不可为负
  if (coins < 0) {
    setOrderBtnDisabled(true, `金币不足（欠 ${Math.abs(coins).toFixed(2)}），请先充值`);
  } else {
    setOrderBtnDisabled(false);
  }
}

// 加载用户 Coins 和 Balance
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
    .single();

  if (!error && data) {
    updateBalanceUI(data.coins, data.balance);
    await checkPendingLock();
  }
}

// 一键刷单（示例）
async function autoOrder() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
    .single();

  if (error || !data) return;

  let newCoins = (data.coins || 0) - 10; // 扣除 10 Coins
  let newBalance = (data.balance || 0) + 5; // Balance 增加 5（示例逻辑）

  const { error: updateError } = await supabaseClient
    .from("users")
    .update({ coins: newCoins, balance: newBalance })
    .eq("id", window.currentUserId);

  if (!updateError) {
    updateBalanceUI(newCoins, newBalance);
    document.getElementById("orderResult").textContent =
      `下单成功！消耗 10 Coins，奖励 5 Balance`;
  }
}

// 充值（示例）
async function recharge(amount = 100) {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
    .single();

  if (error || !data) return;

  let newCoins = (data.coins || 0) + amount;
  let newBalance = data.balance || 0;

  const { error: updateError } = await supabaseClient
    .from("users")
    .update({ coins: newCoins, balance: newBalance })
    .eq("id", window.currentUserId);

  if (!updateError) {
    updateBalanceUI(newCoins, newBalance);
    alert(`充值成功 +${amount} Coins`);
  }
}

// 禁用/启用刷单按钮
function setOrderBtnDisabled(disabled, msg = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.textContent = disabled ? msg : "🎲 一键刷单";
  }
}

// 事件绑定
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("rechargeBtn")?.addEventListener("click", () => recharge(100));

  loadBalanceOrderPage();
});
