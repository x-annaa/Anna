/* ======================
   初始化用户
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;
let completing = false;

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
   更新 coins + balance2 UI
   ====================== */
function updateCoinsUI(coinsRaw, balance2Raw) {
  const coins = Number(coinsRaw) || 0;
  const balance2 = Number(balance2Raw) || 0;

  const oc = document.getElementById("orderCoins");
  const ob2 = document.getElementById("orderBalance2");
  const mc = document.getElementById("coins");
  const mb2 = document.getElementById("balance2");

  if (oc) oc.textContent = coins.toFixed(2);
  if (ob2) ob2.textContent = balance2.toFixed(2);
  if (mc) mc.textContent = coins.toFixed(2);
  if (mb2) mb2.textContent = balance2.toFixed(2);

  if (coins < 0) {
    setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}），请先充值`);
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ======================
   附加规则：pending 锁定
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
   加载 coins & balance2
   ====================== */
async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance2")
    .eq("id", window.currentUserId)
    .single();

  if (!error && data) {
    updateCoinsUI(data.coins, data.balance2);
    await checkPendingLock();
  }
}

/* ======================
   随机产品
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
function renderLastOrder(order, coinsRaw, balance2Raw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw) || 0;
  const balance2 = Number(balance2Raw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：<span style="color:green;">+¥${profit.toFixed(2)}</span></p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待充值"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)} / 余额2：¥${balance2.toFixed(2)}</p>
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
      compBtn.remove();
      await completeOrder(order, coins, balance2);
    });
  }
}

/* ======================
   加载最近订单
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
    .select("coins, balance2")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) {
    renderLastOrder(orders[0], user?.coins ?? 0, user?.balance2 ?? 0);
  }
}

/* ======================
   完成订单
   ====================== */
async function completeOrder(order, currentCoinsRaw, currentBalance2Raw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") {
      await loadCoinsOrderPage();
      await loadLastOrder();
      await loadRecentOrders();
      return;
    }

    const coins = Number(currentCoinsRaw) || 0;
    const balance2 = Number(currentBalance2Raw) || 0;
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalCoins = coins + price + profit;
    const finalBalance2 = balance2;

    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    const { error: balErr } = await supabaseClient
      .from("users")
      .update({ coins: finalCoins, balance2: finalBalance2 })
      .eq("id", window.currentUserId);
    if (balErr) throw new Error(balErr.message);

    renderLastOrder({ ...order, status: "completed" }, finalCoins, finalBalance2);
    updateCoinsUI(finalCoins, finalBalance2);
    await checkPendingLock();
    await loadRecentOrders();
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   自动下单
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
      .select("coins, balance2")
      .eq("id", window.currentUserId)
      .single();
    const product = await getRandomProduct();

    const price = Number(product.price) || 0;
    const profit = +(price * 0.1).toFixed(2);

    const tempCoins = (Number(user.coins) || 0) - price;
    const tempBalance2 = Number(user.balance2) || 0;

    await supabaseClient
      .from("users")
      .update({ coins: tempCoins, balance2: tempBalance2 })
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
      alert(`⚠️ 金币不足，本次下单已进入欠款状态（金币：¥${tempCoins.toFixed(2)}），请充值后完成订单！`);
    }

    renderLastOrder(newOrder, tempCoins, tempBalance2);
    updateCoinsUI(tempCoins, tempBalance2);
    await checkPendingLock();
    await loadRecentOrders();
  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   最近 5 笔订单
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
    .select("coins, balance2")
    .eq("id", window.currentUserId)
    .single();

  const newCoins = (Number(user.coins) || 0) + amount;
  const newBalance2 = (Number(user.balance2) || 0) + amount;

  await supabaseClient
    .from("users")
    .update({ coins: newCoins, balance2: newBalance2 })
    .eq("id", window.currentUserId);

  alert(`充值成功 ¥${amount.toFixed(2)}`);
  updateCoinsUI(newCoins, newBalance2);

  const { data: pending } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name )`)
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  if (pending?.length && newCoins >= 0) {
    await completeOrder(pending[0], newCoins, newBalance2);
  } else {
    await loadLastOrder();
    await checkPendingLock();
  }

  await loadRecentOrders();
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("rechargeBtn")?.addEventListener("click", rechargeCoins);

  loadCoinsOrderPage();
  loadLastOrder();
  loadRecentOrders();
});
