/* ====================== 1.初始化用户信息 ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID"); 

let ordering = false;
let completing = false;
let exchanging = false;
let cooldownTimer = null;

// 默认轮次配置
window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION = 5 * 60 * 1000;

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ====================== 2.读取轮次配置 (每轮单数 & 冷却分钟) ====================== */
async function loadRoundConfig() {
  try {
    const { data, error } = await supabaseClient.rpc("get_round_config");
    if (error) throw error;

    const config = data?.[0]; // ⚠️ 取数组第一个元素
    if (!config) throw new Error("未获取到轮次配置");

    window.ORDERS_PER_ROUND = Number(config.orders_per_round);
    window.ROUND_DURATION_MINUTES = Number(config.round_duration_minutes);
    window.ROUND_DURATION = window.ROUND_DURATION_MINUTES * 60 * 1000;

    window.MATCH_MIN_SECONDS = Number(config.match_min) || 5;
    window.MATCH_MAX_SECONDS = Number(config.match_max) || 15;

    console.log("✅ 配置已加载：", {
      ORDERS_PER_ROUND: window.ORDERS_PER_ROUND,
      ROUND_DURATION_MINUTES: window.ROUND_DURATION_MINUTES,
      MATCH_MIN: window.MATCH_MIN_SECONDS,
      MATCH_MAX: window.MATCH_MAX_SECONDS,
    });

  } catch (e) {
    console.error("❌ 读取配置失败", e.message);

    // 默认值
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
async function getUserRuleProduct(userUUID, orderNumber) {
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_uuid", userUUID)
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
async function updateRoundProgress(roundData) {
  if (!roundData) {
    try {
      const { data, error } = await supabaseClient.rpc("get_or_create_current_round", {
        p_user_uuid: window.currentUserUUID
      });
      if (error || !data?.length) throw error;
      roundData = data[0];
    } catch (e) {
      console.error("获取轮次数据失败", e);
      return;
    }
  }

  const completed = roundData.completed_orders || 0;
  const orderLimit = roundData.order_limit || window.ORDERS_PER_ROUND;
  const cooldownSec = roundData.cooldown_remaining_seconds || 0;

  const el = document.getElementById("roundProgress");
  if (el) el.textContent = `本轮已完成订单：${completed} / ${orderLimit}`;

  if (completed >= orderLimit) {
    console.log("🎯 本轮完成订单数已达上限，开启新轮次");
    await startNewRound();
  } else {
    startRoundCountdown(cooldownSec);
  }
}

/* ====================== 8.完成订单 ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

    const { data, error } = await supabaseClient.rpc("complete_order_and_update_round", {
      p_order_id: order.id,
      p_user_uuid: window.currentUserUUID
    });

    if (error) throw error;
    if (!data?.length) throw new Error("RPC 返回数据为空");

    const result = data[0];

    renderLastOrder({ ...order, status: result.order_status }, result.user_coins);
    updateCoinsUI(result.user_coins);
    await loadRecentOrders();
    await updateRoundProgress(result);

  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ====================== 9.检查本轮是否可兑换 ====================== */
async function canExchangeThisRound() {
  if (!window.currentUserUUID) return false;

  if (!window.currentRoundId) {
    try {
      const { data: round } = await supabaseClient.rpc("get_or_create_current_round", {
        p_user_uuid: window.currentUserUUID
      });
      window.currentRoundId = round?.round_id;
    } catch (e) {
      console.error("获取当前轮次失败", e);
      return false;
    }
  }
  if (!window.currentRoundId) return false;

  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_uuid", window.currentUserUUID)
      .eq("round_id", window.currentRoundId)
      .eq("status", "completed");

    if (error) throw error;
    return (data?.length || 0) >= window.ORDERS_PER_ROUND;
  } catch (e) {
    console.error("检查本轮兑换条件失败", e);
    return false;
  }
}

/* ====================== 10.页面事件绑定 & 弹窗函数 ====================== */
let currentExchangeDirection = "toBalance";

function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "block";
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "none";
}

function toggleExchangeDirection(direction) {
  currentExchangeDirection = direction;
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelExchange")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmExchange")?.addEventListener("click", confirmExchange);
  document.getElementById("balanceToCoinsBtn")?.addEventListener("click", () => toggleExchangeDirection("toCoins"));
  document.getElementById("coinsToBalanceBtn")?.addEventListener("click", () => toggleExchangeDirection("toBalance"));
  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => { if (e.target.id === "addCoinsModal") closeExchangeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeExchangeModal(); });

  await refreshAll();
  await startNewRound();
});

/* ====================== 11.检查 pending 锁定 ====================== */
async function checkPendingLock() {
  if (!window.currentUserUUID) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_uuid", window.currentUserUUID)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  } else {
    setOrderBtnDisabled(false);
  }
}

/* ====================== 1~11 已经定义上文 ====================== */

/* ====================== 12. 自动刷单 ====================== */
async function autoOrder() {
  if (!window.currentUserUUID) return;
  if (ordering) return;
  ordering = true;

  try {
    const cooldown = await checkOrderCooldown();
    if (!cooldown.allowed) {
      setOrderBtnDisabled(true, `冷却中，剩余 ${cooldown.cooldown_seconds}s`, `${cooldown.cooldown_seconds}s`);
      return;
    }

    const roundData = await supabaseClient
      .rpc("get_or_create_current_round", { p_user_uuid: window.currentUserUUID });
    const orderLimit = roundData?.[0]?.order_limit || window.ORDERS_PER_ROUND;

    // 获取手动规则优先产品
    let productId = await getUserRuleProduct(window.currentUserUUID, orderLimit);

    // 否则随机产品
    if (!productId) {
      const product = await getRandomProduct();
      productId = product.id;
    }

    // 创建订单
    const { data, error } = await supabaseClient
      .from("orders")
      .insert([{ user_uuid: window.currentUserUUID, product_id: productId, status: "pending" }])
      .select()
      .single();
    if (error) throw error;

    // 等待匹配完成
    await startMatchingCountdown(data.id);

  } catch (e) {
    console.error("自动刷单失败", e.message);
    alert("自动刷单失败：" + e.message);
  } finally {
    ordering = false;
  }
}

/* ====================== 13. 匹配倒计时 ====================== */
async function startMatchingCountdown(orderId) {
  if (!orderId) return;
  const seconds = Math.floor(Math.random() * (window.MATCH_MAX_SECONDS - window.MATCH_MIN_SECONDS + 1) + window.MATCH_MIN_SECONDS);
  let countdown = seconds;

  const interval = setInterval(() => {
    const el = document.getElementById("matchingCountdown");
    if (el) el.textContent = `订单匹配中：${countdown}s`;
    countdown--;
    if (countdown < 0) clearInterval(interval);
  }, 1000);

  // 倒计时结束自动完成订单
  setTimeout(async () => {
    clearInterval(interval);
    const orderRes = await supabaseClient
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderRes.data) await completeOrder(orderRes.data);
  }, seconds * 1000);
}

/* ====================== 14. 完成匹配订单 ====================== */
// 已经在 completeOrder() 中实现，这里不额外重复

/* ====================== 15. 开启新轮次 ====================== */
async function startNewRound() {
  try {
    const { data, error } = await supabaseClient
      .rpc("get_or_create_current_round", { p_user_uuid: window.currentUserUUID });
    if (error) throw error;

    window.currentRoundId = data?.[0]?.round_id;
    window.roundStartTime = Date.now();

    const el = document.getElementById("roundProgress");
    if (el) el.textContent = `本轮已完成订单：0 / ${window.ORDERS_PER_ROUND}`;

    setOrderBtnDisabled(false);
    startRoundCountdown(0);

  } catch (e) {
    console.error("开启新轮次失败", e.message);
  }
}

/* ====================== 16. 本轮倒计时 ====================== */
function startRoundCountdown(cooldownSec = 0) {
  if (cooldownTimer) clearInterval(cooldownTimer);
  let remaining = cooldownSec;

  cooldownTimer = setInterval(() => {
    const el = document.getElementById("cooldownDisplay");
    if (!el) return;

    if (remaining > 0) {
      el.textContent = `冷却中：${formatTime(remaining)}`;
      setOrderBtnDisabled(true);
      remaining--;
    } else {
      el.textContent = "";
      setOrderBtnDisabled(false);
      clearInterval(cooldownTimer);
    }
  }, 1000);
}

/* ====================== 17. 加载最近订单 ====================== */
async function loadRecentOrders(limit = 5) {
  if (!window.currentUserUUID) return;

  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("id,total_price,profit,status,created_at,product_id")
      .eq("user_uuid", window.currentUserUUID)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const listEl = document.getElementById("recentOrders");
    if (listEl) {
      listEl.innerHTML = "";
      data.forEach(order => {
        const li = document.createElement("li");
        li.textContent = `${order.id} | ¥${order.total_price.toFixed(2)} | ${order.status}`;
        listEl.appendChild(li);
      });
    }

  } catch (e) {
    console.error("加载最近订单失败", e.message);
  }
}

/* ====================== 18. 渲染最新订单 ====================== */
function renderLastOrder(order, coins) {
  const el = document.getElementById("lastOrder");
  if (el && order) {
    el.textContent = `最新订单：${order.id} | ¥${order.total_price.toFixed(2)} | ${order.status}`;
  }
  if (coins !== undefined) updateCoinsUI(coins);
}

/* ====================== 19. 刷新兑换界面 ====================== */
async function refreshExchangeUI() {
  if (!window.currentUserUUID) return;

  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("balance,coins")
      .eq("uuid", window.currentUserUUID)
      .single();
    if (error) throw error;

    const balanceEl = document.getElementById("balanceDisplay");
    const coinsEl = document.getElementById("ordercoins"); 
    if (balanceEl) balanceEl.textContent = `Balance：¥${Number(data.balance).toFixed(2)}`;
    if (coinsEl) coinsEl.textContent = `Coins：${Number(data.coins).toFixed(2)}`;

  } catch (e) {
    console.error("刷新兑换界面失败", e.message);
  }
}

/* ====================== 20. 确认兑换 ====================== */
async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  try {
    const amountInput = document.getElementById("exchangeAmount");
    const amount = Number(amountInput?.value || 0);
    if (amount <= 0) { alert("请输入兑换数量"); return; }

    const rpcName = currentExchangeDirection === "toCoins" ? "balance_to_coins" : "coins_to_balance";

    const { data, error } = await supabaseClient
      .rpc(rpcName, { p_user_uuid: window.currentUserUUID, p_amount: amount });
    if (error) throw error;

    alert(`兑换成功！新余额：¥${data.new_balance}, 新刷单币：${data.new_coins}`);
    await refreshExchangeUI();
    closeExchangeModal();

  } catch (e) {
    console.error("兑换失败", e.message);
    alert("兑换失败：" + e.message);
  } finally {
    exchanging = false;
  }
}

/* ====================== 21. 页面初始化 ====================== */
async function refreshAll() {
  await loadRoundConfig();
  await checkPendingLock();
  await updateRoundProgress();
  await loadRecentOrders();
  await refreshExchangeUI();
}
