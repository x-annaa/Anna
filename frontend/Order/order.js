/* ======================
   第1部分 - 用户信息 & 初始化
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID");
window.currentRoundId = localStorage.getItem("currentRoundId");
window.roundStartTime = localStorage.getItem("roundStartTime");

let ordering = false;
let completing = false;
let exchanging = false;
let cooldownTimer = null;

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
      window.ORDERS_PER_ROUND = Number(data.orders_per_round) || 3;
      window.ROUND_DURATION_MINUTES = Number(data.round_duration) || 5;
      window.ROUND_DURATION = window.ROUND_DURATION_MINUTES * 60 * 1000;
      window.MATCH_MIN_SECONDS = Number(data.match_min_seconds) || 5;
      window.MATCH_MAX_SECONDS = Number(data.match_max_seconds) || 15;
      console.log("✅ 配置已加载：", {
        ORDERS_PER_ROUND: window.ORDERS_PER_ROUND,
        ROUND_DURATION_MINUTES: window.ROUND_DURATION_MINUTES,
        MATCH_MIN_SECONDS: window.MATCH_MIN_SECONDS,
        MATCH_MAX_SECONDS: window.MATCH_MAX_SECONDS
      });
    }
  } catch (e) {
    console.error("❌ 读取配置失败", e.message);
  }
}

/* ======================
   轮次判断 & 新轮次
   ====================== */
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
  console.log("🆕 新轮次已开始:", uuid);
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
   获取用户规则产品 & 随机产品
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
   自动下单
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;

  try {
    await loadRoundConfig();

    if (!window.currentRoundId || isRoundExpired()) startNewRound();

    // 检查本轮已完成订单数
    const { data: roundOrders } = await supabaseClient
      .from("orders")
      .select("id,status")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId);
    const completedCount = roundOrders?.filter(o => o.status === "completed").length || 0;
    if (completedCount >= window.ORDERS_PER_ROUND) {
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
    if (pend?.length) { alert("您有未完成订单，请先完成订单再继续下单。"); ordering = false; return; }

    // 选择商品
    const { count: totalCountRes } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);
    const orderNumber = (totalCountRes?.count || 0) + 1;
    let product;
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
    localStorage.setItem("matchingEndTime", Date.now() + delaySec * 1000);
    localStorage.setItem("matchingProductId", product.id);

    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "下单失败");
  } finally { ordering = false; }
}

/* ======================
   匹配倒计时
   ====================== */
function startMatchingCountdown(product, delaySec) {
  const endTime = Date.now() + delaySec * 1000;
  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    setMatchingState(remaining > 0);
    if (remaining > 0) requestAnimationFrame(tick);
    else {
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
  if (!endTime || !productId) return;

  const remaining = Math.ceil((endTime - Date.now()) / 1000);
  supabaseClient.from("products").select("*").eq("id", productId).single()
    .then(({ data, error }) => { if (!error && data) { 
      if (remaining <= 0) finalizeMatchedOrder(data); 
      else startMatchingCountdown(data, remaining); 
    }});
}

/* ======================
   完成订单 & 渲染最近订单
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
    await updateRoundProgress();

  } catch (e) { alert(e.message || "完成订单失败"); }
  finally { completing = false; }
}

function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;
  const coins = Number(coinsRaw || 0);
  const price = Number(order.total_price || 0);
  const profit = Number(order.profit || 0);
  const profitRatio = Number(order.products?.profit || 0);
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
  setOrderBtnDisabled(!!pend?.length, pend?.length ? "存在未完成订单，请先完成订单" : "");
}

/* ======================
   本轮完成数更新
   ====================== */
async function updateRoundProgress() {
  if (!window.ORDERS_PER_ROUND || !window.ROUND_DURATION) await loadRoundConfig();
  const { data: orders } = await supabaseClient
    .from("orders")
    .select("status")
    .eq("user_id", window.currentUserId)
    .eq("round_id", window.currentRoundId);
  const completed = orders?.filter(o => o.status === "completed").length || 0;
  const el = document.getElementById("roundProgress");
  if (el) el.textContent = `本轮已完成订单：${completed} / ${window.ORDERS_PER_ROUND}`;
}

/* ======================
   最近订单加载
   ====================== */
async function loadLastOrder() {
  if (!window.currentUserId) return;
  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id,total_price,profit,status,created_at,products(name,profit)`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(1);
  const filterCol = window.currentUserUUID ? "uuid" : "id";
  const filterVal = window.currentUserUUID || window.currentUserId;
  const { data: user } = await supabaseClient.from("users").select("coins").eq(filterCol, filterVal).single();
  if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
  else document.getElementById("orderResult").innerHTML = "";
}

async function loadRecentOrders() {
  if (!window.currentUserId) return;
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
    if (!recentOrders?.length) list.innerHTML = "<li>暂无订单！</li>";
    else list.innerHTML = recentOrders.map(o => `<li>商品：${o.products?.name || "未知"} | 收入：+¥${Number(o.profit||0).toFixed(2)} | 状态：${o.status}</li>`).join("");
  }
}

/* ======================
   Coins 刷新
   ====================== */
async function refreshCoins() {
  if (!window.currentUserId) return;
  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();
  updateCoinsUI(user?.coins);
}

/* ======================
   一键刷新所有
   ====================== */
async function refreshAll() {
  await loadRoundConfig();
  await refreshCoins();
  await loadLastOrder();
  await loadRecentOrders();
  await checkPendingLock();
  await updateRoundProgress();
}

/* ======================
   页面初始化
   ====================== */
window.addEventListener("load", async () => {
  restoreMatchingIfAny();
  await refreshAll();
  const btn = document.getElementById("autoOrderBtn");
  if (btn) btn.addEventListener("click", autoOrder);
});
