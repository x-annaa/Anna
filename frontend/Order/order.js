/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;
let completing = false;

if (!window.supabaseClient) console.error("❌ supabaseClient 未初始化！");

/* ======================
   工具函数
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
  if (ob) ob.textContent = coins.toFixed(2);

  if (coins < 0) setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
  else setOrderBtnDisabled(false);
}

/* ======================
   获取用户规则产品
   ====================== */
async function getUserRuleProduct(userId, orderNumber) {
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_id", userId)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);
  if (error) { console.error(error); return null; }
  return rules?.[0]?.product_id || null;
}

/* ======================
   获取随机产品
   ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);
  if (error || !products?.length) throw new Error("产品列表为空或读取失败！");
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   检查冷冻倒计时
   ====================== */
async function checkOrderCooldown() {
  if (!window.currentUserId) return false;

  const { data: user, error } = await supabaseClient
    .from("users")
    .select("order_freeze_until")
    .eq("id", window.currentUserId)
    .single();
  if (error || !user) return false;

  const cooldownEl = document.getElementById("orderCooldown");
  if (!cooldownEl) return false;

  const freezeUntil = user?.order_freeze_until ? new Date(user.order_freeze_until + 'Z') : null;
  const now = new Date();

  if (freezeUntil && freezeUntil > now) {
    const diffMs = freezeUntil - now;
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    cooldownEl.textContent = `订单冷冻中：${minutes}分${seconds}秒`;
    setOrderBtnDisabled(true, "订单冷冻中");
    return true;
  } else {
    // 冻结结束，清空数据库字段
    if (freezeUntil) {
      await supabaseClient.from("users").update({ order_freeze_until: null }).eq("id", window.currentUserId);
    }
    cooldownEl.textContent = "";
    setOrderBtnDisabled(false);
    return false;
  }
}

// 每秒刷新倒计时
setInterval(checkOrderCooldown, 1000);

/* ======================
   渲染最近订单
   ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profitRatio = Number(order.products?.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：${profitRatio}</p>
    <p>收入：+¥${(price * profitRatio).toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending" && coins >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (coins < 0) html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;

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
   完成订单
   ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

    const currentCoins = Number(currentCoinsRaw || 0);
    const finalCoins = currentCoins + Number(order.total_price || 0) + Number(order.profit || 0);

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
   自动下单（修改版：刷10单冻结1分钟）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;

  try {
    // 获取用户信息
    const { data: user, error: userErr } = await supabaseClient
      .from("users")
      .select("coins,order_freeze_until,order_freeze_minutes")
      .eq("id", window.currentUserId)
      .single();
    if (userErr || !user) throw new Error("获取用户信息失败");

    const coins = Number(user.coins || 0);
    const freezeMinutes = Number(user.order_freeze_minutes || 1);
    const freezeUntil = user.order_freeze_until ? new Date(user.order_freeze_until + 'Z') : null;
    const now = new Date();

    // 检查冻结状态
    if (freezeUntil && freezeUntil > now) {
      const diffMs = freezeUntil - now;
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      alert(`订单冷冻中：${minutes}分${seconds}秒`);
      ordering = false;
      return;
    } else if (freezeUntil && freezeUntil <= now) {
      // 冻结结束，清空字段
      await supabaseClient.from("users").update({ order_freeze_until: null }).eq("id", window.currentUserId);
    }

    if (coins < 50) { alert("余额不足 50 coins"); setOrderBtnDisabled(false); ordering = false; return; }

    // 获取最近订单数量（只统计最近10单）
    const { data: lastOrders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(10);

    // 如果累计10单，触发冻结
    if ((lastOrders?.length || 0) >= 10) {
      const freezeDate = new Date(Date.now() + freezeMinutes * 60 * 1000);
      await supabaseClient.from("users").update({ order_freeze_until: freezeDate.toISOString() }).eq("id", window.currentUserId);
      alert(`连续刷单达到10单，冷冻倒计时 ${freezeMinutes} 分钟`);
      ordering = false;
      return;
    }

    // 检查 pending 订单
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) { alert("您有未完成订单，请先完成订单再继续下单。"); await checkPendingLock(); ordering = false; return; }

    // 生成订单号
    const { data: orders } = await supabaseClient.from("orders").select("id").eq("user_id", window.currentUserId);
    const orderNumber = (orders?.length || 0) + 1;

    // 获取规则产品或随机产品
    let product;
    const ruleProductId = await getUserRuleProduct(window.currentUserId, orderNumber);
    if (ruleProductId) {
      const { data: pData, error } = await supabaseClient.from("products").select("*").eq("id", ruleProductId).single();
      if (!error && pData) product = pData;
    }
    if (!product) product = await getRandomProduct();

    const price = Number(product.price || 0);
    const profit = +(price * Number(product.profit || 0)).toFixed(2);
    const tempCoins = coins - price;

    // 扣除金币
    await supabaseClient.from("users").update({ coins: tempCoins }).eq("id", window.currentUserId);

    // 创建订单
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({ user_id: window.currentUserId, product_id: product.id, total_price: price, profit, status: "pending" })
      .select(`id,total_price,profit,status,created_at,products(name,profit)`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   最近订单
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;
  try {
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select(`id,total_price,profit,status,created_at,products(name,profit)`)
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);

    const historyTitle = document.querySelector(".order-history h3");
    if (historyTitle) historyTitle.textContent = `🕘 最近订单 订单数：${totalCount || 0}单`;

    const list = document.getElementById("recentOrders");
    if (list) {
      if (!recentOrders?.length) list.innerHTML = `<li>暂无订单！</li>`;
      else list.innerHTML = recentOrders.map(o => `
        <li>🛒 ${o.products?.name || "未知商品"} /
        ¥${Number(o.total_price || 0).toFixed(2)} /
        利润：${Number(o.products?.profit || 0)} /
        状态：${o.status === "completed" ? "已完成" : "待完成"} /
        <small>${new Date(o.created_at).toLocaleString()}</small></li>`).join("");
    }
  } catch (e) { console.error(e); }
}

/* ======================
   检查 pending 订单锁定按钮
   ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;
  const { data: pend } = await supabaseClient.from("orders")
    .select("id").eq("user_id", window.currentUserId).eq("status","pending").limit(1);
  setOrderBtnDisabled(!!pend?.length, pend?.length ? "存在未完成订单，请先完成订单" : "");
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  refreshAll();
});

async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
}

async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient.from("users").select("coins,balance").eq("id", window.currentUserId).single();
  if (!error && data) { updateCoinsUI(data.coins); await checkPendingLock(); }
}

async function loadLastOrder() {
  if (!window.currentUserId) return;
  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id,total_price,profit,status,created_at,products(name,profit)`)
    .eq("user_id", window.currentUserId)
    .order("created_at",{ascending:false}).limit(1);

  const { data: user } = await supabaseClient.from("users").select("coins").eq("id", window.currentUserId).single();
  if (orders?.length) renderLastOrder(orders[0], user?.coins || 0);
  else document.getElementById("orderResult").innerHTML = "";
}
