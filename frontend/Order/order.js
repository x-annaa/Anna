/*
  order.server-driven.js
  全部后端驱动版：
  - 轮次 / 匹配时间 / 冷却 由 RPC 提供并写入数据库
  - 前端不再生成随机匹配时间、不再本地维护轮次
  - 前端负责：调用 RPC、显示倒计时、渲染 UI

  依赖的 RPC（你已经有或需要确保存在）：
  - rpc_auto_order(p_uid uuid) -> 返回 order info (order_id, product_id, product_name, total_price, profit, match_start_time, match_end_time, round_id, coins_after, cooldown ?)
  - rpc_complete_order(p_order_id int[, p_uid uuid]) -> 返回完成结果
  - rpc_user_round_status(p_user_uuid uuid) -> 返回 current_round_id, round_start_time, completed_count, orders_per_round, cooldown_start_time, cooldown_end_time, coins
*/

/* ====================== 1. 初始化用户信息 ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");
window.currentUserUUID = localStorage.getItem("currentUserUUID"); // 优先使用 UUID（后端 RPC 使用 uuid）
window.currentRoundId = null;   // 轮次由后端提供
window.roundStartTime = null;   // 轮次开始时间由后端提供
window.pendingOrderId = null;   // 当前未完成订单 id（若有）

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // 兑换中的并发保护
let timers = { cooldown: null, match: null }; // 管理倒计时

if (!window.supabaseClient) console.error("❌ supabaseClient 未初始化！");

/* ====================== 2. 保留的工具函数（略作调整） ====================== */
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
    // 冷却或 pending 会覆盖按钮状态，这里只做余额层面的解禁
    // 不要在此处强行 enable（避免覆盖冷却状态）
  }
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ====================== 3. 通用倒计时（server-driven） ====================== */
function clearTimer(name) {
  if (timers[name]) { clearInterval(timers[name]); timers[name] = null; }
}

function startCountdownTo(targetTimeISO, onTick, onEnd, timerName = 'general') {
  clearTimer(timerName);
  const endTs = new Date(targetTimeISO).getTime();
  if (isNaN(endTs)) { if (onEnd) onEnd(); return; }

  function tick() {
    const sec = Math.ceil((endTs - Date.now()) / 1000);
    if (sec <= 0) {
      clearTimer(timerName);
      if (onTick) onTick(0);
      if (onEnd) onEnd();
    } else {
      if (onTick) onTick(sec);
    }
  }
  tick();
  timers[timerName] = setInterval(tick, 1000);
}

/* ====================== 4. 从后端获取并渲染用户轮次/冷却状态 ====================== */
async function fetchUserRoundStatus() {
  if (!window.currentUserUUID) return;
  try {
    const { data, error } = await supabaseClient.rpc('rpc_user_round_status', { p_user_uuid: window.currentUserUUID });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    // 后端返回字段：current_round_id, round_start_time, completed_count, orders_per_round, cooldown_start_time, cooldown_end_time, coins
    window.currentRoundId = row.current_round_id || null;
    window.roundStartTime = row.round_start_time || null;

    // 更新 Coins UI
    if (typeof row.coins !== 'undefined') updateCoinsUI(row.coins);

    // 更新轮次进度显示（优先使用后端提供的 completed_count 和 orders_per_round）
    const completed = Number(row.completed_count || 0);
    const perRound = Number(row.orders_per_round || window.ORDERS_PER_ROUND || 3);
    const el = document.getElementById('roundProgress');
    if (el) el.textContent = `本轮已完成订单：${completed} / ${perRound}`;

    // 处理冷却（如果存在且未过期）
    if (row.cooldown_end_time) {
      const cdEnd = new Date(row.cooldown_end_time).getTime();
      if (cdEnd > Date.now()) {
        startCooldownTimer(row.cooldown_end_time, '服务器冷却');
      } else {
        clearTimer('cooldown');
        setOrderBtnDisabled(false);
      }
    } else {
      clearTimer('cooldown');
      setOrderBtnDisabled(false);
    }

  } catch (e) {
    console.error('fetchUserRoundStatus 失败', e);
  }
}

/* ====================== 5. 查询并恢复可能存在的 pending 订单（用于恢复匹配倒计时） ====================== */
async function fetchPendingOrderAndRestore() {
  if (!window.currentUserUUID) return;
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select(`id, product_id, total_price, profit, status, match_start_time, match_end_time, products (name, profit)`)
      .eq('user_uuid', window.currentUserUUID)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 may indicate no rows for .single()
      // If it's "not found" (single on empty), ignore; otherwise log
    }

    if (!data) {
      // 没有 pending 订单，确保匹配 UI 隐藏
      setMatchingState(false);
      window.pendingOrderId = null;
      clearTimer('match');
      return;
    }

    window.pendingOrderId = data.id;

    // 如果 match_end_time 未过，启动倒计时；否则刷新（可能需要服务端处理完成订单）
    if (data.match_end_time) {
      const endTs = new Date(data.match_end_time).getTime();
      if (endTs > Date.now()) {
        // 启动匹配倒计时（基于服务器的 match_end_time）
        setMatchingState(true);
        startCountdownTo(data.match_end_time, (sec) => {
          // tick: 显示剩余秒在页面（如果有元素）
          const el = document.getElementById('matchTimer');
          if (el) el.textContent = `匹配剩余：${formatTime(sec)}`;
        }, async () => {
          // 匹配结束 — 刷新最近订单/状态（后端应该已经插入订单为 pending 并记录 match_end_time）
          setMatchingState(false);
          await refreshAll();
        }, 'match');
      } else {
        // 匹配已过期（可能未生成订单或已生成），强制刷新
        await refreshAll();
      }
    } else {
      // 没有 match_end_time（异常），刷新
      await refreshAll();
    }

  } catch (e) {
    // single() 在没有数据时也会抛错，安全忽略
    // console.error('fetchPendingOrderAndRestore 错误', e);
  }
}

/* ====================== 6. 后端下单：rpc_auto_order（完全由服务器决定匹配时间与轮次） ====================== */
async function autoOrder() {
  if (!window.currentUserUUID) { alert('请先登录（需要 UUID）'); return; }
  if (ordering) return; ordering = true;

  try {
    // 直接请求服务器下单，服务器会：检查冷却、分配/开启轮次、扣币、插入 pending 订单、返回匹配时间
    const { data, error } = await supabaseClient.rpc('rpc_auto_order', { p_uid: window.currentUserUUID });
    if (error) throw error;
    const res = Array.isArray(data) ? data[0] : data;

    // 如果服务器返回 cooldown 标识（表示被阻止）
    if (res && (res.cooldown === true || res.cooldown === 't')) {
      // 服务器已在 users.cooldown_end_time 写值，刷新状态以获取 cooldown_end_time
      await fetchUserRoundStatus();
      alert('本轮已完成全部订单，进入冷却…');
      return;
    }

    // 正常下单：服务器返回 match_start_time/match_end_time + order_id 等
    if (res) {
      // 更新界面上的金币
      if (typeof res.coins_after !== 'undefined') updateCoinsUI(res.coins_after);

      // 如果有 match_end_time，启动基于服务器时间的倒计时
      if (res.match_end_time) {
        window.pendingOrderId = res.order_id || res.id || null;
        setMatchingState(true);
        startCountdownTo(res.match_end_time, (sec) => {
          const el = document.getElementById('matchTimer'); if (el) el.textContent = `匹配剩余：${formatTime(sec)}`;
        }, async () => {
          setMatchingState(false);
          // 匹配完成后刷新最近订单与轮次进度
          await refreshAll();
        }, 'match');
      }

      // 立即显示最近一次订单（服务器已创建 pending 记录，可直接加载）
      await loadLastOrder();
      await loadRecentOrders();
      await fetchUserRoundStatus();
    }

  } catch (e) {
    alert(e.message || '下单失败');
  } finally {
    ordering = false;
  }
}

/* ====================== 7. 完成订单（由服务器处理返币与冷却逻辑） ====================== */
async function completeOrderRemote(orderId) {
  if (completing) return; completing = true;
  if (!orderId) { completing = false; return; }

  // 尝试两种调用签名（有些函数定义只接受 p_order_id，有些接受 p_order_id 和 p_uid）
  const tryParams = [];
  if (window.currentUserUUID) tryParams.push({ p_order_id: orderId, p_uid: window.currentUserUUID });
  tryParams.push({ p_order_id: orderId });

  let lastErr = null;
  for (const params of tryParams) {
    try {
      const { data, error } = await supabaseClient.rpc('rpc_complete_order', params);
      if (error) throw error;
      const res = Array.isArray(data) ? data[0] : data;

      // 成功：刷新 UI
      await fetchUserRoundStatus();
      await loadLastOrder();
      await loadRecentOrders();
      await checkPendingLock();

      completing = false;
      return res;
    } catch (e) {
      lastErr = e;
      // 如果最后一次尝试仍然报错，向外抛
    }
  }

  completing = false;
  alert((lastErr && lastErr.message) ? lastErr.message : '完成订单失败');
}

/* ====================== 8. 替换旧的检查 pending/恢复逻辑（保留部分原功能） ====================== */
async function checkPendingLock() {
  // 使用后端存储的 round_id；仍然可通过查询 orders 表检查 pending
  if (!window.currentUserUUID) return;
  try {
    const { data: pend } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('user_uuid', window.currentUserUUID)
      .eq('status', 'pending')
      .limit(1);

    if (pend?.length) {
      setOrderBtnDisabled(true, '存在未完成订单，请先完成订单');
    } else {
      setOrderBtnDisabled(false);
    }
  } catch (e) {
    console.error('checkPendingLock 失败', e);
  }
}

/* ====================== 9. 保留/复用：加载与渲染订单相关的函数（尽量不修改） ====================== */
async function loadLastOrder() {
  if (!window.currentUserUUID) return;

  try {
    const { data: orders } = await supabaseClient
      .from('orders')
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq('user_uuid', window.currentUserUUID)
      .order('created_at', { ascending: false })
      .limit(1);

    const { data: user } = await supabaseClient
      .from('users')
      .select('coins')
      .eq('uuid', window.currentUserUUID)
      .single();

    if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
    else document.getElementById('orderResult').innerHTML = '';
  } catch (e) {
    console.error('loadLastOrder 错误', e);
  }
}

async function loadRecentOrders() {
  if (!window.currentUserUUID) return;
  try {
    const { data: recentOrders } = await supabaseClient
      .from('orders')
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq('user_uuid', window.currentUserUUID)
      .order('created_at', { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_uuid', window.currentUserUUID);

    const historyTitle = document.querySelector('.order-history h3');
    if (historyTitle) historyTitle.textContent = `🕘 最近订单 订单数：${totalCount || 0}单`;

    const list = document.getElementById('recentOrders');
    if (list) {
      if (!recentOrders?.length) list.innerHTML = `<li>暂无订单！</li>`;
      else list.innerHTML = recentOrders.map(o => {
        const price = Number(o.total_price) || 0;
        const profit = Number(o.profit) || 0;
        const profitRatio = Number(o.products?.profit) || 0;
        return `<li>🛒 ${o.products?.name || '未知商品'} / ¥${price.toFixed(2)} / 利润：${profitRatio} / 收入：+¥${profit.toFixed(2)} / 状态：${o.status === 'completed' ? '已完成' : '待完成'} / <small>${new Date(o.created_at).toLocaleString()}</small></li>`;
      }).join('');
    }
  } catch (e) {
    console.error('loadRecentOrders 错误', e);
  }
}

/* ====================== 10. renderLastOrder 保留但调整完成按钮行为 ====================== */
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

  if (order.status === 'pending' && coins >= 0) {
    html += `<button id="completeOrderBtn">完成订单</button>`;
  }
  if (coins < 0) {
    html += `<p style="color:red;">⚠️ 金币为负，欠款 ¥${Math.abs(coins).toFixed(2)}</p>`;
  }

  el.innerHTML = html;

  const compBtn = document.getElementById('completeOrderBtn');
  if (compBtn) {
    compBtn.addEventListener('click', async () => {
      compBtn.disabled = true;
      // 使用后端 rpc 完成订单
      await completeOrderRemote(order.id);
    });
  }
}

/* ====================== 11. 冷却倒计时（基于服务器时间） ====================== */
function startCooldownTimer(endTimeISO, messagePrefix = '冷却中，请等待') {
  clearTimer('cooldown');
  if (!endTimeISO) return;
  startCountdownTo(endTimeISO, (sec) => {
    setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余时间：${formatTime(sec)}`);
  }, async () => {
    setOrderBtnDisabled(false);
    await refreshAll();
  }, 'cooldown');
}

/* ====================== 12. setMatchingState 保留（控制 GIF / 按钮） ====================== */
function setMatchingState(isMatching) {
  const gifEl = document.getElementById('matchingGif');
  const btn = document.getElementById('autoOrderBtn');

  if (gifEl) gifEl.style.display = isMatching ? 'block' : 'none';
  if (btn) {
    btn.disabled = isMatching;
    btn.textContent = isMatching ? '🎲 正在匹配...' : '🎲 一键刷单';
  }
}

/* ====================== 13. 页面刷新时的统一恢复（替换旧的 restoreMatchingIfAny） ====================== */
async function refreshAll() {
  await loadRoundConfig();        // 可选：用于显示配置
  await loadCoinsOrderPage();     // Coins / Balance
  await loadLastOrder();
  await loadRecentOrders();
  await fetchUserRoundStatus();   // 检查轮次/冷却/coins
  await fetchPendingOrderAndRestore(); // 恢复匹配倒计时（如果存在 pending）
  await checkPendingLock();
}

/* ====================== 14. 事件绑定（保持原有绑定点） ====================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('autoOrderBtn')?.addEventListener('click', autoOrder);
  document.getElementById('addCoinsBtn')?.addEventListener('click', openExchangeModal);
  document.getElementById('cancelExchange')?.addEventListener('click', closeExchangeModal);
  document.getElementById('confirmExchange')?.addEventListener('click', confirmExchange);

  document.getElementById('balanceToCoinsBtn')?.addEventListener('click', () => toggleExchangeDirection('toCoins'));
  document.getElementById('coinsToBalanceBtn')?.addEventListener('click', () => toggleExchangeDirection('toBalance'));

  document.getElementById('addCoinsModal')?.addEventListener('click', (e) => { if (e.target.id === 'addCoinsModal') closeExchangeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeExchangeModal(); });

  // 页面初次加载时用后端驱动恢复状态
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
