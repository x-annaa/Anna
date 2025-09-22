/* ====================== 1.初始化用户信息 ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID"); // 新增 UUID

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Balance <-> Coins 兑换中的并发保护
let cooldownTimer = null;  // 冷却倒计时

// 默认轮次配置
window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION = 5 * 60 * 1000; // 毫秒

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ====================== 2.读取轮次配置 (每轮单数 & 冷却分钟) ====================== */
async function loadRoundConfig() {
  try {
    const { data, error } = await supabaseClient.rpc("get_round_config");
    if (error) throw error;

    window.ORDERS_PER_ROUND = Number(data.orders_per_round);
    window.ROUND_DURATION_MINUTES = Number(data.round_duration_minutes);
    window.ROUND_DURATION = window.ROUND_DURATION_MINUTES * 60 * 1000;

    window.MATCH_MIN_SECONDS = Number(data.match_min) || 5;
    window.MATCH_MAX_SECONDS = Number(data.match_max) || 15;

    console.log("✅ 配置已加载：", {
      ORDERS_PER_ROUND: window.ORDERS_PER_ROUND,
      ROUND_DURATION_MINUTES: window.ROUND_DURATION_MINUTES,
      MATCH_MIN: window.MATCH_MIN_SECONDS,
      MATCH_MAX: window.MATCH_MAX_SECONDS,
    });

  } catch (e) {
    console.error("❌ 读取配置失败", e.message);

    window.ORDERS_PER_ROUND = 3;
    window.ROUND_DURATION_MINUTES = 5;
    window.ROUND_DURATION = 5 * 60 * 1000;
    window.MATCH_MIN_SECONDS = 5;
    window.MATCH_MAX_SECONDS = 15;
  }
}

/* ====================== 3.工具函数 ====================== */
function setOrderBtnDisabled(disabled, reason = "", cooldownText = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? `🎲 一键刷单（不可用）` : "🎲 一键刷单";
  }
  const cdEl = document.getElementById("cooldownDisplay");
  if (cdEl) cdEl.textContent = cooldownText;
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

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function isRoundExpired() {
  if (!window.roundStartTime) return true;
  return (Date.now() - Number(window.roundStartTime)) > window.ROUND_DURATION;
}

/* ====================== 4.获取用户规则产品 ====================== */
async function getUserRuleProduct(userId, orderNumber) {
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_id", userId)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);
  if (error) { console.error("读取手动规则失败", error); return null; }
  return rules?.[0]?.product_id || null;
}

/* ====================== 5.获取随机产品 ====================== */
async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);
  if (error || !products?.length) throw new Error("产品列表为空或读取失败！");
  return products[Math.floor(Math.random() * products.length)];
}

/* ====================== 6.检查冷却 ====================== */
async function checkOrderCooldown() {
  if (!window.currentUserUUID) return { allowed: true, next_allowed: null };
  try {
    const { data, error } = await supabaseClient
      .rpc("check_user_order_cooldown", { p_user_uuid: window.currentUserUUID });
    if (error) throw error;
    return {
      allowed: data.allowed,
      next_allowed: data.next_allowed,
      cooldown_seconds: data.cooldown_seconds
    };
  } catch (e) {
    console.error("检查冷却失败", e);
    return { allowed: true, next_allowed: null };
  }
}

/* ====================== 7.本轮完成订单数显示 ====================== */
async function updateRoundProgress() {
  const { data: round, error } = await supabaseClient.rpc(
    "get_or_create_current_round",
    { p_user_id: window.currentUserId }
  );
  if (error) return;

  const completed = round.completed_orders || 0;
  const el = document.getElementById("roundProgress");
  if (el) el.textContent = `本轮已完成订单：${completed} / ${window.ORDERS_PER_ROUND}`;
}

/* ====================== 8.完成订单 ✅ 改用 RPC ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    console.log("🔥 completeOrder 调用开始", {
      orderId: order.id, typeOrderId: typeof order.id,
      orderStatus: order.status, typeOrderStatus: typeof order.status,
      userId: window.currentUserId, typeUserId: typeof window.currentUserId
    });

    if (order.status === "completed") return;

    const { data, error } = await supabaseClient.rpc(
      "complete_order_and_update_round",
      { p_order_id: order.id, p_user_id: window.currentUserId }
    );
    if (error) throw error;
    const result = data[0];

    renderLastOrder({ ...order, status: result.order_status }, result.coins);
    updateCoinsUI(result.coins);
    await loadRecentOrders();
    await updateRoundProgress();
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ====================== 9.检查本轮是否可兑换 ✅ 增强容错 ====================== */
async function canExchangeThisRound() {
  if (!window.currentUserId) return false;

  if (!window.currentRoundId) {
    const { data: round } = await supabaseClient.rpc("get_or_create_current_round", {
      p_user_id: window.currentUserId
    });
    window.currentRoundId = round?.round_id;
  }
  if (!window.currentRoundId) return false;

  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId)
      .eq("status", "completed");

    if (error) throw error;
    return (data?.length || 0) >= window.ORDERS_PER_ROUND;
  } catch (e) {
    console.error("检查本轮兑换条件失败", e);
    return false;
  }
}

/* ====================== 10.已删除 ====================== */


/* ====================== 11.页面事件绑定 ✅ async 修复 ====================== */
document.addEventListener("DOMContentLoaded", async () => {
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

  await refreshAll();
  await startNewRound(); // 初始化时开启一轮
});

/* ====================== 12.检查 pending 锁定 ====================== */
async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ====================== 13.订单 ====================== */
async function autoOrder() {
  if (!window.currentUserId) {
    alert("请先登录！");
    return;
  }
  if (ordering) return;
  ordering = true;

  try {
    await loadRoundConfig();

    // 🔹 开启新轮次（如不存在）
    const { data: round, error: roundErr } = await supabaseClient.rpc(
      "get_or_create_current_round",
      { p_user_id: window.currentUserId }
    );
    if (roundErr) throw roundErr;
    const currentRoundId = round.round_id;

    // 🔹 检查本轮已完成订单数
    const { data: roundOrders } = await supabaseClient
      .from("orders")
      .select("id,status")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId);

    // 🔹 获取用户 Coins
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);
    if (coins < 50) {
      alert("你的余额不足，最少需要 50 coins");
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    // 🔹 检查未完成订单
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

    // 🔹 选择商品（规则或随机）
    let product;
    const totalOrdersRes = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);
    const orderNumber = (totalOrdersRes?.count || 0) + 1;

    const ruleProductId = await getUserRuleProduct(window.currentUserId, orderNumber);
    if (ruleProductId) {
      const { data: pData, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", ruleProductId)
        .single();
      if (!error && pData) product = pData;
    }
    if (!product) product = await getRandomProduct();

    // 🔹 生成随机匹配时间
    let delaySec = Math.floor(
      Math.random() * (window.MATCH_MAX_SECONDS - window.MATCH_MIN_SECONDS + 1)
    ) + window.MATCH_MIN_SECONDS;

    // 🔹 保存匹配结束时间和产品信息（本地存储，刷新保持状态）
    const matchingEndTime = Date.now() + delaySec * 1000;
    localStorage.setItem("matchingEndTime", matchingEndTime);
    localStorage.setItem("matchingProductId", product.id);

    // 🔹 启动匹配倒计时
    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "下单失败");
    setMatchingState(false); // 出错也隐藏 GIF
  } finally {
    ordering = false;
  }
}

/* ====================== 14.匹配倒计时函数（刷新保持状态） ====================== */
function startMatchingCountdown(product, delaySec) {
  const endTime = Date.now() + delaySec * 1000;
  const btn = document.getElementById("autoOrderBtn");
  const gifEl = document.getElementById("matchingGif");

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);

    if (remaining > 0) {
      setMatchingState(true); // ✅ 使用统一函数显示匹配状态
      requestAnimationFrame(tick);
    } else {
      setMatchingState(false); // 匹配完成，恢复按钮
      localStorage.removeItem("matchingEndTime");
      localStorage.removeItem("matchingProductId");

      // 下单逻辑
      finalizeMatchedOrder(product);
    }
  };

  tick();
}

/* ====================== 15.页面刷新恢复匹配状态 ====================== */
function restoreMatchingIfAny() {
  const endTime = Number(localStorage.getItem("matchingEndTime"));
  const productId = localStorage.getItem("matchingProductId");

  if (endTime && productId && endTime > Date.now()) {
    const delaySec = Math.ceil((endTime - Date.now()) / 1000);
    // 获取产品信息再启动倒计时
    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => {
        if (!error && data) startMatchingCountdown(data, delaySec);
      });
  } else if (endTime && productId) {
    // 匹配已结束但可能未生成订单
    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => { if (!error && data) finalizeMatchedOrder(data); });
    localStorage.removeItem("matchingEndTime");
    localStorage.removeItem("matchingProductId");
  }
}

/* ====================== 16.匹配完成后的订单生成 ====================== */
async function finalizeMatchedOrder(product) {
  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    let coins = Number(user?.coins || 0);

    const price = Number(product.price) || 0;
    const profitRatio = Number(product.profit) || 0;
    const profit = +(price * profitRatio).toFixed(2);
    const tempCoins = coins - price;

    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", window.currentUserId);

    const { data: newOrder } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending",
        round_id: window.currentRoundId,
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();
    await updateRoundProgress();

  } catch (e) {
    alert(e.message || "生成订单失败");
  }
}

// 页面加载时恢复匹配状态
document.addEventListener("DOMContentLoaded", restoreMatchingIfAny);

/* ====================== 17.开启新轮次 ====================== */
async function startNewRound() {
  if (!window.currentUserId) return;
  try {
    const { data: round, error } = await supabaseClient.rpc(
      "get_or_create_current_round",
      { p_user_id: window.currentUserId }
    );
    if (error) throw error;

    window.currentRoundId = round.round_id;
    window.roundStartTime = Date.now();

    console.log("🎯 新轮次已开始", round);

    await updateRoundProgress();
    await refreshExchangeUI(); // 同步兑换按钮
  } catch (e) {
    console.error("开启新轮次失败", e);
  }
}

/* ====================== 18.刷新兑换按钮可用状态 ====================== */
async function refreshExchangeUI() {
  if (!window.currentUserId) return;

  try {
    const canToBalance = await canExchangeThisRound();
    const coinsToBalanceBtn = document.getElementById("coinsToBalanceBtn");
    if (coinsToBalanceBtn) {
      coinsToBalanceBtn.disabled = !canToBalance;
      coinsToBalanceBtn.title = canToBalance ? "" : `⚠️ 需要完成 ${window.ORDERS_PER_ROUND} 单才可用`;
    }
  } catch (e) {
    console.error("刷新兑换按钮状态失败", e);
  }
}

/* ====================== 19.已删除 ====================== */


/* ====================== 20.兑换逻辑 Coins ↔ Balance ====================== */
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

/* ====================== 21.页面事件绑定 ====================== */
document.addEventListener("DOMContentLoaded", async () => {
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

  await refreshAll();
  await startNewRound(); // 初始化时开启一轮
});

/* ====================== 22.页面刷新工具 ====================== */
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

/* ====================== 23.显示/隐藏匹配状态 & GIF ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const btn = document.getElementById("autoOrderBtn");

  if (gifEl) gifEl.style.display = isMatching ? "block" : "none";
  if (btn) {
    btn.disabled = isMatching;
    btn.textContent = isMatching ? "🎲 正在匹配..." : "🎲 一键刷单";
  }
}

/* ====================== 24.渲染最近订单 ====================== */
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

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    });
  }
}
