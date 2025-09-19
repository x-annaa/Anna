/* ======================
   第1部分
   ====================== */

/* ======================
   用户信息 & 初始化
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID");
window.currentRoundId = localStorage.getItem("currentRoundId");
window.roundStartTime = localStorage.getItem("roundStartTime");

let ordering = false;
let cooldownTimer = null;

// 默认轮次配置
window.ORDERS_PER_ROUND = 3;
window.ROUND_DURATION_MINUTES = 5;
window.ROUND_DURATION = window.ROUND_DURATION_MINUTES * 60 * 1000;
window.MATCH_MIN_SECONDS = 5;
window.MATCH_MAX_SECONDS = 15;

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ======================
   读取轮次配置
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
   获取用户规则或随机商品
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
   自动下单 & 匹配倒计时
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
    if (coins < 50) {
      alert("你的余额不足，最少需要 50 coins");
      ordering = false;
      return;
    }

    // 检查是否有 pending 订单
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);

    if (pend?.length) {
      alert("您有未完成订单，请先完成订单再继续下单。");
      ordering = false;
      return;
    }

    // 选择商品
    const { count: totalOrdersRes } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);

    const orderNumber = (totalOrdersRes?.count || 0) + 1;
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

    // 保存匹配状态到本地存储
    const matchingEndTime = Date.now() + delaySec * 1000;
    localStorage.setItem("matchingEndTime", matchingEndTime);
    localStorage.setItem("matchingProductId", product.id);

    startMatchingCountdown(product, delaySec);

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   匹配倒计时函数
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
   页面刷新恢复匹配状态
   ====================== */
function restoreMatchingIfAny() {
  const endTime = Number(localStorage.getItem("matchingEndTime"));
  const productId = localStorage.getItem("matchingProductId");

  if (!endTime || !productId) return;

  const remaining = Math.ceil((endTime - Date.now()) / 1000);
  if (remaining <= 0) {
    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => { if (!error && data) finalizeMatchedOrder(data); });
    localStorage.removeItem("matchingEndTime");
    localStorage.removeItem("matchingProductId");
  } else {
    supabaseClient.from("products").select("*").eq("id", productId).single()
      .then(({ data, error }) => { if (!error && data) startMatchingCountdown(data, remaining); });
  }
}

document.addEventListener("DOMContentLoaded", restoreMatchingIfAny);

/* ======================
   第2部分
   ====================== */

/* ======================
   UI & 工具函数
   ====================== */
function setOrderBtnDisabled(disabled, reason = "", cooldownText = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason;
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
   渲染最近订单
   ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById("orderResult");
  if (!el || !order) return;

  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;
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
let completing = false;
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

    const currentCoins = Number(currentCoinsRaw || 0);
    const price = Number(order.total_price || 0);
    const profit = Number(order.profit || 0);
    const finalCoins = currentCoins + price + profit;

    // 更新订单状态
    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    // 更新用户 Coins
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
   Coins ↔ Balance 兑换
   ====================== */
let exchanging = false;
let currentExchangeDirection = "toCoins"; // toCoins 或 toBalance

function toggleExchangeDirection(dir) {
  currentExchangeDirection = dir;
  document.getElementById("balanceToCoinsBtn")?.classList.toggle("active", dir === "toCoins");
  document.getElementById("coinsToBalanceBtn")?.classList.toggle("active", dir === "toBalance");
}

function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  const input = document.getElementById("addCoinsInput");
  if (modal) { modal.style.display = "flex"; if(input) { input.value=""; setTimeout(()=>input.focus(),50); } }
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if(modal) modal.style.display = "none";
}

async function confirmExchange() {
  if(exchanging) return;
  exchanging = true;

  try {
    const inputEl = document.getElementById("addCoinsInput");
    const amount = parseFloat(inputEl?.value || "0");
    if(isNaN(amount) || amount <= 0) { alert("输入无效，请输入大于0的数值"); exchanging=false; return; }

    let filterCol = window.currentUserUUID ? "uuid":"id";
    let filterVal = window.currentUserUUID || window.currentUserId;
    if(!filterVal){ alert("请先登录！"); exchanging=false; return; }

    if(currentExchangeDirection==="toBalance"){
      const canEx = await canExchangeThisRound();
      if(!canEx){ alert(`⚠️ 需完成本轮 ${window.ORDERS_PER_ROUND} 单才能 Coins → Balance`); exchanging=false; return; }
    }

    const { data:user, error } = await supabaseClient
      .from("users")
      .select("coins,balance")
      .eq(filterCol,filterVal)
      .single();
    if(error || !user) throw new Error("加载用户信息失败");

    let coins = Number(user.coins||0);
    let balance = Number(user.balance||0);

    if(currentExchangeDirection==="toCoins"){
      if(balance<amount) throw new Error(`余额不足，当前 Balance：¥${balance.toFixed(2)}`);
      coins += amount; balance -= amount;
    }else{
      if(coins<amount) throw new Error(`Coins 不足，当前 Coins：${coins.toFixed(2)}`);
      coins -= amount; balance += amount;
    }

    const { error:updErr } = await supabaseClient
      .from("users")
      .update({ coins,balance })
      .eq(filterCol,filterVal);
    if(updErr) throw new Error("兑换失败："+updErr.message);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} ${currentExchangeDirection==="toCoins"?"Coins":"Balance"}`);
    updateCoinsUI(coins);
    document.getElementById("balance").textContent=balance.toFixed(2);
    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();
    closeExchangeModal();

  } catch(e){
    alert(e.message||"兑换失败");
  } finally { exchanging=false; }
}

/* ======================
   冷却倒计时
   ====================== */
function startCooldownTimer(nextAllowed,messagePrefix="冷却中，请等待") {
  if(!nextAllowed) return;
  const tick=()=>{
    const sec=Math.ceil((new Date(nextAllowed).getTime()-Date.now())/1000);
    if(sec<=0){
      clearInterval(cooldownTimer);
      setOrderBtnDisabled(false);
      startNewRound();
      updateRoundProgress();
      loadRecentOrders();
    }else{
      setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
    }
  };
  tick();
  if(cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer=setInterval(tick,1000);
}

/* ======================
   本轮 Coins → Balance 检查
   ====================== */
async function canExchangeThisRound(){
  if(!window.currentUserId || !window.currentRoundId) return false;
  try{
    const { data:completedOrders, error } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id",window.currentUserId)
      .eq("round_id",window.currentRoundId)
      .eq("status","completed");
    if(error) throw error;
    return (completedOrders?.length||0) >= window.ORDERS_PER_ROUND;
  }catch(e){ console.error("检查本轮兑换条件失败",e); return false; }
}

/* ======================
   最近订单 & 刷新页面
   ====================== */
async function loadLastOrder(){
  if(!window.currentUserId) return;
  const { data:orders } = await supabaseClient
    .from("orders")
    .select(`id,total_price,profit,status,created_at,products(name,profit)`)
    .eq("user_id",window.currentUserId)
    .order("created_at",{ascending:false})
    .limit(1);

  const filterCol=window.currentUserUUID?"uuid":"id";
  const filterVal=window.currentUserUUID||window.currentUserId;
  const { data:user } = await supabaseClient.from("users").select("coins").eq(filterCol,filterVal).single();

  if(orders?.length) renderLastOrder(orders[0], user?.coins??0);
  else document.getElementById("orderResult").innerHTML="";
}

async function loadRecentOrders(){
  if(!window.currentUserId) return;
  try{
    const { data:recentOrders } = await supabaseClient
      .from("orders")
      .select(`id,total_price,profit,status,created_at,products(name,profit)`)
      .eq("user_id",window.currentUserId)
      .order("created_at",{ascending:false})
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id",{count:"exact",head:true})
      .eq("user_id",window.currentUserId);

    const historyTitle=document.querySelector(".order-history h3");
    if(historyTitle) historyTitle.textContent=`🕘 最近订单 订单数：${totalCount||0}单`;

    const list=document.getElementById("recentOrders");
    if(list){
      if(!recentOrders?.length) list.innerHTML="<li>暂无订单！</li>";
      else list.innerHTML=recentOrders.map(o=>{
        const price=Number(o.total_price)||0;
        const profit=Number(o.profit)||0;
        const profitRatio=Number(o.products?.profit||0);
        return `<li>🛒 ${o.products?.name||"未知商品"} / ¥${price.toFixed(2)} / 利润：${profitRatio} / 收入：+¥${profit.toFixed(2)} / 状态：${o.status==="completed"?"已完成":"待完成"} / <small>${new Date(o.created_at).toLocaleString()}</small></li>`;
      }).join("");
    }
  }catch(e){ console.error("加载最近订单失败：",e); }
}

/* ======================
   页面初始化绑定
   ====================== */
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelExchange")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmExchange")?.addEventListener("click", confirmExchange);
  document.getElementById("balanceToCoinsBtn")?.addEventListener("click",()=>toggleExchangeDirection("toCoins"));
  document.getElementById("coinsToBalanceBtn")?.addEventListener("click",()=>toggleExchangeDirection("toBalance"));
  document.getElementById("addCoinsModal")?.addEventListener("click",(e)=>{ if(e.target.id==="addCoinsModal") closeExchangeModal(); });
  document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeExchangeModal(); });

  refreshAll();
});

async function refreshAll(){
  await loadRoundConfig();
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
  await checkPendingLock();
  await updateRoundProgress();
}

async function loadCoinsOrderPage(){
  if(!window.currentUserId) return;
  const filterCol=window.currentUserUUID?"uuid":"id";
  const filterVal=window.currentUserUUID||window.currentUserId;
  const { data,error } = await supabaseClient.from("users").select("coins,balance").eq(filterCol,filterVal).single();
  if(!error && data){
    updateCoinsUI(data.coins);
    const balEl=document.getElementById("balance");
    if(balEl) balEl.textContent=(Number(data.balance)||0).toFixed(2);
    await checkPendingLock();
  }
}
