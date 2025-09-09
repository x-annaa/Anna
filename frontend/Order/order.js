/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Balance -> Coins 兑换中的并发保护
let countdownTimer = null; // 倒计时定时器

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ======================
   工具函数
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    if (!disabled) btn.textContent = "🎲 一键刷单";
    else if (reason) btn.textContent = `🎲 一键刷单（${reason}）`;
    else btn.textContent = "🎲 一键刷单（不可用）";
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
   获取规则（优先用户手动，否则全局）
   ====================== */
async function getEffectiveRule(userId, orderNumber) {
  // 1. 尝试查用户手动规则
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id, max_orders, period_minutes")
    .eq("user_id", userId)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);

  if (!error && rules?.length) {
    return {
      productId: rules[0].product_id,
      maxOrders: Number(rules[0].max_orders || 2),
      periodMinutes: Number(rules[0].period_minutes || 2),
      source: "user"   // 手动规则
    };
  }

  // 2. 否则查全局规则
  try {
    const { data: rule } = await supabaseClient
      .from("user_product_rules")
      .select("max_orders, period_minutes")
      .eq("enabled", true)
      .limit(1)
      .single();

    return {
      productId: null,
      maxOrders: Number(rule?.max_orders || 2),
      periodMinutes: Number(rule?.period_minutes || 2),
      source: "global"  // 全局规则
    };
  } catch (e) {
    console.error("读取全局规则失败，使用默认值", e);
    return { productId: null, maxOrders: 2, periodMinutes: 2, source: "default" };
  }
}


/* ======================
   检查下单限制（倒计时） 
   ====================== */
async function canPlaceOrder(userId, maxOrders, periodMinutes) {
  if (!userId) return false;
  clearInterval(countdownTimer);

  const periodSeconds = (periodMinutes || 1) * 60;

  try {
    const { data: recentOrders, error } = await supabaseClient
      .from("orders")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(maxOrders);

    if (error) { 
      console.error("获取最近订单失败", error); 
      return false; 
    }

    if (!recentOrders || recentOrders.length < maxOrders) return true;

    const oldestTime = new Date(recentOrders[recentOrders.length - 1].created_at);
    const now = new Date();
    let diff = (now - oldestTime) / 1000; // 秒

    if (diff < periodSeconds) {
      const btn = document.getElementById("autoOrderBtn");
      setOrderBtnDisabled(true, `最近 ${maxOrders} 单限制`);

      countdownTimer = setInterval(() => {
        diff += 1;
        const left = Math.max(0, Math.ceil(periodSeconds - diff));
        if (btn) btn.textContent = `🎲 一键刷单（请等待 ${left}s）`;
        if (diff >= periodSeconds) {
          clearInterval(countdownTimer);
          setOrderBtnDisabled(false);
        }
      }, 1000);

      return false;
    }
    return true;
  } catch (e) {
    console.error("检查下单限制失败", e);
    return false;
  }
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
  if (error || !products || products.length === 0) throw new Error("产品列表为空或读取失败！");
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

  if (order.status === "pending" && coins >= 0) html += `<button id="completeOrderBtn">完成订单</button>`;
  if (coins < 0) html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) compBtn.addEventListener("click", async () => {
    compBtn.disabled = true;
    await completeOrder(order, coins);
  });
}

/* ======================
   完成订单
   ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

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
   检查 pending 订单锁定按钮
   ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  else setOrderBtnDisabled(false);
}

/* ======================
   自动下单（支持手动规则 + 全局规则）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { 
    alert("请先登录！"); 
    return; 
  }
  if (ordering) return;

  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 1. 查用户余额
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);

    if (coins < 50) {
      showModal(`<p>你的余额不足，最少需要 50 coins</p>`);
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    // 2. 计算当前订单号（已有订单数+1）
    const { count: orderCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);
    const orderNumber = (orderCount || 0) + 1;

    // 3. 获取规则（优先用户手动，否则全局）
    const rule = await getEffectiveRule(window.currentUserId, orderNumber);
    const maxOrders = rule.maxOrders;
    const periodMinutes = rule.periodMinutes;

    // 4. 检查倒计时限制
    const canOrderNow = await canPlaceOrder(window.currentUserId, maxOrders, periodMinutes);
    if (!canOrderNow) { ordering = false; return; }

    // 5. 检查是否有 pending
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成订单，请先完成订单再继续下单。");
      await checkPendingLock();
      ordering = false;
      return;
    }

    // 6. 确定商品（手动规则指定 productId 优先，否则随机）
    let product;
    if (rule.productId) {
      const { data: pData, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", rule.productId)
        .single();
      if (!error && pData) product = pData;
    }
    if (!product) {
      product = await getRandomProduct();
    }

    // 7. 价格/利润计算
    const price = Number(product.price) || 0;
    const profitRatio = Number(product.profit) || 0;
    const profit = +(price * profitRatio).toFixed(2);
    const tempCoins = coins - price;

    // 8. 扣 coins
    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", window.currentUserId);

    // 9. 插入订单
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    // 10. 更新前端
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeExchangeModal(); });

  refreshAll();
});

/* ======================
   页面刷新工具 & Coins
   ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
}

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

async function loadLastOrder() {
  if (!window.currentUserId) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
  else document.getElementById("orderResult").innerHTML = "";
}

/* ======================
   Coins 弹窗
   ====================== */
function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  const input = document.getElementById("addCoinsInput");
  if (modal) { modal.style.display = "flex"; if (input) { input.value = ""; setTimeout(() => input.focus(), 50); } }
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
  if (!window.currentUserId) { alert("请先登录！"); exchanging = false; return; }

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", window.currentUserId)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    const coins = Number(user.coins) || 0;
    const balance = Number(user.balance) || 0;
    if (balance < amount) { alert(`余额不足，当前 Balance：¥${balance.toFixed(2)}`); return; }

    const newCoins = coins + amount;
    const newBalance = balance - amount;

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance })
      .eq("id", window.currentUserId);
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
