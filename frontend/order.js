/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // 兑换中的并发保护（Balance -> Coins）

// 确认 Supabase 已加载
if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化，请检查 supabaseClient.js 是否正确加载！");
}

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
   附加规则：存在待充值订单时锁定下单按钮
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
    setOrderBtnDisabled(false);
  }
}

/* ======================
   加载金币与余额
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
   渲染最近订单
   ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：<span style="color:green;">+¥${profit.toFixed(2)}</span></p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待充值"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending" && coins >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (coins < 0) {
    html += `<p style="color:red;">⚠️ 您的金币已为负，欠款 ¥${Math.abs(coins).toFixed(2)}，请先充值。</p>`;
  }

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    });
  }
}

/* ======================
   加载最近 1 单
   ====================== */
async function loadLastOrder() {
  if (!window.currentUserId) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) {
    renderLastOrder(orders[0], user?.coins ?? 0);
  } else {
    const el = document.getElementById("orderResult");
    if (el) el.innerHTML = "";
  }
}

/* ======================
   完成订单
   ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") {
      await refreshAll();
      return;
    }

    const currentCoins = Number(currentCoinsRaw) || 0;
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalCoins = currentCoins + price + profit;

    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    const { error: coinErr } = await supabaseClient
      .from("users")
      .update({ coins: finalCoins })
      .eq("id", window.currentUserId);
    if (coinErr) throw new Error(coinErr.message);

    renderLastOrder({ ...order, status: "completed" }, finalCoins);
    updateCoinsUI(finalCoins);
    await checkPendingLock();
    await loadRecentOrders();
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   随机下单逻辑
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
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

    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const product = await getRandomProduct();

    const price = Number(product.price) || 0;
    const profit = +(price * 0.1).toFixed(2);

    const tempCoins = (Number(user.coins) || 0) - price;
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
   最近 5 笔订单历史
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;
  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = document.getElementById("recentOrders");
  if (list) {
    list.innerHTML = (orders || []).map(o => {
      const price = Number(o.total_price) || 0;
      const profit = Number(o.profit) || 0;
      return `
        <li>
          🛒 ${o.products?.name || "未知商品"} /
          ¥${price.toFixed(2)} /
          利润 +¥${profit.toFixed(2)} /
          状态：${o.status === "completed" ? "已完成" : "待充值"} /
          <small>${new Date(o.created_at).toLocaleString()}</small>
        </li>`;
    }).join("");
  }
}

/* ======================
   充值功能
   ====================== */
async function rechargeCoins() {
  const amount = parseFloat(prompt("充值金额", "0"));
  if (isNaN(amount) || amount <= 0) { alert("金额无效"); return; }

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();

  const newCoins = (Number(user?.coins) || 0) + amount;

  const { error: updErr } = await supabaseClient
    .from("users")
    .update({ coins: newCoins })
    .eq("id", window.currentUserId);
  if (updErr) {
    alert("充值失败：" + updErr.message);
    return;
  }

  alert(`充值成功 ¥${amount.toFixed(2)}`);
  updateCoinsUI(newCoins);

  const { data: pending } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (pending?.length && newCoins >= 0) {
    await completeOrder(pending[0], newCoins);
  } else {
    await checkPendingLock();
    await loadLastOrder();
  }

  await loadRecentOrders();
}

/* ======================
   从 Balance 转 Coins
   ====================== */
async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  const inputEl = document.getElementById("addCoinsInput");
  const confirmBtn = document.getElementById("confirmAddCoins");
  const amount = parseFloat(inputEl?.value || "0");

  if (isNaN(amount) || amount <= 0) {
    alert("输入无效");
    exchanging = false;
    return;
  }

  if (!window.currentUserId) { alert("请先登录！"); exchanging = false; return; }

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", window.currentUserId)
      .single();

    if (error || !user) {
      throw new Error("加载用户信息失败");
    }

    const coins = Number(user.coins) || 0;
    const balance = Number(user.balance) || 0;

    if (balance < amount) {
      alert(`❌ 余额不足，当前 Balance：¥${balance.toFixed(2)}`);
      return;
    }

    const newCoins = coins + amount;
    const newBalance = balance - amount;

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance })
      .eq("id", window.currentUserId);

    if (updateErr) throw new Error("兑换失败：" + updateErr.message);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} Coins`);

    document.getElementById("ordercoins").textContent = newCoins.toFixed(2);
    document.getElementById("coins").textContent = newCoins.toFixed(2);
    document.getElementById("balance").textContent = newBalance.toFixed(2);

    updateCoinsUI(newCoins);
    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();

    closeExchangeModal();
  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  const input = document.getElementById("addCoinsInput");
  if (modal) {
    modal.style.display = "flex";
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 50);
    }
  }
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "none";
}

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
