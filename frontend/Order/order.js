/* ======================
   第1部分
   ====================== */

/* ======================
   用户信息 & 轮次初始化
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID"); // 新增 UUID
window.currentRoundId = localStorage.getItem("currentRoundId");   // 当前轮次
window.roundStartTime = localStorage.getItem("roundStartTime");   // 当前轮次开始时间

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Coins <-> Balance 兑换并发保护
let cooldownTimer = null;  // 冷却倒计时

// 默认轮次配置
window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION_MINUTES = 5;
window.ROUND_DURATION = window.ROUND_DURATION_MINUTES * 60 * 1000;
window.MATCH_MIN_SECONDS = 5;
window.MATCH_MAX_SECONDS = 15;

if (!window.supabaseClient) console.error("❌ supabaseClient 未初始化！");

/* ======================
   轮次配置加载
   ====================== */
async function loadRoundConfig() {
  try {
    const { data, error } = await supabaseClient
      .from("round_config")
      .select("orders_per_round, round_duration, match_min_seconds, match_max_seconds")
      .limit(1)
      .single();
    if (error) throw error;
    if (data) {
      window.ORDERS_PER_ROUND = Number(data.orders_per_round);
      window.ROUND_DURATION_MINUTES = Number(data.round_duration);
      window.ROUND_DURATION = window.ROUND_DURATION_MINUTES * 60 * 1000;
      window.MATCH_MIN_SECONDS = Number(data.match_min_seconds) || 5;
      window.MATCH_MAX_SECONDS = Number(data.match_max_seconds) || 15;
      console.log("✅ 配置已加载：", {
        ORDERS_PER_ROUND: window.ORDERS_PER_ROUND,
        ROUND_DURATION_MINUTES: window.ROUND_DURATION_MINUTES,
        MATCH_MIN: window.MATCH_MIN_SECONDS,
        MATCH_MAX: window.MATCH_MAX_SECONDS,
      });
    }
  } catch (e) {
    console.error("❌ 读取配置失败", e.message);
  }
}

/* ======================
   工具函数
   ====================== */
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
  if (coins < 0) setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
  else setOrderBtnDisabled(false);
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

function startNewRound() {
  const uuid = crypto.randomUUID();
  window.currentRoundId = uuid;
  window.roundStartTime = Date.now();
  localStorage.setItem("currentRoundId", uuid);
  localStorage.setItem("roundStartTime", window.roundStartTime);
}

/* ======================
   获取用户规则产品
   ====================== */
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
    return rules?.[0]?.product_id || null;
  } catch (e) {
    console.error("读取手动规则失败", e);
    return null;
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
  if (error || !products?.length) throw new Error("产品列表为空或读取失败！");
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   检查冷却
   ====================== */
async function checkOrderCooldown() {
  if (!window.currentUserUUID) return { allowed: true, next_allowed: null };
  try {
    const { data, error } = await supabaseClient
      .rpc("check_user_order_cooldown", { p_user_uuid: window.currentUserUUID });
    if (error) throw error;
    if (!data?.length) return { allowed: true, next_allowed: null };
    const row = data[0];
    return { allowed: row.allowed, next_allowed: row.next_allowed };
  } catch (e) {
    console.error("检查冷却失败", e);
    return { allowed: true, next_allowed: null };
  }
}

/* ======================
   本轮完成订单数显示
   ====================== */
async function updateRoundProgress() {
  if (!window.ORDERS_PER_ROUND || !window.ROUND_DURATION_MINUTES) await loadRoundConfig();

  const { data: orders } = await supabaseClient
    .from("orders")
    .select("id, status")
    .eq("user_id", window.currentUserId)
    .eq("round_id", window.currentRoundId);

  const completed = orders?.filter(o => o.status === "completed").length || 0;
  const el = document.getElementById("roundProgress");
  if (el) el.textContent = `本轮已完成订单：${completed} / ${window.ORDERS_PER_ROUND}`;
}

/* ======================
   页面刷新工具
   ====================== */
async function refreshAll() {
  await loadRoundConfig();
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
  await checkPendingLock();
  await updateRoundProgress();
}

/* ======================
   第2部分
   ====================== */

/* ======================
   自动下单（支持刷新保持匹配倒计时）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;

  try {
    await loadRoundConfig();

    if (!window.currentRoundId) startNewRound();

    // 检查本轮已完成订单数
    const { data: roundOrders } = await supabaseClient
      .from("orders")
      .select("id,status")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId);

    const completedCount = roundOrders?.filter(o => o.status === "completed").length || 0;
    if (completedCount >= window.ORDERS_PER_ROUND) {
      const cooldown = await checkOrderCooldown();
      if (cooldown.next_allowed) startCooldownTimer(cooldown.next_allowed, "本轮已完成全部订单，冷却中，请等待");
      alert("本轮已完成全部订单，进入冷却…");
      ordering = false;
      return;
    }

    // 获取用户 Coins
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);
    if (coins < 50) { alert("你的余额不足，最少需要 50 coins"); ordering = false; return; }

    // 检查未完成订单
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) { alert("您有未完成订单，请先完成订单再继续下单。"); await checkPendingLock(); ordering = false; return; }

    // 选择商品（规则或随机）
    let product;
    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);

    const orderNumber = (totalCount || 0) + 1;
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

    // 生成随机匹配时间
    const delaySec = Math.floor(Math.random() * (window.MATCH_MAX_SECONDS - window.MATCH_MIN_SECONDS + 1)) + window.MATCH_MIN_SECONDS;

    // 保存匹配结束时间和产品信息
    localStorage.setItem("matchingEndTime", Date.now() + delaySec * 1000);
    localStorage.setItem("matchingProductId", product.id);

    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "下单失败");
    setMatchingState(false);
  } finally {
    ordering = false;
  }
}

/* ======================
   匹配倒计时
   ====================== */
function startMatchingCountdown(product, delaySec) {
  const endTime = Date.now() + delaySec * 1000;

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining > 0) {
      setMatchingState(true);
      requestAnimationFrame(tick);
    } else {
      setMatchingState(false);
      localStorage.removeItem("matchingEndTime");
      localStorage.removeItem("matchingProductId");
      finalizeMatchedOrder(product);
    }
  };
  tick();
}

/* ======================
   页面刷新恢复匹配
   ====================== */
function restoreMatchingIfAny() {
  const endTime = Number(localStorage.getItem("matchingEndTime"));
  const productId = localStorage.getItem("matchingProductId");

  if (endTime && productId && endTime > Date.now()) {
    const delaySec = Math.ceil((endTime - Date.now()) / 1000);
    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => { if (!error && data) startMatchingCountdown(data, delaySec); });
  } else if (endTime && productId) {
    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => { if (!error && data) finalizeMatchedOrder(data); });
    localStorage.removeItem("matchingEndTime");
    localStorage.removeItem("matchingProductId");
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

    const currentCoins = Number(currentCoinsRaw) || 0;
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
    await updateRoundProgress();

  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   检查 pending 锁定
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
   匹配完成生成订单
   ====================== */
async function finalizeMatchedOrder(product) {
  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);

    const price = Number(product.price || 0);
    const profit = +(price * (Number(product.profit) || 0)).toFixed(2);
    const tempCoins = coins - price;

    await supabaseClient.from("users").update({ coins: tempCoins }).eq("id", window.currentUserId);

    const { data: newOrder } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending",
        round_id: window.currentRoundId
      })
      .select("id, total_price, profit, status, created_at, products(name, profit)")
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

/* ======================
   Coins ↔ Balance 兑换
   ====================== */
let currentExchangeDirection = "toCoins";

function toggleExchangeDirection(dir) {
  currentExchangeDirection = dir;
  document.getElementById("balanceToCoinsBtn")?.classList.toggle("active", dir === "toCoins");
  document.getElementById("coinsToBalanceBtn")?.classList.toggle("active", dir === "toBalance");
}

async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  try {
    const inputEl = document.getElementById("addCoinsInput");
    const amount = parseFloat(inputEl?.value || "0");
    if (isNaN(amount) || amount <= 0) throw new Error("输入无效，请输入大于0的数值");

    const filterCol = window.currentUserUUID ? "uuid" : "id";
    const filterVal = window.currentUserUUID || window.currentUserId;
    if (!filterVal) throw new Error("请先登录！");

    if (currentExchangeDirection === "toBalance" && !window.currentUserUUID)
      throw new Error("⚠️ Coins → Balance 功能仅支持 UUID 用户！");

    if (currentExchangeDirection === "toBalance") {
      const canEx = await canExchangeThisRound();
      if (!canEx) throw new Error(`⚠️ 需要完成本轮 ${window.ORDERS_PER_ROUND}/${window.ORDERS_PER_ROUND} 订单才能兑换！`);
    }

    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins,balance")
      .eq(filterCol, filterVal)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    let coins = Number(user.coins || 0);
    let balance = Number(user.balance || 0);

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

  } catch (e) { alert(e.message || "兑换失败"); }
  finally { exchanging = false; }
}

/* ======================
   显示/隐藏匹配状态
   ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const btn = document.getElementById("autoOrderBtn");
  if (gifEl) gifEl.style.display = isMatching ? "block" : "none";
  if (btn) {
    btn.disabled = isMatching;
    btn.textContent = isMatching ? "🎲 正在匹配..." : "🎲 一键刷单";
  }
}

/* ======================
   冷却倒计时
   ====================== */
function startCooldownTimer(nextAllowed, messagePrefix = "冷却中，请等待") {
  if (!nextAllowed) return;
  if (cooldownTimer) clearInterval(cooldownTimer);

  const tick = () => {
    const sec = Math.ceil((new Date(nextAllowed).getTime() - Date.now()) / 1000);
    if (sec <= 0) {
      clearInterval(cooldownTimer);
      setOrderBtnDisabled(false);
      startNewRound();
      updateRoundProgress();
      loadRecentOrders();
    } else {
      setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
    }
  };
  tick();
  cooldownTimer = setInterval(tick, 1000);
}

/* ======================
   页面事件绑定
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelExchange")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmExchange")?.addEventListener("click", confirmExchange);

  document.getElementById("balanceToCoinsBtn")?.addEventListener("click", () => toggleExchangeDirection("toCoins"));
  document.getElementById("coinsToBalanceBtn")?.addEventListener("click", () => toggleExchangeDirection("toBalance"));

  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => { if (e.target.id === "addCoinsModal") closeExchangeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeExchangeModal(); });

  refreshAll();
  restoreMatchingIfAny();
});

/* ======================
   Coins 兑换弹窗控制
   ====================== */
function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "block";
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "none";
}

