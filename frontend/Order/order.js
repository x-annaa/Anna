// ======================
// Order Page JS
// ======================

// Supabase 客户端
const supabaseClient = window.supabaseClient;

// DOM 元素
const startTaskBtn = document.getElementById("startTaskBtn");
const autoOrderBtn = document.getElementById("autoOrderBtn");
const taskModal = document.getElementById("taskModal");
const cancelTaskBtn = document.getElementById("cancelTask");
const taskOptions = document.querySelectorAll(".task-option");
const orderCoinsEl = document.getElementById("ordercoins");
const orderResult = document.getElementById("orderResult");

let currentTask = null; // 当前任务对象
let coins = 0;          // 用户 Coins

// ======================
// 加载用户 Coins
// ======================
async function loadCoins() {
  const userId = localStorage.getItem("currentUserId");

  const { data, error } = await supabaseClient
    .from("users")
    .select("coins")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("加载 Coins 出错:", error.message);
    return;
  }

  coins = data.coins || 0;
  orderCoinsEl.textContent = coins;
}

// ======================
// 更新用户 Coins
// ======================
async function updateCoins(newCoins) {
  const userId = localStorage.getItem("currentUserId");

  const { error } = await supabaseClient
    .from("users")
    .update({ coins: newCoins })
    .eq("id", userId);

  if (error) {
    console.error("更新 Coins 出错:", error.message);
  } else {
    coins = newCoins;
    orderCoinsEl.textContent = coins;
  }
}

// ======================
// 打开 / 关闭任务单弹窗
// ======================
startTaskBtn.addEventListener("click", () => {
  taskModal.style.display = "block";
});

cancelTaskBtn.addEventListener("click", () => {
  taskModal.style.display = "none";
});

// ======================
// 选择任务单
// ======================
taskOptions.forEach(btn => {
  btn.addEventListener("click", async () => {
    const amount = parseInt(btn.dataset.amount);
    const totalOrders = parseInt(btn.dataset.orders);

    if (coins < amount) {
      alert("Coins 不足，无法开始该任务！");
      return;
    }

    // 扣除 coins
    await updateCoins(coins - amount);

    // 创建任务
    const userId = localStorage.getItem("currentUserId");
    const { data, error } = await supabaseClient
      .from("user_tasks")
      .insert([{
        user_id: userId,
        task_amount: amount,
        total_orders: totalOrders,
        completed_orders: 0,
        task_balance: amount,
        status: "active"
      }])
      .select()
      .single();

    if (error) {
      console.error("创建任务出错:", error.message);
      return;
    }

    currentTask = data;
    taskModal.style.display = "none";
    startTaskBtn.style.display = "none";
    autoOrderBtn.style.display = "inline-block";

    renderTaskProgress();
  });
});

// ======================
// 刷单逻辑
// ======================
autoOrderBtn.addEventListener("click", async () => {
  if (!currentTask) return;

  if (currentTask.completed_orders >= currentTask.total_orders) {
    showDoneButton();
    return;
  }

  try {
    // 1️⃣ 获取随机产品
    const { data: products, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("enabled", true)
      .eq("manual_only", false);

    if (error || !products || products.length === 0) {
      alert("产品列表为空或加载失败！");
      return;
    }

    const product = products[Math.floor(Math.random() * products.length)];
    const price = Number(product.price) || 0;
    const profit = Number(product.profit) || 0;

    // 2️⃣ 检查任务余额
    if (currentTask.task_balance < price) {
      alert("任务余额不足，无法继续刷单！");
      return;
    }

    // 3️⃣ 扣除任务余额
    currentTask.task_balance -= price;

    // 4️⃣ 插入订单
    const userId = localStorage.getItem("currentUserId");
    const { data: newOrder, error: orderErr } = await supabaseClient
      .from("orders")
      .insert({
        user_id: userId,
        product_id: product.id,
        total_price: price,
        profit: profit,
        status: "completed" // 立即完成
      })
      .select(`id, total_price, profit, status, created_at, products ( name )`)
      .single();

    if (orderErr) {
      alert("下单失败：" + orderErr.message);
      return;
    }

    // 5️⃣ 更新任务信息
    currentTask.completed_orders++;
    currentTask.task_balance += (price + profit);

    const { error: taskErr } = await supabaseClient
      .from("user_tasks")
      .update({
        completed_orders: currentTask.completed_orders,
        task_balance: currentTask.task_balance
      })
      .eq("id", currentTask.id);

    if (taskErr) console.error("更新任务失败：", taskErr.message);

    renderTaskProgress();

    // 6️⃣ 检查是否完成任务
    if (currentTask.completed_orders >= currentTask.total_orders) {
      showDoneButton();
    }

  } catch (e) {
    console.error("刷单异常：", e);
    alert("刷单失败，请重试！");
  }
});

// ======================
// 渲染任务进度
// ======================
function renderTaskProgress() {
  orderResult.innerHTML = `
    当前任务：${currentTask.task_amount} - ${currentTask.completed_orders}/${currentTask.total_orders} 单
    <br>任务余额：${currentTask.task_balance.toFixed(2)}
  `;
}

// ======================
// 显示 Done 按钮
// ======================
function showDoneButton() {
  autoOrderBtn.style.display = "none";

  const doneBtn = document.createElement("button");
  doneBtn.textContent = "Done ✅";
  doneBtn.addEventListener("click", async () => {
    await updateCoins(coins + currentTask.task_balance);

    // 更新任务状态
    const { error } = await supabaseClient
      .from("user_tasks")
      .update({ status: "done" })
      .eq("id", currentTask.id);

    if (error) console.error("完成任务出错:", error.message);

    currentTask = null;
    orderResult.innerHTML = "";
    doneBtn.remove();
    startTaskBtn.style.display = "inline-block";
  });

  orderResult.appendChild(document.createElement("br"));
  orderResult.appendChild(doneBtn);
}

// ======================
// 初始化
// ======================
loadCoins();
