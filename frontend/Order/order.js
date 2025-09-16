/* ======================
   初始化用户信息
   ====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;
let completing = false;
let exchanging = false;

// 配置
const ORDERS_PER_GROUP = 15;
const COOLDOWN_TIME = 60 * 1000; // 默认 1 分钟，改成 60*60*1000 为 1 小时

if (!window.supabaseClient) {
  console.error("❌ supabaseClient 未初始化！");
}

/* ======================
   辅助函数
   ====================== */
function getUserId() {
  const id = Number(window.currentUserId);
  return Number.isFinite(id) ? id : null;
}

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

async function getCompletedCount(userId) {
  const { count } = await supabaseClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed");
  return count || 0;
}

async function setCooldownForUser(userId) {
  const until = new Date(Date.now() + COOLDOWN_TIME).toISOString();
  await supabaseClient
    .from("users")
    .update({ cooldown_until: until })
    .eq("id", userId);
  return until;
}

async function isUserInCooldown(userId) {
  const { data } = await supabaseClient
    .from("users")
    .select("cooldown_until")
    .eq("id", userId)
    .single();
  const now = Date.now();
  if (!data?.cooldown_until) return 0;
  const remainMs = new Date(data.cooldown_until).getTime() - now;
  return remainMs > 0 ? Math.ceil(remainMs / 1000) : 0;
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
   完成订单（完成后判断是否完成整组并设置冷却）
   ====================== */
async function completeOrder(order, currentCoinsRaw) {
  if (completing) return;
  completing = true;

  try {
    if (order.status === "completed") return;
    const userId = getUserId();
    if (!userId) { alert("请先登录！"); return; }

    const currentCoins = Number(currentCoinsRaw) || 0;
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

    // 更新用户金币
    const { error: coinErr } = await supabaseClient
      .from("users")
      .update({ coins: finalCoins })
      .eq("id", userId);
    if (coinErr) throw new Error(coinErr.message);

    // 获取完成统计（在更新订单后查询）
    const completedCount = await getCompletedCount(userId);

    // 如果刚好完成整组（15 的倍数），设置冷却
    if (completedCount !== 0 && completedCount % ORDERS_PER_GROUP === 0) {
      await setCooldownForUser(userId);
      alert(`✅ 已完成第 ${Math.floor(completedCount / ORDERS_PER_GROUP)} 组任务，进入冷却 ${Math.ceil(COOLDOWN_TIME/1000)} 秒`);
      setOrderBtnDisabled(true, "任务冷却中");
    }

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
  const userId = getUserId();
  if (!userId) return;

  const { data: pend } = await supabaseClient
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1);

  if (pend?.length) {
    setOrderBtnDisabled(true, "存在未完成订单，请先完成订单");
  } else {
    // 还要检查冷却
    const remain = await isUserInCooldown(userId);
    if (remain > 0) {
      setOrderBtnDisabled(true, `任务冷却中，剩余 ${remain} 秒`);
    } else {
      setOrderBtnDisabled(false);
    }
  }
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

  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", escHandler);
    }
  });
}

/* ======================
   自动下单（只检查冷却，不在此处设置冷却）
   ====================== */
async function autoOrder() {
  const userId = getUserId();
  if (!userId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 冷却检查
    const remain = await isUserInCooldown(userId);
    if (remain > 0) {
      alert(`请等待 ${remain} 秒后再开始下一组任务！`);
      ordering = false;
      setOrderBtnDisabled(false);
      return;
    }

    const { data: user } = await supabaseClient
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();
    const coins = Number(user?.coins || 0);

    if (coins < 50) {
      showModal(`<p>你的余额不足，最少需要 50 coins</p>`);
      setOrderBtnDisabled(false);
      ordering = false;
      return;
    }

    const { data: pend } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(1);
    if (pend?.length) {
      alert("您有未完成订单，请先完成订单再继续下单。");
      await checkPendingLock();
      ordering = false;
      return;
    }

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", userId);
    const orderNumber = (orders?.length || 0) + 1;

    let product;
    const ruleProductId = await getUserRuleProduct(userId, orderNumber);
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
    const profitRatio = Number(product.profit) || 0;
    const profit = +(price * profitRatio).toFixed(2);
    const tempCoins = coins - price;

    await supabaseClient
      .from("users")
      .update({ coins: tempCoins })
      .eq("id", userId);

    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: userId,
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
    await checkPendingLock();
    await loadRecentOrders();

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   最近订单
   ====================== */
async function loadRecentOrders() {
  const userId = getUserId();
  if (!userId) return;

  try {
    const { data: recentOrders } = await supabaseClient
      .from("orders")
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { count: totalCount } = await supabaseClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

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
  const userId = getUserId();
  if (!userId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("coins, balance, cooldown_until")
    .eq("id", userId)
    .single();
  if (!error && data) {
    updateCoinsUI(data.coins);
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = (Number(data.balance) || 0).toFixed(2);
    await checkPendingLock();
  }
}

async function loadLastOrder() {
  const userId = getUserId();
  if (!userId) return;

  const { data: orders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: user } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", userId)
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

/* ======================
   confirmExchange：只有完成整组（15 的倍数且 >=15）才能兑换
   ====================== */
async function confirmExchange() {
  if (exchanging) return;
  exchanging = true;

  const inputEl = document.getElementById("addCoinsInput");
  const confirmBtn = document.getElementById("confirmAddCoins");
  const amount = parseFloat(inputEl?.value || "0");

  if (isNaN(amount) || amount <= 0) { alert("输入无效"); exchanging = false; return; }
  const userId = getUserId();
  if (!userId) { alert("请先登录！"); exchanging = false; return; }

  if (confirmBtn) confirmBtn.disabled = true;

  try {
    // 检查完成数
    const completedCount = await getCompletedCount(userId);
    if (completedCount < ORDERS_PER_GROUP || completedCount % ORDERS_PER_GROUP !== 0) {
      alert(`⚠️ 必须完成 ${ORDERS_PER_GROUP} 的整组任务后才能兑换！`);
      return;
    }

    const { data: user, error } = await supabaseClient
      .from("users")
      .select("coins, balance")
      .eq("id", userId)
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
      .eq("id", userId);
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
