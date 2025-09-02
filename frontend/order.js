/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // 兑换中的并发保护（Balance -> Coins）

/* ======================
   小工具
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  const mb = document.getElementById("coins");
  if (ob) ob.textContent = coins.toFixed(2);
  if (mb) mb.textContent = coins.toFixed(2);

  if (coins < 0) {
    setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}），请先充值`);
  } else if (coins < 50) {
    setOrderBtnDisabled(true, "至少需要 50 Coins 才能刷单");
  } else {
    setOrderBtnDisabled(false);
  }
}

async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
}

/* ======================
   附加规则：存在待充值订单时也要锁定下单按钮
   ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend, error } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (error) return;

  if (pend && pend.length > 0) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成该订单");
  } else {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    updateCoinsUI(user?.coins ?? 0);
  }
}

/* ======================
   加载金币与余额（并套用 pending 锁）
   ====================== */
async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
    .single();

  if (!error && data) {
    updateCoinsUI(data.coins);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = (Number(data.balance) || 0).toFixed(2);
    await checkPendingLock();
  }
}

/* ======================
   获取随机产品
   ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*");
  if (error || !products || products.length === 0) {
    throw new Error("产品列表为空或读取失败！");
  }
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   随机下单逻辑（最少 50 Coins 限制）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 有未完成订单禁止下单
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成的订单，请先完成该订单再继续下单。");
      await checkPendingLock();
      return;
    }

    // 校验 Coins
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();

    const userCoins = Number(user?.coins) || 0;
    if (userCoins < 50) {
      alert("⚠️ 您的 Coins 不足，至少需要 50 Coins 才能刷单！");
      return;
    }

    // 获取商品并下单
    const product = await getRandomProduct();
    const price = Number(product.price) || 0;
    const profit = +(price * 0.1).toFixed(2);

    const tempCoins = userCoins - price;
    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", window.currentUserId);

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    if (tempCoins < 0) {
      alert(`⚠️ 金币不足，本次下单已进入欠款状态（余额：¥${tempCoins.toFixed(2)}），请充值后完成订单！`);
    }

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    await loadCoinsOrderPage();
  }
}

/* ======================
   其他函数（完成订单 / 充值 / 兑换等）
   ====================== */
// 保持你之前写的 completeOrder / rechargeCoins / confirmExchange 等逻辑
// 不用改，只要在 autoOrder 加了 coins >= 50 限制即可

/* ======================
   页面初始化 & 事件绑定
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("rechargeBtn")?.addEventListener("click", rechargeCoins);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelAddCoins")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmAddCoins")?.addEventListener("click", confirmExchange);

  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addCoinsModal") closeExchangeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExchangeModal();
  });

  refreshAll();
});
