/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护

/* ======================
   工具：更新按钮状态
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
}

/* ======================
   更新余额 UI
   ====================== */
function updateBalanceUI(balanceRaw) {
  const balance = Number(balanceRaw) || 0;
  const ob = document.getElementById("orderBalance");
  const mb = document.getElementById("balance");
  if (ob) ob.textContent = balance.toFixed(2);
  if (mb) mb.textContent = balance.toFixed(2);

  if (balance < 0) {
    setOrderBtnDisabled(true, `余额为负（欠款 ¥${Math.abs(balance).toFixed(2)}），请先充值`);
  }
}

/* ======================
   附加规则：待充值锁定
   ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (pend && pend.length > 0) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成该订单");
  }
}

/* ======================
   每日下单次数限制
   ====================== */
async function checkDailyLimit() {
  if (!window.currentUserId) return;

  // 取用户的 daily_limit
  const { data: user } = await supabaseClient
    .from("users")
    .select("daily_limit")
    .eq("id", window.currentUserId)
    .single();

  const limit = user?.daily_limit ?? 0;
  if (limit <= 0) return; // 没有配置限制就跳过

  // 取今天的已下单数量
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  const { count } = await supabaseClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", window.currentUserId)
    .gte("created_at", start)
    .lt("created_at", end);

  if (count >= limit) {
    setOrderBtnDisabled(true, `今日下单已达上限（${limit} 单）`);
  }
}

/* ======================
   加载余额 + 限制
   ====================== */
async function loadBalanceOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", window.currentUserId)
    .single();

  if (!error && data) {
    updateBalanceUI(data.balance);
    await checkPendingLock();
    await checkDailyLimit(); // 加入每日限制检查
  }
}

/* ======================
   其他部分：保持和你原来的一样
   ====================== */
// ...（getRandomProduct、renderLastOrder、loadLastOrder、completeOrder、autoOrder、loadRecentOrders、rechargeBalance 保持不变）

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("rechargeBtn")?.addEventListener("click", rechargeBalance);

  // 初次加载
  loadBalanceOrderPage();
  loadLastOrder();
  loadRecentOrders();
});
