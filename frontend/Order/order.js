/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID"); // UUID
window.currentRoundId = localStorage.getItem("currentRoundId");   // 当前轮次
window.roundStartTime = localStorage.getItem("roundStartTime");   // 当前轮次开始时间

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Coins/Balance 兑换并发保护
let cooldownTimer = null;  // 冷却计时器

window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION = 5 * 60 * 1000; // 毫秒

if (!window.supabaseClient) console.error("❌ supabaseClient 未初始化！");

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
  if (coins < 0) setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)})`);
  else setOrderBtnDisabled(false);
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function isRoundExpired() {
  return !window.roundStartTime || (Date.now() - Number(window.roundStartTime)) > window.ROUND_DURATION;
}

function startNewRound() {
  const uuid = crypto.randomUUID();
  window.currentRoundId = uuid;
  window.roundStartTime = Date.now();
  localStorage.setItem("currentRoundId", uuid);
  localStorage.setItem("roundStartTime", window.roundStartTime);
}

/* ======================
   加载轮次配置
   ====================== */
async function loadRoundConfig() {
  try {
    const { data, error } = await supabaseClient
      .from("round_config")
      .select("orders_per_round, round_duration")
      .limit(1)
      .single();
    if (!error && data) {
      window.ORDERS_PER_ROUND = Number(data.orders_per_round) || 3;
      window.ROUND_DURATION = (Number(data.round_duration) || 5 * 60) * 1000;
    }
  } catch (e) {
    console.error("加载轮次配置失败，使用默认值", e);
  }
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
  if (error) { console.error("读取手动规则失败", error); return null; }
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
   检查下单冷却
   ====================== */
async function checkOrderCooldown() {
  if (!window.currentUserId) return { allowed: true, next_allowed: null };
  try {
    const { data, error } = await supabaseClient
      .rpc("check_user_order_cooldown", { p_user_id: window.currentUserId });
    if (error) throw error;
    if (!data?.length) return { allowed: true, next_allowed: null };
    return { allowed: data[0].allowed, next_allowed: data[0].next_allowed };
  } catch (e) {
    console.error("检查冷却失败", e);
    return { allowed: true, next_allowed: null };
  }
}

/* ======================
   渲染最近订单
   ====================== */
async function renderLastOrder(order, coinsRaw) {
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
  if (coins < 0) html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    });
  }

  await renderCurrentRoundStatus();
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
   自动下单
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;

  try {
    await loadRoundConfig();

    const cooldown = await checkOrderCooldown();
    if (!cooldown.allowed) {
      const updateCooldown = () => {
        const sec = Math.ceil((new Date(cooldown.next_allowed) - new Date()) / 1000);
        if (sec <= 0) {
          clearInterval(cooldownTimer);
          setOrderBtnDisabled(false);
        } else {
          setOrderBtnDisabled(true, `冷却中，请等待 ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
        }
      };
      updateCooldown();
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = setInterval(updateCooldown, 1000);

      alert(`⚠️ 已达到下单上限，请等待 ${formatTime(Math.ceil((new Date(cooldown.next_allowed) - new Date()) / 1000))}`);
      return;
    }

    setOrderBtnDisabled(true, "下单中…");

    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);
    if (coins < 50) { alert(`余额不足，至少需要 50 coins`); setOrderBtnDisabled(false); return; }

    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) { alert("存在未完成订单"); await checkPendingLock(); return; }

    if (!window.currentRoundId || isRoundExpired()) startNewRound();

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId);
    const orderNumber = (orders?.length || 0) + 1;

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

    const price = Number(product.price) || 0;
    const profit = +(price * (Number(product.profit) || 0)).toFixed(2);
    const tempCoins = coins - price;

    await supabaseClient.from("users").update({ coins: tempCoins }).eq("id", window.currentUserId);

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending",
        round_id: window.currentRoundId
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    await renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();

  } catch (e) { alert(e.message || "下单失败"); }
  finally { ordering = false; }
}

/* ======================
   兑换 Coins ↔ Balance
   ====================== */
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

async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  try {
    const inputEl = document.getElementById("addCoinsInput");
    const amount = parseFloat(inputEl?.value || "0");
    if (isNaN(amount) || amount <= 0) { alert("输入无效"); return; }

    const filterCol = window.currentUserUUID ? "uuid" : "id";
    const filterVal = window.currentUserUUID || window.currentUserId;
    if (!filterVal) { alert("请先登录！"); return; }

    const isUUID = !!window.currentUserUUID;
    if (currentExchangeDirection === "toBalance" && !isUUID) { alert("仅支持 UUID 用户"); return; }

    if (currentExchangeDirection === "toBalance") {
      const canEx = await canExchangeThisRound();
      if (!canEx) { alert(`需要完成本轮 ${window.ORDERS_PER_ROUND} 订单才能兑换`); return; }
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
      if (balance < amount) throw new Error(`余额不足，当前 ${balance.toFixed(2)}`);
      coins += amount;
      balance -= amount;
    } else {
      if (coins < amount) throw new Error(`Coins 不足，当前 ${coins.toFixed(2)}`);
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
   加载页面数据
   ====================== */
async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;

  const filterCol = window.currentUserUUID ? "uuid" : "id";
  const filterVal = window.currentUserUUID || window.currentUserId;

  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq(filterCol, filterVal)
    .single();

  if (!error && data) {
    updateCoinsUI(data.coins);
    document.getElementById("balance").textContent = (Number(data.balance) || 0).toFixed(2);
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

  const filterCol = window.currentUserUUID ? "uuid" : "id";
  const filterVal = window.currentUserUUID || window.currentUserId;

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq(filterCol, filterVal)
    .single();

  if (orders?.length) await renderLastOrder(orders[0], user?.coins ?? 0);
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

    document.querySelector(".order-history h3")?.textContent =
      `🕘 最近订单 订单数：${totalCount || 0}单`;

    const list = document.getElementById("recentOrders");
    if (list) {
      list.innerHTML = recentOrders?.length
        ? recentOrders.map(o => {
            const price = Number(o.total_price) || 0;
            const profit = Number(o.profit) || 0;
            const profitRatio = Number(o.products?.profit) || 0;
            return `<li>🛒 ${o.products?.name || "未知"} ¥${price.toFixed(2)} +¥${profit.toFixed(2)} (${profitRatio}) ${o.status === "completed" ? "✅" : "⏳"} </li>`;
          }).join("")
        : "<li>暂无订单</li>";
    }
  } catch (e) { console.error("加载最近订单失败", e); }
}

/* ======================
   本轮状态
   ====================== */
async function renderCurrentRoundStatus() {
  if (!window.currentRoundId || !window.currentUserId) return;

  const { data: completedOrders } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("round_id", window.currentRoundId)
    .eq("status", "completed");

  const count = completedOrders?.length || 0;
  const el = document.getElementById("roundStatus");
  if (el) el.textContent = `本轮完成订单：${count}/${window.ORDERS_PER_ROUND}`;
}

/* ======================
   完成订单
   ====================== */
async function completeOrder(order, coins) {
  if (!order || completing) return;
  completing = true;

  try {
    const { error } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id);
    if (error) throw error;

    coins += Number(order.profit || 0);
    await supabaseClient.from("users").update({ coins }).eq("id", window.currentUserId);

    await renderLastOrder({ ...order, status: "completed" }, coins);
    updateCoinsUI(coins);
    await renderCurrentRoundStatus();
    await loadRecentOrders();
    await checkPendingLock();
  } catch (e) { alert("完成订单失败：" + e.message); }
  finally { completing = false; }
}

/* ======================
   页面事件绑定
   ====================== */
document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
document.getElementById("balanceToCoinsBtn")?.addEventListener("click", () => toggleExchangeDirection("toCoins"));
document.getElementById("coinsToBalanceBtn")?.addEventListener("click", () => toggleExchangeDirection("toBalance"));
document.getElementById("addCoinsConfirmBtn")?.addEventListener("click", confirmExchange);
document.getElementById("addCoinsCloseBtn")?.addEventListener("click", closeExchangeModal);

/* ======================
   页面初始化
   ====================== */
(async function initPage() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
  await renderCurrentRoundStatus();
})();
