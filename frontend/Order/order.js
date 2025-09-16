/* ======================
   初始化用户信息
====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;
let completing = false;
let exchanging = false;

const ORDERS_PER_GROUP = 15;      // 一轮订单数量
const COOLDOWN_TIME = 60 * 1000;  // 1分钟倒计时

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
    btn.textContent = disabled ? `🎲 一键刷单（不可用）` : `🎲 一键刷单`;
  }
}

function updateCoinsUI(coinsRaw) {
  const coins = Number(coinsRaw) || 0;
  const ob = document.getElementById("ordercoins");
  if (ob) ob.textContent = coins.toFixed(2);
}

function updateOrderProgress(count) {
  const el = document.getElementById("orderProgress");
  if (el) el.textContent = `${count}/${ORDERS_PER_GROUP}`;
}

/* ======================
   倒计时逻辑
====================== */
let cooldownInterval = null;

function startCooldownTimer(cooldownEndStr) {
  const timerEl = document.getElementById("cooldownTimer");
  if (!timerEl) return;

  const cooldownEnd = new Date(cooldownEndStr + "Z"); // 强制 UTC

  if (cooldownInterval) clearInterval(cooldownInterval);

  function tick() {
    const diff = cooldownEnd.getTime() - Date.now();
    if (diff <= 0) {
      timerEl.textContent = "";
      updateOrderProgress(0);
      setOrderBtnDisabled(false);

      // 更新数据库 cooldown_end 清空
      supabaseClient.from("users")
        .update({ cooldown_end: null })
        .eq("id", window.currentUserId);

      clearInterval(cooldownInterval);
    } else {
      const sec = Math.ceil(diff / 1000);
      timerEl.textContent = `⏳ 冷却 ${sec}s`;
      setOrderBtnDisabled(true, `冷却中 ${sec}s`);
      updateOrderProgress(ORDERS_PER_GROUP); // 倒计时中仍显示 15/15
    }
  }

  tick();
  cooldownInterval = setInterval(tick, 500);
}

/* ======================
   获取用户状态
====================== */
async function loadUserOrderStatus() {
  if (!window.currentUserId) return;

  const { data: user, error } = await supabaseClient
    .from("users")
    .select("coins, balance, current_order_count, cooldown_end")
    .eq("id", window.currentUserId)
    .single();

  if (error || !user) return;

  updateCoinsUI(user.coins);
  const balEl = document.getElementById("balance");
  if (balEl) balEl.textContent = (Number(user.balance) || 0).toFixed(2);

  const count = Number(user.current_order_count) || 0;
  updateOrderProgress(count);

  if (user.cooldown_end) {
    const cooldownEnd = new Date(user.cooldown_end);
    if (cooldownEnd > new Date()) {
      startCooldownTimer(user.cooldown_end);
    } else {
      setOrderBtnDisabled(false);
    }
  } else {
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
   最后订单
====================== */
async function loadLastOrder() {
  if (!window.currentUserId) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!orders || orders.length === 0) {
    document.getElementById("orderResult").innerHTML = "";
    return;
  }

  const lastOrder = orders[0];
  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", window.currentUserId)
    .single();

  renderLastOrder(lastOrder, user?.coins || 0);
}

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

  el.innerHTML = html;

  const compBtn = document.getElementById("completeOrderBtn");
  if (compBtn) {
    compBtn.addEventListener("click", async () => {
      compBtn.disabled = true;
      await completeOrder(order);
    });
  }
}

/* ======================
   完成订单
====================== */
async function completeOrder(order) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;

    const { data: user, error: userErr } = await supabaseClient
      .from("users")
      .select("coins, current_order_count")
      .eq("id", window.currentUserId)
      .single();
    if (userErr || !user) throw new Error("获取用户信息失败");

    const currentCoins = Number(user.coins || 0);
    const currentCount = Number(user.current_order_count || 0);

    const price = Number(order.total_price) || 0;
    const profit = Number(order.profit) || 0;
    const finalCoins = currentCoins + price + profit;

    // 更新订单状态
    const { error: orderErr } = await supabaseClient
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("status", "pending");
    if (orderErr) throw new Error(orderErr.message);

    // 更新用户 coins 和订单计数
    let newCount = currentCount + 1;
    let cooldownEnd = null;

    if (newCount >= ORDERS_PER_GROUP) {
      cooldownEnd = new Date(Date.now() + COOLDOWN_TIME).toISOString();
      newCount = ORDERS_PER_GROUP; // 倒计时中仍显示满
    }

    const { error: userUpdateErr } = await supabaseClient
      .from("users")
      .update({ coins: finalCoins, current_order_count: newCount, cooldown_end: cooldownEnd })
      .eq("id", window.currentUserId);
    if (userUpdateErr) throw new Error(userUpdateErr.message);

    renderLastOrder({ ...order, status: "completed" }, finalCoins);
    updateCoinsUI(finalCoins);
    updateOrderProgress(newCount);

    if (cooldownEnd) startCooldownTimer(cooldownEnd);

    await loadRecentOrders();

  } catch (e) {
    alert(e.message || "完成订单失败");
  } finally {
    completing = false;
  }
}

/* ======================
   自动下单
====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins, current_order_count, cooldown_end")
      .eq("id", window.currentUserId)
      .single();

    const coins = Number(user?.coins || 0);
    const currentCount = Number(user?.current_order_count || 0);

    // 冷却中禁止下单
    if (user.cooldown_end && new Date(user.cooldown_end) > new Date()) {
      alert("当前处于冷却中，请等待倒计时结束");
      ordering = false;
      return;
    }

    if (coins < 50) {
      alert("余额不足，最少需要 50 Coins");
      ordering = false;
      return;
    }

    // 生成随机订单
    const { data: products } = await supabaseClient
      .from("products")
      .select("*")
      .eq("enabled", true)
      .eq("manual_only", false);

    if (!products || products.length === 0) throw new Error("无可下单产品");

    const product = products[Math.floor(Math.random() * products.length)];
    const price = Number(product.price || 0);
    const profitRatio = Number(product.profit || 0);
    const profit = +(price * profitRatio).toFixed(2);
    const tempCoins = coins - price;

    // 扣 Coins
    await supabaseClient.from("users")
      .update({ coins: tempCoins })
      .eq("id", window.currentUserId);

    // 插入订单
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();

    if (orderErr) throw new Error(orderErr.message);

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
    await loadUserOrderStatus();
    await loadRecentOrders();
  }
}

/* ======================
   Coins ↔ Balance 兑换
====================== */
async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  try {
    const inputEl = document.getElementById("addCoinsInput");
    const amount = parseFloat(inputEl?.value || "0");
    if (isNaN(amount) || amount <= 0) { alert("输入无效"); return; }

    const { data: user } = await supabaseClient
      .from("users")
      .select("coins, balance, current_order_count")
      .eq("id", window.currentUserId)
      .single();

    if (!user) throw new Error("加载用户信息失败");

    const coins = Number(user.coins || 0);
    const balance = Number(user.balance || 0);
    const orderCount = Number(user.current_order_count || 0);

    if (orderCount < ORDERS_PER_GROUP) {
      alert(`必须完成 ${ORDERS_PER_GROUP} 单才能兑换 Coins`);
      return;
    }

    if (coins < amount) { alert(`Coins 不足`); return; }

    const newCoins = coins - amount;
    const newBalance = balance + amount;

    const { error: updateErr } = await supabaseClient
      .from("users")
      .update({ coins: newCoins, balance: newBalance, current_order_count: 0, cooldown_end: null })
      .eq("id", window.currentUserId);

    if (updateErr) throw new Error("兑换失败：" + updateErr.message);

    alert(`✅ 成功将 ${amount.toFixed(2)} Coins 转入 Balance`);
    updateCoinsUI(newCoins);
    document.getElementById("balance").textContent = newBalance.toFixed(2);
    updateOrderProgress(0);

  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
  }
}

/* ======================
   页面初始化
====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("confirmAddCoins")?.addEventListener("click", confirmExchange);

  loadUserOrderStatus();
  loadLastOrder();
  loadRecentOrders();
});
