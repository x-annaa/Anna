window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID");
window.currentRoundId = localStorage.getItem("currentRoundId");
window.roundStartTime = localStorage.getItem("roundStartTime");

let ordering = false;
let completing = false;
let exchanging = false;
let cooldownTimer = null;

window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION = 5 * 60 * 1000;

if (!window.supabaseClient) {
  console.error("supabaseClient Not initialized!");
}

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

      console.log("Configuration loaded：", {
        ORDERS_PER_ROUND: window.ORDERS_PER_ROUND,
        ROUND_DURATION_MINUTES: window.ROUND_DURATION_MINUTES,
        MATCH_MIN: window.MATCH_MIN_SECONDS,
        MATCH_MAX: window.MATCH_MAX_SECONDS,
      });
    }
  } catch (e) {
    console.error("Failed to read configuration", e.message);
    if (!window.ORDERS_PER_ROUND) window.ORDERS_PER_ROUND = 3;
    if (!window.ROUND_DURATION_MINUTES) window.ROUND_DURATION_MINUTES = 5;
    if (!window.MATCH_MIN_SECONDS) window.MATCH_MIN_SECONDS = 5;
    if (!window.MATCH_MAX_SECONDS) window.MATCH_MAX_SECONDS = 15;
  }
}

function setOrderBtnDisabled(disabled, reason = "", cooldownText = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? `Order` : "Order";
  }
  const cdEl = document.getElementById("cooldownDisplay");
  if (cdEl) cdEl.textContent = cooldownText;
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);

  if (coins < 0) {
    setOrderBtnDisabled(true, `Coins are negative（Arrears $${Math.abs(coins).toFixed(2)}）`);
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

function startNewRound() {
  const uuid = crypto.randomUUID();
  window.currentRoundId = uuid;
  window.roundStartTime = Date.now();
  localStorage.setItem("currentRoundId", uuid);
  localStorage.setItem("roundStartTime", window.roundStartTime);
}

async function getUserRuleProduct(userId, orderNumber) {
  const { data: rules, error } = await supabaseClient
    .from("user_product_rules")
    .select("product_id")
    .eq("user_id", userId)
    .eq("order_number", orderNumber)
    .eq("enabled", true)
    .limit(1);
  if (error) { console.error("Failed to read manual rules", error); return null; }
  return rules?.[0]?.product_id || null;
}

async function getRandomProduct() {
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);
  if (error || !products?.length) throw new Error("The product list is empty or failed to load!");
  return products[Math.floor(Math.random() * products.length)];
}

function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

function isRoundExpired() {
  if (!window.roundStartTime) return true;
  return (Date.now() - Number(window.roundStartTime)) > window.ROUND_DURATION;
}

function startNewRound() {
  const uuid = generateUUID();
  window.currentRoundId = uuid;
  window.roundStartTime = Date.now();
  localStorage.setItem("currentRoundId", uuid);
  localStorage.setItem("roundStartTime", window.roundStartTime);
}

async function updateRoundProgress() {
  if (!window.ORDERS_PER_ROUND || !window.ROUND_DURATION_MINUTES) {
    await loadRoundConfig();
  }
  
  try {
    let query = supabaseClient
      .from("orders")
      .select("id, status")
      .eq("user_id", window.currentUserId);

    if (window.currentRoundId) {

      query = query.eq("round_id", window.currentRoundId);
    } else {

      query = query.is("round_id", null);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const completed = orders?.filter(o => o.status === "completed").length || 0;
    const el = document.getElementById("roundProgress");
    if (el) el.textContent = `Round：${completed} / ${window.ORDERS_PER_ROUND}`;
  } catch (e) {
    console.error("Failed to update this round's progress：", e.message);
  }
}

function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0; 
  const profitRatio = Number(order.products?.profit) || 0; 
  const productUrl = order.products?.url || "";

  let html = `
    <div style="display:flex; align-items:center; gap:20px;">
      ${productUrl ? `<img src="${productUrl}" alt="${order.products?.name || ''}">` : ''}
      <div class="order-info">
        <p style="font-weight:700; font-size:15px;">
          ${order.products?.name || "Unknown product"}
        </p>
        <p>Price：$${price.toFixed(2)}</p>
        <p>Profit：${profitRatio}</p>
        <p>Income：+$${profit.toFixed(2)}</p>
        <p>State：${order.status === "completed" ? "✅ Done" : "⏳ To be completed"}</p>
        ${order.status === "pending" && coins >= 0 ? '<button id="completeOrderBtn">Complete order</button>' : ''}
        ${coins < 0 ? `<p style="color:red;">Coins not enough $${Math.abs(coins).toFixed(2)}</p>` : ''}
      </div>
    </div>
  `;

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order, coins);
    });
  }
}

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
    await updateRoundProgress();
  } catch (e) {
    alert(e.message || "Failed to complete order");
  } finally {
    completing = false;
  }
}

async function checkPendingLock() {
  if (!window.currentUserId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", window.currentUserId)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) {
    setOrderBtnDisabled(true, "There are incomplete orders. Please complete your orders first.");
  } else {
    setOrderBtnDisabled(false);
  }
}

async function autoOrder() {
  if (!window.currentUserId) {
    alert("Please log in first!");
    return;
  }
  if (ordering) return;
  ordering = true;

  try {
    await loadRoundConfig();

    if (!window.currentRoundId) startNewRound();

    const { data: roundOrders } = await supabaseClient
      .from("orders")
      .select("id,status")
      .eq("user_id", window.currentUserId)
      .eq("round_id", window.currentRoundId);

    const completedCount = roundOrders?.filter(o => o.status === "completed").length || 0;

    if (completedCount >= window.ORDERS_PER_ROUND) {

      const nextAllowed = Number(window.roundStartTime) + window.ROUND_DURATION;
      startCooldownTimer(nextAllowed, "All orders for this round have been completed and are currently in a cooling-off period. Please wait.");
      alert("All orders for this round have been completed and are now in the cooling-off period");
      ordering = false;
      return;
    }

    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);
    if (coins < 50) {
      alert("Your balance is insufficient; you need at least 50 coins.");
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("You have an incomplete order. Please complete your order before placing another order.");
      await checkPendingLock();
      ordering = false;
      return;
    }

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

    let delaySec = Math.floor(
      Math.random() * (window.MATCH_MAX_SECONDS - window.MATCH_MIN_SECONDS + 1)
    ) + window.MATCH_MIN_SECONDS;

    const matchingEndTime = Date.now() + delaySec * 1000;
    localStorage.setItem("matchingEndTime", matchingEndTime);
    localStorage.setItem("matchingProductId", product.id);

    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "Order failed");
    setMatchingState(false);
  } finally {
    ordering = false;
  }
}


function startMatchingCountdown(product, delaySec) {
  const endTime = Date.now() + delaySec * 1000;
  const btn = document.getElementById("autoOrderBtn");
  const gifEl = document.getElementById("matchingGif");

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

function restoreMatchingIfAny() {
  const endTime = Number(localStorage.getItem("matchingEndTime"));
  const productId = localStorage.getItem("matchingProductId");

  if (endTime && productId && endTime > Date.now()) {
    const delaySec = Math.ceil((endTime - Date.now()) / 1000);

    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => {
        if (!error && data) startMatchingCountdown(data, delaySec);
      });
  } else if (endTime && productId) {

    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => { if (!error && data) finalizeMatchedOrder(data); });
    localStorage.removeItem("matchingEndTime");
    localStorage.removeItem("matchingProductId");
  }
}

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
      .select(`id, total_price, profit, status, created_at, products ( name, profit, url )`) 
      .single();

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();
    await updateRoundProgress();

  } catch (e) {
    alert(e.message || "Failed to generate order");
  }
}

document.addEventListener("DOMContentLoaded", restoreMatchingIfAny);

function startCooldownTimer(nextAllowed, messagePrefix = "Cooling down") {
  if (!nextAllowed) return;

  const tick = () => {
    const sec = Math.ceil((new Date(nextAllowed).getTime() - Date.now()) / 1000);
    if (sec <= 0) {
      clearInterval(cooldownTimer);
      setOrderBtnDisabled(false, "", "");
      startNewRound();
      updateRoundProgress();
      loadRecentOrders();
    } else {
      setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `Cooling time remaining：${formatTime(sec)}`);
    }
  };

  tick();
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(tick, 1000);
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
    console.error("Checking the redemption conditions for this round failed.", e);
    return false;
  }
}

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
    alert("Invalid input. Please enter a value greater than 0."); 
    exchanging = false; 
    return; 
  }

  let filterCol = window.currentUserUUID ? "uuid" : "id";
  let filterVal = window.currentUserUUID || window.currentUserId;

  if (!filterVal) { 
    alert("Please log in first!"); 
    exchanging = false; 
    return; 
  }

  const isUUID = !!window.currentUserUUID;

  try {
    if (currentExchangeDirection === "toBalance" && !isUUID) {
      alert("⚠️ Coins → Balance This feature is only available to UUID users!");
      exchanging = false;
      return;
    }

    if (currentExchangeDirection === "toBalance") {
      const canEx = await canExchangeThisRound();
      if (!canEx) {
        alert(`⚠️ This round needs to be completed. ${window.ORDERS_PER_ROUND}/${window.ORDERS_PER_ROUND} Can be used only after ordering Coins → Balance Function！`);
        exchanging = false;
        return;
      }
    }

    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins,balance")
      .eq(filterCol, filterVal)
      .single();
    if (error || !user) throw new Error("Failed to load user information");

    let coins = Number(user.coins) || 0;
    let balance = Number(user.balance) || 0;

    if (currentExchangeDirection === "toCoins") {
      if (balance < amount) throw new Error(`Insufficient balance：$${balance.toFixed(2)}`);
      coins += amount;
      balance -= amount;
    } else {
      if (coins < amount) throw new Error(`Coins insufficient, currently Coins：${coins.toFixed(2)}`);
      coins -= amount;
      balance += amount;
    }

    const { error: updErr } = await supabaseClient
      .from("users")
      .update({ coins, balance })
      .eq(filterCol, filterVal);
    if (updErr) throw new Error("Redemption failed：" + updErr.message);

    alert(`Successful redemption ${amount.toFixed(2)} ${currentExchangeDirection === "toCoins" ? "Coins" : "Balance"}`);
    document.getElementById("ordercoins").textContent = coins.toFixed(2);
    document.getElementById("balance").textContent = balance.toFixed(2);
    updateCoinsUI(coins);

    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();
    closeExchangeModal();

  } catch (e) {
    alert(e.message || "Redemption failed");
  } finally {
    exchanging = false;
  }
}

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
    .select(`id, total_price, profit, status, created_at, products ( name, profit, url )`)
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
      .select(`id, total_price, profit, status, created_at, products ( name, profit, url )`)
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);

    const historyTitle = document.querySelector(".order-history h3");
    if (historyTitle) historyTitle.textContent = `Recent Orders Number of Orders：${totalCount || 0}`;

    const list = document.getElementById("recentOrders");
    if (list) {
      if (!recentOrders?.length) list.innerHTML = `<li>No orders yet!</li>`;
      else list.innerHTML = recentOrders.map(o => {
        const price = Number(o.total_price) || 0;
        const profit = Number(o.profit) || 0;
        const profitRatio = Number(o.products?.profit) || 0;
        return `<li>🛒 ${o.products?.name || "Unknown product"} / $${price.toFixed(2)} / Profit：${profitRatio} / Income：+¥${profit.toFixed(2)} / State：${o.status === "completed" ? "Done" : "To be completed"} / <small>${new Date(o.created_at).toLocaleString()}</small></li>`;
      }).join("");
    }
  } catch (e) {
    console.error("Failed to load recent orders：", e);
  }
}

function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const fixedImg = document.getElementById("fixedImg");
  const btn = document.getElementById("autoOrderBtn");

  if (gifEl && fixedImg) {
    gifEl.style.display = isMatching ? "block" : "none";
    fixedImg.style.display = isMatching ? "none" : "block";
  }

  if (btn) {
    btn.disabled = isMatching;
    btn.textContent = isMatching ? "Ordering" : "Order";
  }
}

document.addEventListener("DOMContentLoaded", () => {


  // History 按钮
  const historyBtn = document.querySelector(".left-box");
  const historyModal = document.getElementById("historyModal");


  if(historyBtn && historyModal){

    historyBtn.onclick = async () => {

      historyModal.style.display = "flex";

      const listEl = document.getElementById("orderHistoryList");

      if(listEl){
        listEl.innerHTML = "<li>Loading...</li>";
      }

    };

  }



  // Rules 按钮
  const rulesBtn = document.querySelector(".right-box");
  const rulesModal = document.getElementById("rulesModal");


  if(rulesBtn && rulesModal){

    rulesBtn.onclick = () => {

      rulesModal.style.display = "flex";

    };

  }



  // 关闭 History
  document.getElementById("closeHistoryBtn")?.addEventListener("click",()=>{

    if(historyModal){
      historyModal.style.display="none";
    }

  });



  // 关闭 Rules
  document.getElementById("closeRulesBtn")?.addEventListener("click",()=>{

    if(rulesModal){
      rulesModal.style.display="none";
    }

  });



});
