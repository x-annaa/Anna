/* ====================== 初始化用户信息 ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID"); // 新增 UUID
window.currentRoundId = localStorage.getItem("currentRoundId");   // 当前轮次
window.roundStartTime = localStorage.getItem("roundStartTime");   // 当前轮次开始时间

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Balance-Coins兑换中的并发保护
let cooldownTimer = null;  // 冷却倒计时

// 默认轮次配置
window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION = 5 * 60 * 1000; // 毫秒

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ====================== 读取轮次配置 (每轮单数 & 冷却分钟) ====================== */
async function loadRoundConfig() {
  try {
    const { data, error } = await supabaseClient
      .from("round_config")
      .select("orders_per_round, round_duration, match_min_seconds, match_max_seconds")
      .limit(1)
      .single();

    if (error) throw error;

    const cfg = data || {};
    window.RoundConfig.ordersPerRound = Number(cfg.orders_per_round) || 3;
    window.RoundConfig.roundDurationMinutes = Number(cfg.round_duration) || 5;
    window.RoundConfig.roundDurationMs = window.RoundConfig.roundDurationMinutes * 60 * 1000;
    window.RoundConfig.matchMinSec = Number(cfg.match_min_seconds) || 5;
    window.RoundConfig.matchMaxSec = Number(cfg.match_max_seconds) || 15;

    console.log("✅ 轮次配置已加载", window.RoundConfig);

  } catch (e) {
    console.warn("❌ 读取轮次配置失败，使用默认值", e.message);
    window.RoundConfig.ordersPerRound = 3;
    window.RoundConfig.roundDurationMinutes = 5;
    window.RoundConfig.roundDurationMs = 5 * 60 * 1000;
    window.RoundConfig.matchMinSec = 5;
    window.RoundConfig.matchMaxSec = 15;
  }
}

/* ====================== 工具函数 ====================== */
function updateOrderButtonState({ disabled = false, text = "🎲 一键刷单", title = "" } = {}) {
  const btn = document.getElementById("autoOrderBtn");
  if (!btn) return;
  btn.disabled = disabled;
  btn.textContent = text;
  btn.title = title;
}

function updateCooldownDisplay(text = "") {
  const cdEl = document.getElementById("cooldownDisplay");
  if (cdEl) cdEl.textContent = text;
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);

  if (coins < 0) {
    updateOrderButtonState({
      disabled: true,
      text: "🎲 一键刷单（不可用）",
      title: `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`
    });
  } else {
    updateOrderButtonState({ disabled: false });
  }
}

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function isRoundExpired(roundStartTime = window.roundStartTime) {
  if (!roundStartTime) return true;
  return (Date.now() - Number(roundStartTime)) > window.RoundConfig.roundDurationMs;
}

function startNewRound() {
  const uuid = crypto.randomUUID();
  window.currentRoundId = uuid;
  window.roundStartTime = Date.now();
  localStorage.setItem("currentRoundId", uuid);
  localStorage.setItem("roundStartTime", window.roundStartTime);
}

/* ====================== 获取用户规则产品 & 随机产品 ====================== */
/**
 * 获取用户手动规则产品（如果存在）
 * @param {string|number} userId
 * @param {number} orderNumber
 * @returns {object|null} 产品对象 或 null
 */
async function getUserRuleProduct(userId, orderNumber) {
  try {
    const { data: rules, error } = await supabaseClient
      .from("user_product_rules")
      .select("product_id")
      .eq("user_id", userId)
      .eq("order_number", orderNumber)
      .eq("enabled", true)
      .limit(1);

    if (error) throw error;
    if (!rules?.length) return null;

    const productId = rules[0].product_id;
    const { data: product, error: pErr } = await supabaseClient
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (pErr || !product) return null;
    return product;

  } catch (e) {
    console.error("读取手动规则产品失败:", e);
    return null;
  }
}

/**
 * 获取随机产品
 * @returns {object} 产品对象
 */
async function getRandomProduct() {
  try {
    const { data: products, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("enabled", true)
      .eq("manual_only", false);

    if (error) throw error;
    if (!products?.length) throw new Error("产品列表为空！");

    return products[Math.floor(Math.random() * products.length)];
  } catch (e) {
    console.error("获取随机产品失败:", e);
    throw e;
  }
}

/* ====================== 检查订单冷却状态 ====================== */
/**
 * 检查用户是否处于下单冷却
 * @param {string} userUUID 用户 UUID
 * @returns {Promise<{allowed: boolean, next_allowed: string|null}>}
 */
async function checkOrderCooldown(userUUID) {
  if (!userUUID) return { allowed: true, next_allowed: null };

  try {
    const { data, error } = await supabaseClient
      .rpc("check_user_order_cooldown", { p_user_uuid: userUUID });

    if (error) throw error;
    if (!data?.length) return { allowed: true, next_allowed: null };

    const { allowed, next_allowed } = data[0];
    return { allowed: Boolean(allowed), next_allowed: next_allowed || null };

  } catch (e) {
    console.error("检查用户冷却状态失败:", e);
    return { allowed: true, next_allowed: null };
  }
}

/* ====================== 更新本轮订单完成进度 ====================== */
/**
 * 获取本轮完成订单数量
 * @param {string} userId 用户 ID
 * @param {string} roundId 当前轮次 ID
 * @returns {Promise<number>} 已完成订单数
 */
async function getCompletedOrdersCount(userId, roundId) {
  if (!userId || !roundId) return 0;

  try {
    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select("id, status")
      .eq("user_id", userId)
      .eq("round_id", roundId);

    if (error) throw error;
    return orders?.filter(o => o.status === "completed").length || 0;

  } catch (e) {
    console.error("获取本轮完成订单数失败:", e);
    return 0;
  }
}

/**
 * 渲染本轮进度到 UI
 * @param {number} completed 已完成订单数
 * @param {number} total 总订单数
 */
function renderRoundProgress(completed, total) {
  const el = document.getElementById("roundProgress");
  if (el) el.textContent = `本轮已完成订单：${completed} / ${total}`;
}

/**
 * 更新本轮订单完成进度（封装逻辑 + UI）
 * @param {string} userId 
 * @param {string} roundId 
 * @param {number} ordersPerRound 
 */
async function updateRoundProgress(userId, roundId, ordersPerRound) {
  if (!ordersPerRound) {
    await loadRoundConfig();
    ordersPerRound = window.ORDERS_PER_ROUND;
  }

  const completed = await getCompletedOrdersCount(userId, roundId);
  renderRoundProgress(completed, ordersPerRound);
}

/* ====================== 渲染最近订单 ====================== */
/**
 * 构建订单 HTML 字符串
 * @param {Object} order 订单对象
 * @param {number} coins 用户当前金币
 * @returns {string} HTML 字符串
 */
function buildOrderHTML(order, coins) {
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;
  const profitRatio = Number(order.products?.profit) || 0;

  let html = `
    <h3>Order results</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润率：${profitRatio}</p>
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

  return html;
}

/**
 * 渲染单个订单到页面
 * @param {Object} order 订单对象
 * @param {number} coins 用户当前金币
 */
function renderLastOrder(order, coins) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  el.innerHTML = buildOrderHTML(order, Number(coins) || 0);

  // 绑定完成订单按钮事件
  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    const handler = async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    };
    compBtn.removeEventListener("click", handler); // 防止重复绑定
    compBtn.addEventListener("click", handler);
  }
}

/* ====================== 完成订单 ====================== */
/**
 * 刷新完成订单后的 UI
 * @param {Object} order 订单对象
 * @param {number} coins 用户当前 Coins
 */
async function refreshOrderUI(order, coins) {
  renderLastOrder(order, coins);
  updateCoinsUI(coins);
  await checkPendingLock();
  await loadRecentOrders();
  await updateRoundProgress();
}

/**
 * 完成订单
 * @param {Object} order 待完成订单对象
 * @param {number} currentCoinsRaw 当前 Coins
 */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (!order || order.status === "completed") return;

    const currentCoins = Number(currentCoinsRaw) || 0;
    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalCoins = currentCoins + price + profit;

    // 🔹 更新订单状态
    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    // 🔹 更新用户 Coins
    const { error: coinErr } = await supabaseClient
      .from("users")
      .update({ coins: finalCoins })
      .eq("id", window.currentUserId);
    if (coinErr) throw new Error(coinErr.message);

    // 🔹 刷新页面 UI
    await refreshOrderUI({ ...order, status: "completed" }, finalCoins);

  } catch (e) {
    showAlert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/**
 * 统一提示函数
 * @param {string} msg 提示信息
 */
function showAlert(msg) {
  alert(msg); // 可进一步封装为弹窗或 toast
}

/* ====================== 检查 pending 锁定 ====================== */
/**
 * 检查当前用户是否存在未完成订单
 * @returns {Promise<boolean>} 是否存在 pending 订单
 */
async function hasPendingOrders() {
  if (!window.currentUserId) return false;

  try {
    const { data: pendingOrders, error } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);

    if (error) throw error;
    return pendingOrders?.length > 0;
  } catch (e) {
    console.error("检查 pending 锁定失败", e);
    return false;
  }
}

/**
 * 根据 pending 状态更新下单按钮
 */
async function checkPendingLock() {
  const hasPending = await hasPendingOrders();
  if (hasPending) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  } else {
    setOrderBtnDisabled(false);
  }
}


/* ====================== 订单 ====================== */
/* ====================== 自动下单 ====================== */
async function autoOrder() {
  if (!window.currentUserId) return alert("请先登录！");
  if (ordering) return;

  ordering = true;
  setMatchingState(true);

  try {
    // 1️⃣ 加载轮次配置 & 新轮次
    await loadRoundConfig();
    if (!window.currentRoundId) startNewRound();

    // 2️⃣ 获取用户信息 & 检查 Coins
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);
    if (coins < 50) throw new Error("你的余额不足，最少需要 50 coins");

    // 3️⃣ 检查 pending & 本轮完成订单数
    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id,status,round_id")
      .eq("user_id", window.currentUserId);
    
    const pendingOrders = orders.filter(o => o.status === "pending");
    if (pendingOrders.length) {
      await checkPendingLock();
      throw new Error("您有未完成订单，请先完成订单再继续下单。");
    }

    const currentRoundOrders = orders.filter(o => o.round_id === window.currentRoundId);
    const completedCount = currentRoundOrders.filter(o => o.status === "completed").length;
    if (completedCount >= window.ORDERS_PER_ROUND) {
      const cooldown = await checkOrderCooldown();
      if (cooldown.next_allowed) startCooldownTimer(cooldown.next_allowed, "本轮已完成全部订单，冷却中，请等待");
      throw new Error("本轮已完成全部订单，进入冷却…");
    }

    // 4️⃣ 选择商品（规则优先，随机备用）
    const orderNumber = orders.length + 1;
    let product = await getUserRuleProduct(window.currentUserId, orderNumber)
      .then(async pid => pid ? (await supabaseClient.from("products").select("*").eq("id", pid).single()).data : null);
    if (!product) product = await getRandomProduct();

    // 5️⃣ 生成随机匹配时间
    const delaySec = Math.floor(Math.random() * (window.MATCH_MAX_SECONDS - window.MATCH_MIN_SECONDS + 1)) + window.MATCH_MIN_SECONDS;
    const matchingStartedAt = Date.now();

    // 6️⃣ 保存匹配信息 & 启动倒计时
    ["matchingEndTime", "matchingProductId", "matchingStartedAt", "matchingDuration"].forEach((key, idx) => {
      localStorage.setItem(key, idx === 1 ? product.id : idx === 3 ? delaySec : matchingStartedAt);
    });

    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "下单失败");
    setMatchingState(false);
  } finally {
    ordering = false;
  }
}

/* ====================== 匹配倒计时 ====================== */
function startMatchingCountdown(product, delaySec) {
  if (!product || delaySec <= 0) return;

  const endTime = Date.now() + delaySec * 1000;
  setMatchingState(true); // 开始匹配显示

  const clearMatchingLocalStorage = () => {
    ["matchingEndTime", "matchingProductId", "matchingStartedAt", "matchingDuration"].forEach(key =>
      localStorage.removeItem(key)
    );
  };

  const interval = setInterval(() => {
    const remainingSec = Math.ceil((endTime - Date.now()) / 1000);

    if (remainingSec > 0) {
      const btn = document.getElementById("autoOrderBtn");
      if (btn) btn.textContent = `🎲 匹配中... (${remainingSec}s)`;
    } else {
      clearInterval(interval);
      setMatchingState(false);
      clearMatchingLocalStorage();

      // 下单逻辑，传入匹配时长
      finalizeMatchedOrder(product, delaySec * 1000);
    }
  }, 1000);
}

/* ====================== 匹配完成后的订单生成 ====================== */
async function finalizeMatchedOrder(product, matchingDurationMs = null) {
  if (!window.currentUserId || !product) return;

  try {
    const price = Number(product.price) || 0;
    const profit = +(price * (Number(product.profit) || 0)).toFixed(2);
    const matchingDuration = matchingDurationMs ? Math.ceil(matchingDurationMs / 1000) : 0;
    const matchingStartedAt = matchingDurationMs ? new Date(Date.now() - matchingDurationMs) : new Date();

    // 扣 Coins 并创建订单（RPC 或事务更安全）
    const { data: newOrder, error } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending",
        round_id: window.currentRoundId,
        matching_started_at: matchingStartedAt.toISOString(),
        matching_duration: matchingDuration,
      })
      .select(`
        id, total_price, profit, status, created_at, 
        products ( name, profit )
      `)
      .single();

    if (error || !newOrder) throw new Error(error?.message || "生成订单失败");

    // 更新 Coins
    const { data: userData, error: coinErr } = await supabaseClient
      .from("users")
      .update({ coins: supabaseClient.rpc('coins_minus', { user_id: window.currentUserId, amount: price }) })
      .eq("id", window.currentUserId)
      .select("coins")
      .single();

    const currentCoins = Number(userData?.coins || 0);

    // 更新 UI
    renderLastOrder(newOrder, currentCoins);
    updateCoinsUI(currentCoins);
    await checkPendingLock();
    await loadRecentOrders();
    await updateRoundProgress();

  } catch (e) {
    console.error("生成订单失败", e);
    alert(e.message || "生成订单失败");
  }
}

/* ====================== 兑换逻辑 Coins ↔ Balance ====================== */
let currentExchangeDirection = "toCoins";

function toggleExchangeDirection(dir) {
  currentExchangeDirection = dir;
  document.getElementById("balanceToCoinsBtn")?.classList.toggle("active", dir === "toCoins");
  document.getElementById("coinsToBalanceBtn")?.classList.toggle("active", dir === "toBalance");
}

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
  const amount = parseFloat(inputEl?.value || "0");
  if (isNaN(amount) || amount <= 0) { 
    alert("输入无效，请输入大于0的数值"); 
    exchanging = false; 
    return; 
  }

  let filterCol = window.currentUserUUID ? "uuid" : "id";
  let filterVal = window.currentUserUUID || window.currentUserId;

  if (!filterVal) { 
    alert("请先登录！"); 
    exchanging = false; 
    return; 
  }

  const isUUID = !!window.currentUserUUID;

  try {
    if (currentExchangeDirection === "toBalance" && !isUUID) {
      alert("⚠️ Coins → Balance 功能仅支持 UUID 用户！");
      exchanging = false;
      return;
    }

    if (currentExchangeDirection === "toBalance") {
      const canEx = await canExchangeThisRound();
      if (!canEx) {
        alert(`⚠️ 需要完成本轮 ${window.ORDERS_PER_ROUND}/${window.ORDERS_PER_ROUND} 订单才能使用 Coins → Balance 功能！`);
        exchanging = false;
        return;
      }
    }

    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins,balance")
      .eq(filterCol, filterVal)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    let coins = Number(user.coins) || 0;
    let balance = Number(user.balance) || 0;

    if (currentExchangeDirection === "toCoins") {
      if (balance < amount) throw new Error(`余额不足，当前 Balance：¥${balance.toFixed(2)}`);
      coins += amount;
      balance -= amount;
    } else {
      if (coins < amount) throw new Error(`Coins 不足，当前 Coins：${coins.toFixed(2)}`);
      coins -= amount;
      balance += amount;
    }

    const { error: updErr } = await supabaseClient
      .from("users")
      .update({ coins, balance })
      .eq(filterCol, filterVal);
    if (updErr) throw new Error("兑换失败：" + updErr.message);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} ${currentExchangeDirection === "toCoins" ? "Coins" : "Balance"}`);
    document.getElementById("ordercoins").textContent = coins.toFixed(2);
    document.getElementById("balance").textContent = balance.toFixed(2);
    updateCoinsUI(coins);

    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();
    closeExchangeModal();

  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
  }
}

/* ====================== 检查本轮 Coins - Balance 是否可用 ====================== */
async function canExchangeThisRound() {
  if (!window.currentUserId || !window.currentRoundId) return false;
  try {
    const { data: completedOrders, error } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId)
      .eq("status", "completed");
    if (error) throw error;
    return (completedOrders?.length || 0) >= window.ORDERS_PER_ROUND;
  } catch (e) {
    console.error("检查本轮兑换条件失败", e);
    return false;
  }
}

/* ====================== 页面事件绑定 ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelExchange")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmExchange")?.addEventListener("click", confirmExchange);

  document.getElementById("balanceToCoinsBtn")?.addEventListener("click", () => toggleExchangeDirection("toCoins"));
  document.getElementById("coinsToBalanceBtn")?.addEventListener("click", () => toggleExchangeDirection("toBalance"));

  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addCoinsModal") closeExchangeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExchangeModal();
  });

  refreshAll();
});

/* ====================== 页面刷新工具 ====================== */
async function refreshAll() {
  await loadRoundConfig();
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
  await checkPendingLock();
  await updateRoundProgress();
}

async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;

  let filterCol = window.currentUserUUID ? "uuid" : "id";
  let filterVal = window.currentUserUUID || window.currentUserId;

  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq(filterCol, filterVal)
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

  let filterCol = window.currentUserUUID ? "uuid" : "id";
  let filterVal = window.currentUserUUID || window.currentUserId;

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq(filterCol, filterVal)
    .single();

  if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
  else document.getElementById("orderResult").innerHTML = "";
}

async function loadRecentOrders() {
  if (!window.currentUserId) return;

  try {
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
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
      else list.innerHTML = recentOrders.map(o => {
        const price = Number(o.total_price) || 0;
        const profit = Number(o.profit) || 0;
        const profitRatio = Number(o.products?.profit) || 0;
        return `<li>🛒 ${o.products?.name || "未知商品"} / ¥${price.toFixed(2)} / 利润：${profitRatio} / 收入：+¥${profit.toFixed(2)} / 状态：${o.status === "completed" ? "已完成" : "待完成"} / <small>${new Date(o.created_at).toLocaleString()}</small></li>`;
      }).join("");
    }
  } catch (e) {
    console.error("加载最近订单失败：", e);
  }
}

/* ====================== 显示/隐藏匹配状态 & GIF ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const btn = document.getElementById("autoOrderBtn");

  if (gifEl) gifEl.style.display = isMatching ? "block" : "none";
  if (btn) {
    btn.disabled = isMatching;
    btn.textContent = isMatching ? "🎲 正在匹配..." : "🎲 一键刷单";
  }
}
