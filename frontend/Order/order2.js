(() => {
  /* ======================
     初始化用户信息
     ====================== */
  const currentUserUuid = localStorage.getItem("currentUserUuid");
  const currentUsername = localStorage.getItem("currentUser");

  if (!currentUserUuid) {
    alert("currentUserUuid 未设置，请先登录");
    return;
  }

  if (!window.supabaseClient) {
    console.error("❌ supabaseClient 未初始化！");
    return;
  }

  /* ======================
     状态变量
     ====================== */
  let ordering = false;       // 下单并发保护
  let completing = false;     // 完成订单并发保护
  let countdownTimer = null;  // 倒计时计时器

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

  function updateCountdownUI(secondsLeft) {
    const btn = document.getElementById("autoOrderBtn");
    if (btn) {
      btn.textContent = secondsLeft > 0 ? `⏳ ${secondsLeft}s 后可下单` : `🎲 一键刷单`;
    }
  }

  async function checkOrderLimit() {
    try {
      const { data, error } = await supabaseClient
        .rpc("can_user_order", { p_user_uuid: currentUserUuid })
        .single();

      if (error) throw error;

      if (data.can_order) {
        setOrderBtnDisabled(false);
        updateCountdownUI(0);
      } else {
        setOrderBtnDisabled(true, "下单过于频繁");
        const secondsLeft = Math.ceil(
          (new Date(data.next_available) - new Date()) / 1000
        );
        startCountdown(secondsLeft);
      }
    } catch (e) {
      console.error("检查下单限制失败", e);
      setOrderBtnDisabled(true, "检查下单限制失败");
    }
  }

  function startCountdown(seconds) {
    if (countdownTimer) clearInterval(countdownTimer);

    updateCountdownUI(seconds);

    countdownTimer = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        setOrderBtnDisabled(false);
        updateCountdownUI(0);
      } else {
        updateCountdownUI(seconds);
      }
    }, 1000);
  }

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

  async function autoOrder() {
    if (ordering) return;
    ordering = true;
    setOrderBtnDisabled(true, "下单中…");

    try {
      // 检查下单限制
      const { data: limitData } = await supabaseClient
        .rpc("can_user_order", { p_user_uuid: currentUserUuid })
        .single();
      if (!limitData.can_order) {
        alert("⚠️ 下单过于频繁，请稍后再试！");
        const secondsLeft = Math.ceil(
          (new Date(limitData.next_available) - new Date()) / 1000
        );
        startCountdown(secondsLeft);
        return;
      }

      // 获取用户余额
      const { data: user, error: userErr } = await supabaseClient
        .from("users")
        .select("coins")
        .eq("uuid", currentUserUuid)
        .single();
      if (userErr || !user) throw new Error("获取用户信息失败");
      if (user.coins < 50) {
        alert("余额不足，至少需要 50 coins");
        return;
      }

      // 获取随机产品
      const product = await getRandomProduct();

      const price = Number(product.price) || 0;
      const profit = +(price * (Number(product.profit) || 0)).toFixed(2);
      const finalCoins = user.coins - price;

      // 扣除金币
      await supabaseClient
        .from("users")
        .update({ coins: finalCoins })
        .eq("uuid", currentUserUuid);

      // 创建订单
      const { data: newOrder, error: orderErr } = await supabaseClient
        .from("orders")
        .insert({
          user_uuid: currentUserUuid,
          product_id: product.id,
          total_price: price,
          profit: profit,
          status: "pending",
        })
        .select(`id, total_price, profit, status, created_at, products (name, profit)`)
        .single();
      if (orderErr) throw orderErr;

      renderLastOrder(newOrder, finalCoins);
    } catch (e) {
      alert(e.message || "下单失败");
    } finally {
      ordering = false;
      await checkOrderLimit(); // 下单后刷新倒计时/限制
    }
  }

  function renderLastOrder(order, coinsRaw) {
    const el = document.getElementById("orderResult");
    if (!el) return;

    const coins = Number(coinsRaw || 0);
    const price = Number(order.total_price || 0);
    const profit = Number(order.profit || 0);
    const profitRatio = Number(order.products?.profit || 0);

    el.innerHTML = `
      <h3>✅ 最近订单</h3>
      <p>商品：${order.products?.name || "未知"}</p>
      <p>价格：¥${price.toFixed(2)}</p>
      <p>利润：${profitRatio}</p>
      <p>收入：+¥${profit.toFixed(2)}</p>
      <p>状态：${order.status === "completed" ? "✅ 已完成" : "⏳ 待完成"}</p>
      <p>当前金币：¥${coins.toFixed(2)}</p>
    `;
  }

  /* ======================
     初始化
     ====================== */
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("autoOrderBtn");
    if (btn) btn.addEventListener("click", autoOrder);

    checkOrderLimit();
  });
})();
