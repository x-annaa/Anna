/*
  order.server-driven.js - 完整可用版
  ✅ 后端驱动轮次 / 匹配时间 / 冷却
  ✅ 前端只负责：调用 RPC、显示倒计时、渲染 UI、Coins/Balance 兑换
*/

/* ====================== 1. 初始化用户信息 ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUserUUID = localStorage.getItem("currentUserUUID");
window.currentRoundId = null;
window.roundStartTime = null;
window.pendingOrderId = null;
window.currentRoundCompleted = 0;

let ordering = false;
let completing = false;
let exchanging = false;
let timers = { cooldown: null, match: null };

if (!window.supabaseClient) console.error("❌ supabaseClient 未初始化！");

/* ====================== 2. 工具函数 ====================== */
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

function clearTimer(name) {
  if (timers[name]) { clearInterval(timers[name]); timers[name] = null; }
}

function startCountdownTo(targetTimeISO, onTick, onEnd, timerName = 'general') {
  clearTimer(timerName);
  const endTs = new Date(targetTimeISO).getTime();
  if (isNaN(endTs)) { if (onEnd) onEnd(); return; }
  function tick() {
    const sec = Math.ceil((endTs - Date.now()) / 1000);
    if (sec <= 0) { clearTimer(timerName); if (onTick) onTick(0); if (onEnd) onEnd(); }
    else if (onTick) onTick(sec);
  }
  tick();
  timers[timerName] = setInterval(tick, 1000);
}

/* ====================== 3. 更新本轮进度 ====================== */
function updateRoundProgress() {
  const el = document.getElementById('roundProgress');
  if (!el) return;
  const completed = Number(window.currentRoundCompleted || 0);
  const perRound = Number(window.ORDERS_PER_ROUND || 3);
  el.textContent = `本轮已完成订单：${completed} / ${perRound}`;
}

/* ====================== 4. 获取用户轮次/冷却状态 ====================== */
async function fetchUserRoundStatus() {
  if (!window.currentUserUUID) return;
  try {
    const { data, error } = await supabaseClient.rpc('rpc_user_round_status', { p_user_uuid: window.currentUserUUID });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    window.currentRoundId = row.current_round_id || null;
    window.roundStartTime = row.round_start_time || null;
    window.currentRoundCompleted = Number(row.completed_count || 0);

    if (typeof row.coins !== 'undefined') updateCoinsUI(row.coins);
    updateRoundProgress();

    if (row.cooldown_end_time) {
      const cdEnd = new Date(row.cooldown_end_time).getTime();
      if (cdEnd > Date.now()) startCooldownTimer(row.cooldown_end_time, '服务器冷却');
      else { clearTimer('cooldown'); setOrderBtnDisabled(false); }
    } else { clearTimer('cooldown'); setOrderBtnDisabled(false); }
  } catch (e) { console.error('fetchUserRoundStatus 失败', e); }
}

/* ====================== 5. 恢复 pending 订单 ====================== */
async function fetchPendingOrderAndRestore() {
  if (!window.currentUserUUID) return;
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select(`id, match_end_time`)
      .eq('user_id', window.currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) { setMatchingState(false); window.pendingOrderId = null; clearTimer('match'); return; }

    window.pendingOrderId = data.id;
    if (data.match_end_time && new Date(data.match_end_time).getTime() > Date.now()) {
      setMatchingState(true);
      startCountdownTo(data.match_end_time, sec => {
        const el = document.getElementById('matchTimer'); if (el) el.textContent = `匹配剩余：${formatTime(sec)}`;
      }, async () => { setMatchingState(false); await refreshAll(); }, 'match');
    } else await refreshAll();
  } catch (e) { /* 忽略 */ }
}

/* ====================== 6. 后端下单 ====================== */
async function autoOrder() {
  if (!window.currentUserUUID) { alert('请先登录（需要 UUID）'); return; }
  if (ordering) return; ordering = true;

  try {
    const { data, error } = await supabaseClient.rpc('rpc_auto_order', { p_uid: window.currentUserUUID });
    if (error) throw error;
    const res = Array.isArray(data) ? data[0] : data;

    if (res?.cooldown === true || res?.cooldown === 't') {
      await fetchUserRoundStatus();
      alert('本轮已完成全部订单，进入冷却…');
      return;
    }

    if (res) {
      if (typeof res.coins_after !== 'undefined') updateCoinsUI(res.coins_after);
      if (res.match_end_time) {
        window.pendingOrderId = res.order_id || res.id || null;
        setMatchingState(true);
        startCountdownTo(res.match_end_time, sec => {
          const el = document.getElementById('matchTimer'); if (el) el.textContent = `匹配剩余：${formatTime(sec)}`;
        }, async () => { setMatchingState(false); await refreshAll(); }, 'match');
      }
      await loadLastOrder();
      await loadRecentOrders();
      await fetchUserRoundStatus();
    }
  } catch (e) { alert(e.message || '下单失败'); }
  finally { ordering = false; }
}

/* ====================== 7. 完成订单 ====================== */
async function completeOrderRemote(orderId) {
  if (completing) return; completing = true;
  if (!orderId) { completing = false; return; }

  const tryParams = [];
  if (window.currentUserUUID) tryParams.push({ p_order_id: orderId, p_uid: window.currentUserUUID });
  tryParams.push({ p_order_id: orderId });

  let lastErr = null;
  for (const params of tryParams) {
    try {
      const { data, error } = await supabaseClient.rpc('rpc_complete_order', params);
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;

      // 更新全局缓存完成数
      window.currentRoundCompleted = (window.currentRoundCompleted || 0) + 1;
      updateRoundProgress();

      await fetchUserRoundStatus();
      await loadLastOrder();
      await loadRecentOrders();
      await checkPendingLock();
      completing = false;
      return res;
    } catch (e) { lastErr = e; }
  }

  completing = false;
  alert((lastErr && lastErr.message) ? lastErr.message : '完成订单失败');
}

/* ====================== 8. 检查 pending 锁 ====================== */
async function checkPendingLock() {
  if (!window.currentUserUUID) return;
  try {
    const { data: pend } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('user_id', window.currentUserId)
      .eq('status', 'pending')
      .limit(1);

    if (pend?.length) setOrderBtnDisabled(true, '存在未完成订单，请先完成订单');
    else setOrderBtnDisabled(false);
  } catch (e) { console.error('checkPendingLock 失败', e); }
}

/* ====================== 9. 加载订单 ====================== */
async function loadLastOrder() {
  if (!window.currentUserUUID) return;
  try {
    const { data: orders } = await supabaseClient
      .from('orders')
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq("user_uuid", window.currentUserUUID)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: user } = await supabaseClient
      .from('users')
      .select('coins')
      .eq("uuid", window.currentUserUUID)
      .single();

    if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
    else document.getElementById("orderResult").innerHTML = "";
  } catch (e) { console.error('loadLastOrder 错误', e); }
}

async function loadRecentOrders() {
  if (!window.currentUserUUID) return;
  try {
    const { data: recentOrders } = await supabaseClient
      .from('orders')
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq("user_uuid", window.currentUserUUID)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from('orders')
      .select("id", { count: "exact", head: true })
      .eq("user_uuid", window.currentUserUUID);

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
  } catch (e) { console.error("加载最近订单失败：", e); }
}

/* ====================== 10. 渲染最近订单 ====================== */
function renderLastOrder(order, coinsRaw) {
  const el = document.getElementById('orderResult');
  if (!el || !order) return;
  const coins = Number(coinsRaw) || 0;
  const price = Number(order.total_price) || 0;
  const profit = Number(order.profit) || 0;
  const profitRatio = Number(order.products?.profit) || 0;

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || '未知商品'}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润率：${profitRatio}</p>
    <p>收入：+¥${profit.toFixed(2)}</p>
    <p>状态：${order.status === 'completed' ? '✅ 已完成' : '⏳ 待完成'}</p>
    <p>时间：${new Date(order.created_at).toLocaleString()}</p>
    <p>当前金币：¥${coins.toFixed(2)}</p>
  `;

  if (order.status === 'pending' && coins >= 0) html += `<button id="completeOrderBtn">完成订单</button>`;
  if (coins < 0) html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;

  el.innerHTML = html;

  const compBtn = document.getElementById('completeOrderBtn');
  if (compBtn) compBtn.addEventListener('click', async () => { compBtn.disabled = true; await completeOrderRemote(order.id); });
}

/* ====================== 11. 冷却倒计时 ====================== */
function startCooldownTimer(endTimeISO, messagePrefix = '冷却中，请等待') {
  clearTimer('cooldown');
  if (!endTimeISO) return;
  startCountdownTo(endTimeISO, sec => {
    setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
  }, async () => { setOrderBtnDisabled(false); await refreshAll(); }, 'cooldown');
}

/* ====================== 12. 匹配状态 GIF ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const btn = document.getElementById("autoOrderBtn");
  if (gifEl) gifEl.style.display = isMatching ? "block" : "none";
  if (btn) { btn.disabled = isMatching; btn.textContent = isMatching ? "🎲 正在匹配..." : "🎲 一键刷单"; }
}

/* ====================== 13. 页面刷新统一恢复 ====================== */
async function refreshAll() {
  await loadLastOrder();
  await loadRecentOrders();
  await fetchUserRoundStatus();
  await fetchPendingOrderAndRestore();
  await checkPendingLock();
}

/* ====================== 14. 页面事件绑定 ====================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('autoOrderBtn')?.addEventListener('click', autoOrder);
  document.getElementById('addCoinsBtn')?.addEventListener('click', openExchangeModal);
  document.getElementById('cancelExchange')?.addEventListener('click', closeExchangeModal);
  document.getElementById('confirmExchange')?.addEventListener('click', confirmExchange);

  document.getElementById("balanceToCoinsBtn")?.addEventListener("click", () => toggleExchangeDirection("toCoins"));
  document.getElementById("coinsToBalanceBtn")?.addEventListener("click", () => toggleExchangeDirection("toBalance"));

  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addCoinsModal") closeExchangeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeExchangeModal(); });

  refreshAll();
});


/* ====================== 15.冷却倒计时函数 ====================== */
function startCooldownTimer(nextAllowed, messagePrefix = "冷却中，请等待") {
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
      setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
    }
  };

  tick();
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(tick, 1000);
}

/* ====================== 16.检查本轮 Coins → Balance 是否可用 ====================== */
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

/* ====================== 17.兑换逻辑 Coins ↔ Balance ====================== */
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

/* ====================== 18.页面事件绑定 ====================== */
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

/* ====================== 19.页面刷新工具 ====================== */
async function refreshAll() {
  // await loadRoundConfig();  // ← 删除这一行
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
  await checkPendingLock();
  await updateRoundProgress?.(); // 如果有进度条更新函数
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

/* ====================== 20.显示/隐藏匹配状态 & GIF ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById("matchingGif");
  const btn = document.getElementById("autoOrderBtn");

  if (gifEl) gifEl.style.display = isMatching ? "block" : "none";
  if (btn) {
    btn.disabled = isMatching;
    btn.textContent = isMatching ? "🎲 正在匹配..." : "🎲 一键刷单";
  }
}

/* ====================== 21. 更新本轮进度 ====================== */
function updateRoundProgress() {
  const el = document.getElementById('roundProgress');
  if (!el) return;

  // 尝试从全局缓存获取
  const completed = Number(window.currentRoundCompleted || 0);
  const perRound = Number(window.ORDERS_PER_ROUND || 3);

  el.textContent = `本轮已完成订单：${completed} / ${perRound}`;
}

/* ====================== 22. 实时冷却倒计时整合 ====================== */
function startRealtimeCooldown(endTimeISO, messagePrefix = '冷却中，请等待') {
  // 清理旧计时器
  clearTimer('cooldown');
  if (!endTimeISO) {
    setOrderBtnDisabled(false);
    return;
  }

  const endTs = new Date(endTimeISO).getTime();
  if (isNaN(endTs) || endTs <= Date.now()) {
    setOrderBtnDisabled(false);
    return;
  }

  // 每秒刷新
  function tick() {
    const remainingSec = Math.ceil((endTs - Date.now()) / 1000);
    if (remainingSec <= 0) {
      clearTimer('cooldown');
      setOrderBtnDisabled(false);
      // 冷却结束后刷新状态
      fetchUserRoundStatus();
      return;
    }
    const formatted = formatTime(remainingSec);
    setOrderBtnDisabled(true, `${messagePrefix} ${formatted}`, `冷却剩余时间：${formatted}`);
  }

  tick();
  timers.cooldown = setInterval(tick, 1000);
}

// 修改 fetchUserRoundStatus 内的冷却逻辑调用
async function fetchUserRoundStatus() {
  if (!window.currentUserUUID) return;
  try {
    const { data, error } = await supabaseClient.rpc('rpc_user_round_status', { p_user_uuid: window.currentUserUUID });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    window.currentRoundId = row.current_round_id || null;
    window.roundStartTime = row.round_start_time || null;
    window.currentRoundCompleted = Number(row.completed_count || 0);

    if (typeof row.coins !== 'undefined') updateCoinsUI(row.coins);
    updateRoundProgress();

    if (row.cooldown_end_time) {
      startRealtimeCooldown(row.cooldown_end_time, '冷却中，请等待');
    } else {
      clearTimer('cooldown');
      setOrderBtnDisabled(false);
    }
  } catch (e) {
    console.error('fetchUserRoundStatus 失败', e);
  }
}
