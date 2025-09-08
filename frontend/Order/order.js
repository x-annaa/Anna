/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;      // 下单中的并发保护
let completing = false;    // 完成订单中的并发保护
let exchanging = false;    // 兑换中的并发保护

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

  if (error) {
    console.error("读取手动规则失败", error);
    return null;
  }
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
  if (error || !products || products.length === 0) {
    throw new Error("产品列表为空或读取失败！");
  }
  return products[Math.floor(Math.random() * products.length)];
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

  let html = `
    <h3>✅ 最近一次订单</h3>
    <p>商品：${order.products?.name || "未知商品"}</p>
    <p>价格：¥${price.toFixed(2)}</p>
    <p>利润：<span style="color:green;">+¥${profit.toFixed(2)}</span></p>
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
   今日任务统计
   ====================== */
/* ======================
   今日任务统计
   ====================== */
async function getTodayProgress() {
  if (!window.currentUserId) return { todayCount: 0, dailyLimit: 0 };

  // 先获取用户信息
  const { data: user, error: userErr } = await supabaseClient
    .from("users")
    .select("level_id")
    .eq("id", window.currentUserId)
    .single();
  if (userErr || !user) {
    console.error("加载用户信息失败", userErr);
    return { todayCount: 0, dailyLimit: 0 };
  }

  // 根据 level_id 获取 daily_limit
  const { data: levelData, error: levelErr } = await supabaseClient
    .from("levels")
    .select("daily_limit")
    .eq("id", user.level_id)
    .single();
  const dailyLimit = levelData?.daily_limit || 10; // 如果没获取到，默认 10

  // 统计今日完成订单
  const todayStart = new Date().toISOString().slice(0, 10);
  const { count: todayCount } = await supabaseClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", window.currentUserId)
    .eq("status", "completed")
    .gte("created_at", todayStart);

  return { todayCount: todayCount || 0, dailyLimit };
}

/* ======================
   通用 Modal 管理
   ====================== */
function showModal(contentHtml) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      ${contentHtml}
      <div class="modal-actions">
        <button id="closeModalBtn">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("closeModalBtn").addEventListener("click", () => {
    modal.remove();
  });

  // ESC 关闭
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", escHandler);
    }
  });
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
    // 用户信息
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", window.currentUserId)
      .single();
    const coins = Number(user?.coins || 0);

    if (coins < 50) {
      showModal(`<p>你的余额不足，最少需要 50 coins</p>`);
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    // 检查 pending
    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成订单，请先完成订单再继续下单。");
      await checkPendingLock();
      return;
    }

    // 当前订单号
    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId);
    const orderNumber = (orders?.length || 0) + 1;

    // 检查手动规则
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
    const profit = +(price * 0.01);
    const tempCoins = coins - price;

    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", window.currentUserId);

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: window.currentUserId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "pending"
      })
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   最近订单 + 今日任务
   ====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  try {
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .eq("user_id", window.currentUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", window.currentUserId);

    const { todayCount, dailyLimit } = await getTodayProgress();

    const historyTitle = document.querySelector(".order-history h3");
    if (historyTitle) {
      historyTitle.textContent =
        `🕘 最近订单 ⛞今日订单任务：${todayCount}/${dailyLimit} ♲总共：${totalCount || 0}单`;
    }

    const list = document.getElementById("recentOrders");
    if (list) {
      if (!recentOrders || recentOrders.length === 0) {
        list.innerHTML = `<li>暂无订单！</li>`;
      } else {
        list.innerHTML = recentOrders.map(o => {
          const price = Number(o.total_price) || 0;
          const profit = Number(o.profit) || 0;
          return `
            <li>
              🛒 ${o.products?.name || "未知商品"} /
              ¥${price.toFixed(2)} /
              利润 +¥${profit.toFixed(2)} /
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

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("cancelExchange")?.addEventListener("click", closeExchangeModal);
  document.getElementById("confirmExchange")?.addEventListener("click", confirmExchange);
  document.getElementById("exchangeType")?.addEventListener("change", loadExchangeInfo);

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
    .select(`id, total_price, profit, status, created_at, products ( name )`)
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
   Coins / Balance 弹窗
   ====================== */
function openExchangeModal() {
  const modal = document.getElementById("exchangeModal");
  if (modal) modal.style.display = "flex";

  // 初始化界面
  document.getElementById("exchangeAmount").value = "";
  document.getElementById("exchangeType").value = "coins";
  document.getElementById("orderLimitNotice").style.display = "none";

  // 加载余额
  loadExchangeInfo();
}

function closeExchangeModal() {
  const modal = document.getElementById("exchangeModal");
  if (modal) modal.style.display = "none";
}

async function loadExchangeInfo() {
  if (!window.currentUserId) return;

  const { data: user, error } = await supabaseClient
    .from("users")
    .select("coins, balance")
    .eq("id", window.currentUserId)
    .single();

  if (!error && user) {
    const type = document.getElementById("exchangeType").value;
    const label = document.getElementById("exchangeFromLabel");
    const available = document.getElementById("exchangeAvailable");

    if (type === "coins") {
      label.textContent = "Balance";
      available.textContent = (Number(user.balance) || 0).toFixed(2);
    } else {
      label.textContent = "Coins";
      available.textContent = (Number(user.coins) || 0).toFixed(2);
    }
  }
}

async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  const type = document.getElementById("exchangeType").value;
  const amount = parseFloat(document.getElementById("exchangeAmount").value || "0");
  const notice = document.getElementById("orderLimitNotice");

  if (isNaN(amount) || amount <= 0) { alert("请输入有效数量"); exchanging = false; return; }

  try {
    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", window.currentUserId)
      .single();
    if (error || !user) throw new Error("加载用户信息失败");

    let coins = Number(user.coins) || 0;
    let balance = Number(user.balance) || 0;

    if (type === "coins") {
      // Coins -> Balance 转换需要任务限制
      const { todayCount, dailyLimit } = await getTodayProgress();
      if (todayCount > 0 && todayCount < dailyLimit) {
        notice.style.display = "block";
        exchanging = false;
        return;
      }
      if (balance < amount) { alert("Balance 不足"); exchanging = false; return; }
      balance -= amount;
      coins += amount;
    } else {
      if (coins < amount) { alert("Coins 不足"); exchanging = false; return; }
      coins -= amount;
      balance += amount;
    }

    await supabaseClient
      .from("users")
      .update({ coins, balance })
      .eq("id", window.currentUserId);

    alert(`✅ 成功兑换 ${amount.toFixed(2)} ${type}`);
    closeExchangeModal();
    await refreshAll();
  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
  }
}
