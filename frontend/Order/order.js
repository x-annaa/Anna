/* ====================== 全局变量 ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUserUUID = localStorage.getItem("currentUserUUID");
window.currentRoundId = null;
window.roundStartTime = null;
window.pendingOrderId = null;
window.currentRoundCompleted = 0;
window.ORDERS_PER_ROUND = 3;

let ordering = false;
let completing = false;
let exchanging = false;
let timers = { cooldown: null, match: null };

/* ====================== 工具函数 ====================== */
function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2,"0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2,"0");
  const s = String(sec % 60).padStart(2,"0");
  return `${h}:${m}:${s}`;
}

function clearTimer(name) {
  if (timers[name]) { clearInterval(timers[name]); timers[name] = null; }
}

function setOrderBtnDisabled(disabled, reason="", cooldownText="") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) { btn.disabled = disabled; btn.textContent = disabled ? `🎲 一键刷单（不可用）` : "🎲 一键刷单"; btn.title = reason; }
  const cdEl = document.getElementById("cooldownDisplay");
  if (cdEl) cdEl.textContent = cooldownText;
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);
  if (coins < 0) setOrderBtnDisabled(true, `金币为负（欠款 ¥${Math.abs(coins).toFixed(2)}）`);
}

/* ====================== 冷却倒计时 ====================== */
function startCooldownTimer(endTimeISO, messagePrefix = "冷却中，请等待") {
  clearTimer('cooldown');
  if (!endTimeISO) return;
  const endTs = new Date(endTimeISO).getTime();
  function tick() {
    const sec = Math.ceil((endTs - Date.now())/1000);
    if (sec <=0) { clearTimer('cooldown'); setOrderBtnDisabled(false); fetchUserRoundStatus(); return; }
    setOrderBtnDisabled(true, `${messagePrefix} ${formatTime(sec)}`, `冷却剩余：${formatTime(sec)}`);
  }
  tick();
  timers.cooldown = setInterval(tick,1000);
}

/* ====================== 匹配倒计时 ====================== */
function startMatchTimer(endTimeISO, onEnd) {
  clearTimer('match');
  if (!endTimeISO) return;
  const endTs = new Date(endTimeISO).getTime();
  function tick() {
    const sec = Math.ceil((endTs - Date.now())/1000);
    const el = document.getElementById('matchTimer');
    if (sec <= 0) { clearTimer('match'); if (el) el.textContent = ""; if (onEnd) onEnd(); return; }
    if (el) el.textContent = `匹配剩余：${formatTime(sec)}`;
  }
  tick();
  timers.match = setInterval(tick,1000);
}

/* ====================== 更新本轮进度 ====================== */
function updateRoundProgress() {
  const el = document.getElementById('roundProgress');
  if (!el) return;
  const completed = Number(window.currentRoundCompleted||0);
  const perRound = Number(window.ORDERS_PER_ROUND||3);
  el.textContent = `本轮已完成订单：${completed} / ${perRound}`;
}

/* ====================== 获取用户轮次/冷却状态 ====================== */
async function fetchUserRoundStatus() {
  if (!window.currentUserUUID) return;
  try {
    const { data, error } = await supabaseClient.rpc('rpc_user_round_status', { p_user_uuid: window.currentUserUUID });
    if (error) throw error;
    const row = Array.isArray(data)?data[0]:data;
    if (!row) return;

    window.currentRoundId = row.current_round_id || null;
    window.roundStartTime = row.round_start_time || null;
    window.currentRoundCompleted = Number(row.completed_count||0);
    if (typeof row.coins !== 'undefined') updateCoinsUI(row.coins);
    updateRoundProgress();

    if (row.cooldown_end_time && new Date(row.cooldown_end_time).getTime() > Date.now()) {
      startCooldownTimer(row.cooldown_end_time);
    } else { clearTimer('cooldown'); setOrderBtnDisabled(false); }

  } catch(e){ console.error("fetchUserRoundStatus 失败",e); }
}

/* ====================== 下单 ====================== */
async function autoOrder() {
  if (!window.currentUserUUID) { alert('请先登录'); return; }
  if (ordering) return; ordering = true;

  try {
    const { data, error } = await supabaseClient.rpc('rpc_auto_order',{ p_uid: window.currentUserUUID });
    if (error) throw error;
    const res = Array.isArray(data)?data[0]:data;
    if (!res) return;

    if (res.cooldown===true||res.cooldown==='t') { await fetchUserRoundStatus(); alert("本轮已完成，进入冷却"); return; }

    if (res.order_id) window.pendingOrderId = res.order_id;
    if (res.match_end_time) startMatchTimer(res.match_end_time, async()=>{ window.pendingOrderId=null; await fetchUserRoundStatus(); });

    if (typeof res.coins_after!=='undefined') updateCoinsUI(res.coins_after);
    window.currentRoundCompleted = Number(res.completed_count||window.currentRoundCompleted);
    updateRoundProgress();
  } catch(e){ alert(e.message||"下单失败"); }
  finally{ ordering=false; }
}

/* ====================== 完成订单 ====================== */
async function completeOrderRemote(orderId) {
  if (!orderId) return;
  if (completing) return; completing=true;

  try {
    const { data, error } = await supabaseClient.rpc('rpc_complete_order',{
      p_order_id: orderId,
      p_uid: window.currentUserUUID
    });
    if (error) throw error;
    const res = Array.isArray(data)?data[0]:data;
    window.currentRoundCompleted = (window.currentRoundCompleted||0)+1;
    updateRoundProgress();
    await fetchUserRoundStatus();
    window.pendingOrderId = null;
    clearTimer('match');
  } catch(e){ alert(e.message||"完成订单失败"); }
  finally{ completing=false; }
}

/* ====================== 页面初始化 ====================== */
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('autoOrderBtn')?.addEventListener('click', autoOrder);
  document.getElementById('completeOrderBtn')?.addEventListener('click',()=>completeOrderRemote(window.pendingOrderId));
  fetchUserRoundStatus();
});
