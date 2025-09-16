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

// ======================
// 新增配置
// ======================
const GROUP_SIZE = 15;                      // 每组 15 单
const COOLDOWN_MS = 1 * 60 * 1000;          // 默认 1 分钟（改为 60*60*1000 即 1 小时）

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
   检查是否在冷却中
   ====================== */
async function checkGroupCooldown() {
  if (!window.currentUserId) return false;

  const { data: user } = await supabaseClient
    .from("users")
    .select("group_cooldown_until")
    .eq("id", window.currentUserId)
    .single();

  if (!user?.group_cooldown_until) return false;

  const until = new Date(user.group_cooldown_until).getTime();
  const now = Date.now();
  return now < until; // true 表示还在冷却
}

async function startGroupCooldown() {
  const until = new Date(Date.now() + COOLDOWN_MS).toISOString();
  await supabaseClient
    .from("users")
    .update({ group_cooldown_until: until })
    .eq("id", window.currentUserId);
}

/* ======================
   检查组任务进度
   ====================== */
async function getGroupProgress() {
  const { count } = await supabaseClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", window.currentUserId)
    .eq("status", "completed");

  const totalCompleted = count || 0;
  const currentGroup = Math.floor(totalCompleted / GROUP_SIZE);
  const progressInGroup = totalCompleted % GROUP_SIZE;

  return { totalCompleted, currentGroup, progressInGroup };
}

/* ======================
   自动下单（加组逻辑 + 冷却）
   ====================== */
async function autoOrder() {
  if (!window.currentUserId) { alert("请先登录！"); return; }
  if (ordering) return;
  ordering = true;
  setOrderBtnDisabled(true, "下单中…");

  try {
    // 检查冷却
    if (await checkGroupCooldown()) {
      alert("⏳ 当前组已完成，等待冷却结束才能继续下单！");
      ordering = false;
      setOrderBtnDisabled(false);
      return;
    }

    // 检查组内进度
    const { progressInGroup } = await getGroupProgress();
    if (progressInGroup >= GROUP_SIZE) {
      await startGroupCooldown();
      alert("✅ 已完成一组任务，进入冷却时间！");
      ordering = false;
      setOrderBtnDisabled(false);
      return;
    }

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

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("user_id", window.currentUserId);
    const orderNumber = (orders?.length || 0) + 1;

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
    const profitRatio = Number(product.profit) || 0;
    const profit = +(price * profitRatio).toFixed(2);
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
      .select(`id, total_price, profit, status, created_at, products ( name, profit )`)
      .single();
    if (orderErr) throw new Error(orderErr.message);

    renderLastOrder(newOrder, tempCoins);
    updateCoinsUI(tempCoins);
    await checkPendingLock();
    await loadRecentOrders();

    // 如果组满了，启动冷却
    const { progressInGroup: afterProgress } = await getGroupProgress();
    if (afterProgress === 0) {
      await startGroupCooldown();
      alert("✅ 已完成一组任务，进入冷却时间！");
    }

  } catch (e) {
    alert(e.message || "下单失败");
  } finally {
    ordering = false;
  }
}

/* ======================
   修改兑换逻辑：必须完成一组才能兑换
   ====================== */
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
    // 检查是否完成整组
    const { progressInGroup } = await getGroupProgress();
    if (progressInGroup !== 0) {
      throw new Error("❌ 只有完成整组任务后才能兑换 Coins → Balance！");
    }

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
