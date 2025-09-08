/* ======================
   今日任务统计
   ====================== */
async function getTodayProgress() {
  if (!window.currentUserId) return { todayCount: 0, dailyLimit: 0 };

  // 获取用户等级
  const { data: user, error: userErr } = await supabaseClient
    .from("users")
    .select("level_id")
    .eq("id", window.currentUserId)
    .single();
  if (userErr || !user) {
    console.error("加载用户信息失败", userErr);
    return { todayCount: 0, dailyLimit: 0 };
  }

  // 获取等级对应 daily_limit
  const { data: levelData, error: levelErr } = await supabaseClient
    .from("levels")
    .select("daily_limit")
    .eq("id", user.level_id)
    .single();
  const dailyLimit = levelData?.daily_limit || 10;

  // 统计今日完成订单（从今日 00:00:00 起）
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabaseClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", window.currentUserId)
    .eq("status", "completed")
    .gte("created_at", todayStart.toISOString());

  return { todayCount: todayCount || 0, dailyLimit };
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

    // 今日任务进度检查
    const { todayCount, dailyLimit } = await getTodayProgress();
    if (todayCount >= dailyLimit) {
      alert(`⚠️ 今日订单任务已完成 (${todayCount}/${dailyLimit})，无法继续下单`);
      setOrderBtnDisabled(true, "今日订单任务已完成");
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
      ordering = false;
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
   Coins / Balance 兑换
   ====================== */
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

    // Coins -> Balance 转换受今日任务限制
    if (type === "coins") {
      const { todayCount, dailyLimit } = await getTodayProgress();
      if (todayCount >= dailyLimit) {
        alert("⚠️ 今日订单任务已完成，无法兑换 Coins → Balance");
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
