/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // Balance -> Coins 兑换中的并发保护

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ======================
   工具函数
   ====================== */
function setOrderBtnDisabled(disabled, reason = "") {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.disabled = disabled;
    btn.title = reason || "";
    btn.textContent = disabled ? "🎲 一键刷单（不可用）" : "🎲 一键刷单";
  }
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

/* ======================
   渲染最近订单
   ====================== */
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
    <p>利润：${profitRatio}</p>
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
  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   检查 pending 订单锁定按钮
   ====================== */
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

/* ======================
   自动下单（整合 getRandomProduct）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 内部定义 getRandomProduct，保证作用域内可用
    const getRandomProduct = async () => {
      const { data: products, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("enabled", true)
        .eq("manual_only", false);

      if (error || !products || products.length === 0) {
        throw new Error("产品列表为空或读取失败！");
      }

      return products[Math.floor(Math.random() * products.length)];
    };

    // 直接调用数据库存储过程，传入随机产品 ID
    const randomProduct = await getRandomProduct();
    const { data, error } = await supabaseClient.rpc("try_create_order", {
      p_user_id: window.currentUserId,
      p_product_id: randomProduct.id
    });

    if (error) throw new Error(error.message);

    if (!data.success) {
      if (data.message === "冷却中") {
        alert(`⚠️ 冷却中，还剩 ${data.remaining_seconds} 秒`);
      } else {
        alert("❌ " + data.message);
      }
      return;
    }

    // 成功下单
    alert(`✅ 下单成功，订单ID=${data.order_id} (${data.round_orders}/${data.max_orders})`);

    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();
    await loadCoinsOrderPage();

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    setOrderBtnDisabled(false);
  }
}

/* ======================
   最近订单
   ====================== */
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
    if (historyTitle) {
      historyTitle.textContent = `🕘 最近订单 订单数：${totalCount || 0}单`;
    }

    const list = document.getElementById("recentOrders");
    if (list) {
      if (!recentOrders || recentOrders.length === 0) {
        list.innerHTML = `<li>暂无订单！</li>`;
      } else {
        list.innerHTML = recentOrders.map(o => {
          const price = Number(o.total_price) || 0;
          const profit = Number(o.profit) || 0;
          const profitRatio = Number(o.products?.profit) || 0;
          return `
            <li>
              🛒 ${o.products?.name || "未知商品"} /
              ¥${price.toFixed(2)} /
              利润：${profitRatio} /
              收入：+¥${profit.toFixed(2)} /
              状态：${o.status === "completed" ? "已完成" : "待完成"} /
              <small>${new Date(o.created_at).toLocaleString()}</small>
            </li>`;
        }).join("");
      }
    }
  } catch (e) {
    console.error("加载最近订单失败：", e);
  }
}

/* ======================
   页面初始化
   ====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelAddCoins")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmAddCoins")?.addEventListener("click", confirmExchange);

  document.getElementById("addCoinsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "addCoinsModal") closeExchangeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExchangeModal();
  });

  refreshAll();
});

/* ======================
   页面刷新工具
   ====================== */
async function refreshAll() {
  await loadCoinsOrderPage();
  await loadLastOrder();
  await loadRecentOrders();
}

async function loadCoinsOrderPage() {
  if (!window.currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
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

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();

  if (orders?.length) renderLastOrder(orders[0], user?.coins ?? 0);
  else document.getElementById("orderResult").innerHTML = "";
}

/* ======================
   Coins 弹窗
   ====================== */
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
  const confirmBtn = document.getElementById("confirmAddCoins");
  const amount = parseFloat(inputEl?.value || "0");

  if (isNaN(amount) || amount <= 0) { alert("输入无效"); exchanging = false; return; }
  if (!window.currentUserId) { alert("请先登录！"); exchanging = false; return; }

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", window.currentUserId)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    const coins = Number(user.coins) || 0;
    const balance = Number(user.balance) || 0;
    if (balance < amount) { alert(`余额不足，当前 Balance：¥${balance.toFixed(2)}`); return; }

    const newCoins = coins + amount;
    const newBalance = balance - amount;

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance })
      .eq("id", window.currentUserId);
    if (updateErr) throw new Error("兑换失败：" + updateErr.message);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} Coins`);
    document.getElementById("ordercoins").textContent = newCoins.toFixed(2);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = newBalance.toFixed(2);

    updateCoinsUI(newCoins);
    await checkPendingLock();
    await loadLastOrder();
    await loadRecentOrders();
    closeExchangeModal();

  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

/* ======================
   轮次信息容器渲染
   ====================== */
function renderRoundContainer() {
  if (document.getElementById("roundInfo")) return; // 已存在

  const container = document.createElement("div");
  container.id = "roundInfo";
  container.style.cssText = "margin:10px 0; padding:10px; border:1px solid #ccc; border-radius:5px;";
  container.innerHTML = `
    <div>当前轮次: <span id="currentRound">-</span> / 总轮次: <span id="maxOrders">5</span></div>
    <div>本轮完成: <span id="orderCount">0</span> / <span id="maxOrders2">5</span> 单</div>
    <div><span id="cooldownMsg" style="color:red;"></span></div>
  `;

  const target = document.getElementById("orderResult") || document.body;
  target.parentNode.insertBefore(container, target.nextSibling);
}


/* ======================
   轮次状态
   ====================== */
let roundInterval = null; // 用于倒计时更新
let ordering = false;

// 获取最新轮次状态
async function fetchCurrentRound(userId) {
  const { data, error } = await supabaseClient
    .from("rounds")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("获取轮次失败", error);
    return null;
  }
  return data;
}

// 渲染轮次信息并控制刷单按钮状态
async function renderRoundProgress() {
  if (!window.currentUserId) return;

  const round = await fetchCurrentRound(window.currentUserId);
  const container = document.getElementById("roundContainer");
  const btn = document.getElementById("autoOrderBtn");

  if (!round) {
    if (container) container.style.display = "none";
    if (btn) btn.disabled = false; // 没有轮次可下单
    return;
  }

  container.style.display = "block";

  const currentRoundEl = document.getElementById("currentRound");
  const orderCountEl = document.getElementById("orderCount");
  const maxOrdersEl = document.getElementById("maxOrders");
  const maxOrdersRepeatEl = document.getElementById("maxOrdersRepeat");
  const roundTimeLeftEl = document.getElementById("roundTimeLeft");

  currentRoundEl.textContent = round.current_round;
  orderCountEl.textContent = round.order_count;
  maxOrdersEl.textContent = round.max_orders;
  maxOrdersRepeatEl.textContent = round.max_orders;

  // 清理之前的倒计时
  if (roundInterval) clearInterval(roundInterval);

  function updateTime() {
    const now = new Date();
    const endTime = new Date(round.end_time);
    const secondsLeft = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000));
    roundTimeLeftEl.textContent = secondsLeft.toString();

    // 根据轮次和下单数量控制按钮
    if (round.order_count >= round.max_orders && secondsLeft > 0) {
      btn.disabled = true;
      btn.textContent = `等待冷却 ${secondsLeft}s`;
    } else {
      btn.disabled = false;
      btn.textContent = "🎲 一键刷单";
    }
  }

  updateTime();
  roundInterval = setInterval(updateTime, 1000);
}

// 自动下单，调用你之前的 place-order Edge Function
async function autoOrder() {
  if (ordering) return;
  ordering = true;

  const btn = document.getElementById("autoOrderBtn");
  btn.disabled = true;
  btn.textContent = "下单中…";

  try {
    const res = await fetch("https://<your-project-ref>.functions.supabase.co/place-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${window.supabaseKey || ""}` // service role 或者用户 JWT
      },
      body: JSON.stringify({ user_id: window.currentUserId, product_id: 1 })
    });

    const data = await res.json();

    if (res.status === 200) {
      console.log("下单成功", data);
    } else {
      alert(data.error || "下单失败");
    }

    // 刷新轮次显示
    await renderRoundProgress();
  } catch (err) {
    console.error(err);
    alert("下单异常");
  } finally {
    ordering = false;
  }
}

// 页面加载时初始化
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  renderRoundProgress();
  // 每隔 5 秒刷新轮次状态，防止跨浏览器不同步
  setInterval(renderRoundProgress, 5000);
});
