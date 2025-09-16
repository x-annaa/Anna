/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId"); // UUID
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Balance -> Coins 兑换中的并发保护
let cooldownInterval = null; // 冷却倒计时 Interval

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ======================
   工具函数
   ====================== */
function normalizeUserId(id) {
  return id ? String(id) : null; // 确保 UUID 是字符串
}

function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? `🎲 一键刷单（不可用）` : "🎲 一键刷单";
  }
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);

  if (coins < 0) {
    setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ======================
   确保 order_limits 存在
   ====================== */
async function ensureOrderLimits(userId) {
  const uid = normalizeUserId(userId);
  if (!uid) return;

  const { data, error } = await supabaseClient
    .from("order_limits")
    .select("*")
    .eq("user_id", uid)
    .single();

  if (!data) {
    await supabaseClient
      .from("order_limits")
      .insert({
        user_id: uid,
        max_orders: 5,
        cooldown_seconds: 60,
        orders_completed: 0,
        last_reset: new Date().toISOString()
      });
  }
}

/* ======================
   获取用户规则产品
   ====================== */
async function getUserRuleProduct(userId, orderNumber) {
  const uid = normalizeUserId(userId);
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_id", uid)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);

  if (error) {
    console.error("读取手动规则失败", error);
    return null;
  }
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

  if (error || !products || products.length === 0) {
    throw new Error("产品列表为空或读取失败！");
  }
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   倒计时
   ====================== */
function startCooldownTimer(seconds) {
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;
  clearInterval(cooldownInterval);

  let remaining = seconds;
  btn.disabled = true;
  btn.textContent = `🎲 冷却中 ${remaining}s`;

  cooldownInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(cooldownInterval);
      btn.disabled = false;
      btn.textContent = "🎲 一键刷单";
    } else {
      btn.textContent = `🎲 冷却中 ${remaining}s`;
    }
  }, 1000);
}

/* ======================
   检查冷却
   ====================== */
async function checkOrderCooldown() {
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) return { allowed: true };
  await ensureOrderLimits(uid);

  const { data: limitData } = await supabaseClient
    .from("order_limits")
    .select("max_orders, cooldown_seconds, orders_completed, last_reset")
    .eq("user_id", uid)
    .single();

  if (!limitData) return { allowed: true };

  const { max_orders, cooldown_seconds, orders_completed, last_reset } = limitData;

  if (orders_completed >= max_orders) {
    const { data: serverTime } = await supabaseClient.rpc("get_server_time");
    const now = new Date(serverTime);
    const last = new Date(last_reset);
    const diff = (now - last) / 1000;

    if (diff < cooldown_seconds) {
      const remaining = Math.ceil(cooldown_seconds - diff);
      return { allowed: false, remaining, max_orders, cooldown_seconds };
    } else {
      await supabaseClient
        .from("order_limits")
        .update({ orders_completed: 0, last_reset: now.toISOString() })
        .eq("user_id", uid);
      return { allowed: true };
    }
  }
  return { allowed: true };
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
  const profitRatio = Number(order.products?.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：${profitRatio}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === "pending" && coins >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (coins < 0) {
    html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;
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
   完成订单
   ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

    const uid = normalizeUserId(window.currentUserId);
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
      .eq("id", uid);
    if (coinErr) throw new Error(coinErr.message);

    const { data: limitData } = await supabaseClient
      .from("order_limits")
      .select("orders_completed, max_orders, cooldown_seconds")
      .eq("user_id", uid)
      .single();

    if (limitData) {
      const newCount = (limitData.orders_completed || 0) + 1;
      await supabaseClient
        .from("order_limits")
        .update({ orders_completed: newCount, last_reset: new Date().toISOString() })
        .eq("user_id", uid);

      const cooldown = await checkOrderCooldown();
      if (!cooldown.allowed) {
        setOrderBtnDisabled(true, `已完成 ${limitData.max_orders} 单，请等待 ${cooldown.remaining} 秒`);
        startCooldownTimer(cooldown.remaining);
      } else {
        setOrderBtnDisabled(false);
      }
    }

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
   检查 pending
   ====================== */
async function checkPendingLock() {
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", uid)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  } else {
    const cooldown = await checkOrderCooldown();
    if (!cooldown.allowed) {
      setOrderBtnDisabled(true, `已完成 ${cooldown.max_orders} 单，请等待 ${cooldown.remaining} 秒`);
      startCooldownTimer(cooldown.remaining);
    } else {
      setOrderBtnDisabled(false);
    }
  }
}

/* ======================
   自动下单
   ====================== */
async function autoOrder() {
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) { alert("请先登录！"); return; }

  const cooldown = await checkOrderCooldown();
  if (!cooldown.allowed) {
    alert(`已完成 ${cooldown.max_orders} 单，请等待 ${cooldown.remaining} 秒`);
    setOrderBtnDisabled(true);
    startCooldownTimer(cooldown.remaining);
    return;
  }

  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", uid)
      .single();
    const coins = Number(user?.coins || 0);

    if (coins < 50) {
      showModal(`<p>你的余额不足，最少需要 50 coins</p>`);
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", uid)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成订单，请先完成订单再继续下单。");
      await checkPendingLock();
      ordering = false;
      return;
    }

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", uid);
    const orderNumber = (orders?.length || 0) + 1;

    let product;
    const ruleProductId = await getUserRuleProduct(uid, orderNumber);
    if (ruleProductId) {
      const { data: pData, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", ruleProductId)
        .single();
      if (!error && pData) product = pData;
    }
    if (!product) product = await getRandomProduct();

    const price = Number(product.price) || 0;
    const profitRatio = Number(product.profit) || 0;
    const profit = +(price * profitRatio).toFixed(2);
    const tempCoins = coins - price;

    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", uid);

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: uid,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
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
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) return;

  try {
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid);

    const historyTitle = document.querySelector(".order-history h3");
    if (historyTitle) {
      historyTitle.textContent = `🕘 最近订单 订单数：${totalCount || 0}单`;
    }

    const list = document.getElementById("recentOrders");
    if (list) {
      if (!recentOrders || recentOrders.length === 0) {
        list.innerHTML = `<li>暂无订单！</li>`;
      } else {
        list.innerHTML = recentOrders.map(o => {
          const price = Number(o.total_price) || 0;
          const profit = Number(o.profit) || 0;
          const profitRatio = Number(o.products?.profit) || 0;
          return `
            <li>
              🛒 ${o.products?.name || "未知商品"} /
              ¥${price.toFixed(2)} /
              利润：${profitRatio} /
              收入：+¥${profit.toFixed(2)} /
              状态：${o.status === "completed" ? "已完成" : "待完成"} /
              <small>${new Date(o.created_at).toLocaleString()}</small>
            </li>`;
        }).join("");
      }
    }
  } catch (e) {
    console.error("加载最近订单失败：", e);
  }
}

/* ======================
   Coins 弹窗
   ====================== */
function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  const input = document.getElementById("addCoinsInput");
  if (modal) {
    modal.style.display = "flex";
    if (input) { input.value = ""; setTimeout(() => input.focus(), 50); }
  }
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "none";
}

async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  const inputEl = document.getElementById("addCoinsInput");
  const confirmBtn = document.getElementById("confirmAddCoins");
  const amount = parseFloat(inputEl?.value || "0");

  if (isNaN(amount) || amount <= 0) { alert("输入无效"); exchanging = false; return; }
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) { alert("请先登录！"); exchanging = false; return; }

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", uid)
      .single();

    const coins = Number(user?.coins) || 0;
    const balance = Number(user?.balance) || 0;

    if (balance < amount) { alert(`余额不足，当前 Balance：¥${balance.toFixed(2)}`); return; }

    const newCoins = coins + amount;
    const newBalance = balance - amount;

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance })
      .eq("id", uid);
    if (updateErr) throw new Error("兑换失败：" + updateErr.message);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} Coins`);
    document.getElementById("ordercoins").textContent = newCoins.toFixed(2);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = newBalance.toFixed(2);

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

/* ======================
   页面刷新工具
   ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
}

async function loadCoinsOrderPage() {
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) return;
  const { data } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", uid)
    .single();
  if (data) {
    updateCoinsUI(data.coins);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = (Number(data.balance) || 0).toFixed(2);
    await checkPendingLock();
  }
}

async function loadLastOrder() {
  const uid = normalizeUserId(window.currentUserId);
  if (!uid) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", uid)
    .single();

  if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
  else document.getElementById("orderResult").innerHTML = "";
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
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
