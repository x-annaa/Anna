// ======================
// 当前登录用户信息
// ======================
let currentUser = null;

// ======================
// 页面初始化
// ======================
document.addEventListener("DOMContentLoaded", async () => {
  const username = localStorage.getItem("currentUser");
  if (!username) {
    window.location.href = "../index.html";
    return;
  }

  await loadUserInfo(username);
  setupOrderActions();
  setupAddCoinsModal();
  setupRealtimeListeners();
});

// ======================
// 加载用户信息
// ======================
async function loadUserInfo(username) {
  try {
    const { data, error } = await supabaseClient
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      console.error("加载用户信息失败：", error?.message);
      document.getElementById("ordercoins").textContent = "错误";
      return;
    }

    currentUser = data;
    document.getElementById("ordercoins").textContent = Number(data.coins || 0).toFixed(2);
  } catch (e) {
    console.error("加载用户信息异常：", e);
  }
}

// ======================
// 订单操作按钮
// ======================
function setupOrderActions() {
  const autoOrderBtn = document.getElementById("autoOrderBtn");

  autoOrderBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const coinsRequired = 1; // 每次刷单消耗 Coins
    if (currentUser.coins < coinsRequired) {
      alert("Coins 不足，请先兑换 Coins！");
      return;
    }

    try {
      // 扣除 Coins
      const { data: updatedUser, error: updateError } = await supabaseClient
        .from("users")
        .update({ coins: currentUser.coins - coinsRequired })
        .eq("id", currentUser.id)
        .select()
        .single();

      if (updateError) throw updateError;

      currentUser.coins = updatedUser.coins;
      document.getElementById("ordercoins").textContent = currentUser.coins.toFixed(2);

      // 生成订单
      const { data: orderData, error: orderError } = await supabaseClient
        .from("orders")
        .insert([{
          user_id: currentUser.id,
          product_id: 1,           // 默认 product
          quantity: 1,
          total_price: coinsRequired,
          profit: 0,
          status: "pending",
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      addOrderHistory(orderData);
      alert("订单已生成，等待处理！");
    } catch (e) {
      console.error("一键刷单失败：", e.message);
      alert("订单操作失败：" + e.message);
    }
  });
}

// ======================
// 显示订单历史
// ======================
async function loadOrderHistory() {
  if (!currentUser) return;

  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const recentOrders = document.getElementById("recentOrders");
    recentOrders.innerHTML = "";
    if (!data.length) {
      recentOrders.innerHTML = "<li>暂无订单！</li>";
      return;
    }

    data.forEach(order => addOrderHistory(order));
  } catch (e) {
    console.error("加载订单历史失败：", e.message);
  }
}

// ======================
// 添加单条订单到页面
// ======================
function addOrderHistory(order) {
  const li = document.createElement("li");
  li.textContent = `订单ID: ${order.id}, 数量: ${order.quantity}, 总价: ${order.total_price}, 状态: ${order.status}, 时间: ${new Date(order.created_at).toLocaleString()}`;
  const recentOrders = document.getElementById("recentOrders");
  recentOrders.prepend(li);
}

// ======================
// 兑换 Coins 弹窗
// ======================
function setupAddCoinsModal() {
  const addCoinsBtn = document.getElementById("addCoinsBtn");
  const addCoinsModal = document.getElementById("addCoinsModal");
  const cancelAddCoins = document.getElementById("cancelAddCoins");
  const confirmAddCoins = document.getElementById("confirmAddCoins");
  const addCoinsInput = document.getElementById("addCoinsInput");

  addCoinsBtn.addEventListener("click", () => {
    addCoinsModal.style.display = "flex";
  });

  cancelAddCoins.addEventListener("click", () => {
    addCoinsModal.style.display = "none";
    addCoinsInput.value = "";
  });

  confirmAddCoins.addEventListener("click", async () => {
    const amount = parseFloat(addCoinsInput.value);
    if (!amount || amount <= 0) {
      alert("请输入有效的兑换数量");
      return;
    }
    if (amount > currentUser.balance) {
      alert("余额不足！");
      return;
    }

    try {
      // 扣 Balance 增 Coins
      const { data, error } = await supabaseClient
        .from("users")
        .update({
          balance: currentUser.balance - amount,
          coins: currentUser.coins + amount
        })
        .eq("id", currentUser.id)
        .select()
        .single();

      if (error) throw error;

      currentUser.balance = data.balance;
      currentUser.coins = data.coins;
      document.getElementById("ordercoins").textContent = currentUser.coins.toFixed(2);
      alert(`成功兑换 ${amount} Coins`);

      addCoinsModal.style.display = "none";
      addCoinsInput.value = "";
    } catch (e) {
      console.error("兑换 Coins 失败：", e.message);
      alert("兑换失败：" + e.message);
    }
  });
}

// ======================
// 实时监听 Coins 和订单变化
// ======================
function setupRealtimeListeners() {
  // 监听 Coins 更新
  supabaseClient
    .channel(`public:users:id=eq.${currentUser.id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${currentUser.id}` },
      (payload) => {
        currentUser.coins = payload.new.coins;
        document.getElementById("ordercoins").textContent = currentUser.coins.toFixed(2);
      }
    )
    .subscribe();

  // 监听新订单
  supabaseClient
    .channel(`public:orders:user_id=eq.${currentUser.id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders", filter: `user_id=eq.${currentUser.id}` },
      (payload) => addOrderHistory(payload.new)
    )
    .subscribe();

  // 页面初始加载历史订单
  loadOrderHistory();
}
