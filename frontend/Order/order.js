/* ======================
   初始化用户信息
====================== */
window.currentUserId = localStorage.getItem("currentUserId");
window.currentUsername = localStorage.getItem("currentUser");

let ordering = false;
let completing = false;
let exchanging = false;

const ORDERS_PER_GROUP = 15;  // 一轮订单数量
const COOLDOWN_TIME = 60;     // 倒计时秒数
let cooldownRemaining = 0;    // 当前倒计时剩余秒数
let cooldownInterval = null;

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
function startCooldown() {
  cooldownRemaining = COOLDOWN_TIME;
  setOrderBtnDisabled(true, `冷却中 ${cooldownRemaining}s`);
  updateOrderProgress(ORDERS_PER_GROUP);

  if (cooldownInterval) clearInterval(cooldownInterval);

  cooldownInterval = setInterval(() => {
    cooldownRemaining--;
    document.getElementById("cooldownTimer").textContent = `⏳ 冷却 ${cooldownRemaining}s`;
    if (cooldownRemaining <= 0) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
      document.getElementById("cooldownTimer").textContent = "";
      updateOrderProgress(0);
      setOrderBtnDisabled(false);
      resetOrderCount(); // 倒计时结束重置数据库计数
    }
  }, 1000);
}

/* ======================
   重置订单计数
====================== */
async function resetOrderCount() {
  if (!window.currentUserId) return;
  await supabaseClient
    .from("users")
    .update({ current_order_count: 0 })
    .eq("id", window.currentUserId);
}

/* ======================
   用户状态
====================== */
async function loadUserOrderStatus() {
  if (!window.currentUserId) return;
  const { data: user, error } = await supabaseClient
    .from("users")
    .select("coins, balance, current_order_count")
    .eq("id", window.currentUserId)
    .single();
  if (error || !user) return;

  updateCoinsUI(user.coins);
  const balEl = document.getElementById("balance");
  if (balEl) balEl.textContent = (Number(user.balance) || 0).toFixed(2);

  updateOrderProgress(user.current_order_count || 0);

  // 如果满15单且 localStorage 有倒计时，则恢复倒计时
  if (user.current_order_count >= ORDERS_PER_GROUP) {
    const savedCooldown = parseInt(localStorage.getItem("cooldownRemaining")) || COOLDOWN_TIME;
    cooldownRemaining = savedCooldown;
    startCooldown();
  }
}

/* ======================
   最近订单
====================== */
async function loadRecentOrders() {
  if (!window.currentUserId) return;

  const { data: recentOrders } = await supabaseClient
    .from("orders")
    .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
    .eq("user_id", window.currentUserId)
    .order("created_at", { ascending: false })
    .limit(5);

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
}

/* ======================
   完成订单
====================== */
async function completeOrder(order) {
  if (completing) return;
  completing = true;

  try {
    const { data: user } = await supabaseClient
      .from("users")
      .select("coins, current_order_count")
      .eq("id", window.currentUserId)
      .single();

    let coins = Number(user?.coins || 0);
    let count = Number(user?.current_order_count || 0);
    const price = Number(order.total_price || 0);
    const profit = Number(order.profit || 0);

    coins += price + profit;
    count += 1;

    await supabaseClient.from("orders")
      .update({ status: "completed" })
      .eq("id", order.id);

    // 更新用户 coins 和订单计数
    if (count >= ORDERS_PER_GROUP) {
      startCooldown();
      localStorage.setItem("cooldownRemaining", COOLDOWN_TIME);
      count = ORDERS_PER_GROUP; // 倒计时期间仍显示满
    }

    await supabaseClient.from("users")
      .update({ coins: coins, current_order_count: count })
      .eq("id", window.currentUserId);

    updateCoinsUI(coins);
    updateOrderProgress(count);
    await loadRecentOrders();
    await loadLastOrder();

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
      .select("coins, current_order_count")
      .eq("id", window.currentUserId)
      .single();

    if (user.current_order_count >= ORDERS_PER_GROUP) {
      alert("当前处于冷却中，请等待倒计时结束");
      return;
    }

    if (Number(user.coins) < 50) {
      alert("余额不足，最少需要 50 Coins");
      return;
    }

    const product = await getRandomProduct();
    const price = Number(product.price || 0);
    const profit = +(price * Number(product.profit || 0)).toFixed(2);

    const coinsAfter = Number(user.coins) - price;
    await supabaseClient.from("users")
      .update({ coins: coinsAfter })
      .eq("id", window.currentUserId);

    const { data: newOrder } = await supabaseClient
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

    renderLastOrder(newOrder, coinsAfter);
    updateCoinsUI(coinsAfter);
    await loadUserOrderStatus();
    await loadRecentOrders();

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   Coins → Balance 兑换
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

    if (user.current_order_count < ORDERS_PER_GROUP) {
      alert(`必须完成 ${ORDERS_PER_GROUP} 单才能兑换 Coins`);
      return;
    }

    const coins = Number(user.coins || 0);
    const balance = Number(user.balance || 0);
    if (coins < amount) { alert("Coins 不足"); return; }

    await supabaseClient.from("users")
      .update({
        coins: coins - amount,
        balance: balance + amount,
        current_order_count: 0
      })
      .eq("id", window.currentUserId);

    alert(`✅ 成功将 ${amount.toFixed(2)} Coins 转入 Balance`);
    updateCoinsUI(coins - amount);
    document.getElementById("balance").textContent = (balance + amount).toFixed(2);
    updateOrderProgress(0);

  } catch (e) {
    alert(e.message || "兑换失败");
  } finally {
    exchanging = false;
  }
}

/* ======================
   随机产品
====================== */
async function getRandomProduct() {
  const { data: products } = await supabaseClient
    .from("products")
    .select("*")
    .eq("enabled", true)
    .eq("manual_only", false);

  if (!products || products.length === 0) throw new Error("无可下单产品");
  return products[Math.floor(Math.random() * products.length)];
}

/* ======================
   弹窗
====================== */
function openExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "flex";
}

function closeExchangeModal() {
  const modal = document.getElementById("addCoinsModal");
  if (modal) modal.style.display = "none";
}

/* ======================
   页面初始化
====================== */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoOrderBtn")?.addEventListener("click", autoOrder);
  document.getElementById("addCoinsBtn")?.addEventListener("click", openExchangeModal);
  document.getElementById("confirmAddCoins")?.addEventListener("click", confirmExchange);

  loadUserOrderStatus();
  loadLastOrder();
  loadRecentOrders();
});
