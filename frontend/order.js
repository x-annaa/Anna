// ⚡ Supabase 初始化
const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co";
const SUPABASE_KEY = "你的-anon-key"; // ⚠️换成你自己的
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserId = null; // 登录后赋值

// ======================
// 加载余额
// ======================
async function loadBalanceOrderPage() {
  if (!currentUserId) return;
  const { data, error } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", currentUserId)
    .single();

  if (!error && data) {
    document.getElementById("orderBalance").textContent = data.balance;
  }
}

// ======================
// 一键刷单
// ======================
async function autoOrder() {
  if (!currentUserId) {
    alert("请先登录！");
    return;
  }

  // 取所有产品
  const { data: products, error } = await supabaseClient
    .from("products")
    .select("*");

  if (error || !products || products.length === 0) {
    alert("❌ 产品列表为空！");
    return;
  }

  // 随机选一个
  const randomProduct = products[Math.floor(Math.random() * products.length)];

  // 查余额
  const { data: user } = await supabaseClient
    .from("users")
    .select("balance")
    .eq("id", currentUserId)
    .single();

  if (!user || user.balance < randomProduct.price) {
    alert("余额不足！");
    return;
  }

  const newBalance = user.balance - randomProduct.price;

  // 扣余额
  const { error: balanceError } = await supabaseClient
    .from("users")
    .update({ balance: newBalance })
    .eq("id", currentUserId);

  if (balanceError) {
    alert("扣款失败：" + balanceError.message);
    return;
  }

  // 生成订单
  const { error: orderError } = await supabaseClient
    .from("orders")
    .insert({
      user_id: currentUserId,
      product_id: randomProduct.id,
      quantity: 1,
      total_price: randomProduct.price,
    });

  if (orderError) {
    alert("下单失败：" + orderError.message);
    return;
  }

  // 显示结果
  document.getElementById("orderResult").innerHTML = `
    <h3>✅ 下单成功！</h3>
    <p>商品：${randomProduct.name}</p>
    <p>价格：¥${randomProduct.price}</p>
    <p>剩余余额：¥${newBalance}</p>
  `;

  loadBalanceOrderPage();
}

// ======================
// 绑定按钮
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("autoOrderBtn");
  if (btn) {
    btn.addEventListener("click", autoOrder);
  }
});
