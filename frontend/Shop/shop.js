document.addEventListener("DOMContentLoaded", async () => {
    // 显示当前用户信息到 Buy 弹窗
    const username = localStorage.getItem("currentUser") || "";
    const platform = localStorage.getItem("platformAccount") || "";

    document.getElementById("buyUsername").innerText = username;
    document.getElementById("buyPlatform").innerText = platform;

    await loadShopProducts();
});

// 加载 products2 表数据
async function loadShopProducts() {
    try {
        const { data: products2, error } = await supabaseClient
            .from("products2")
            .select("*");

        if (error) {
            console.error("❌ Failed to load products2:", error.message);
            return;
        }

        const shopContainer = document.getElementById("shopProducts");
        shopContainer.innerHTML = "";

        products2.forEach(item => {
            const productDiv = document.createElement("div");
            productDiv.classList.add("container-s4");
            productDiv.innerHTML = `
                <img src="${item.image1_url}" class="product-image" alt="product" />
                <p><strong>Code:</strong> ${item.product_code}</p>
                <p><strong>Price:</strong> $${item.price?.toFixed(2) || 0}</p>
                <p><strong>Rating:</strong> ⭐ ${item.rating}</p>
                <button class="buyBtn" data-id="${item.id}" data-price="${item.price || 0}">Buy</button>
            `;
            shopContainer.appendChild(productDiv);
        });

        addBuyButtonListeners();

    } catch (e) {
        console.error("⚠️ Unexpected error:", e);
    }
}

// Buy 模态框事件
function addBuyButtonListeners() {
    const buyButtons = document.querySelectorAll(".buyBtn");
    const buyModal = document.getElementById("buyModal");

    buyButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const productId = btn.getAttribute("data-id");
            const price = parseFloat(btn.getAttribute("data-price"));
            buyModal.dataset.id = productId;
            buyModal.dataset.price = price;
            buyModal.style.display = "flex";
        });
    });

    // 取消按钮
    document.getElementById("cancelBuy").addEventListener("click", () => {
        buyModal.style.display = "none";
    });

    // 确认提交
    document.getElementById("confirmBuy").addEventListener("click", async () => {
        const productId = parseInt(buyModal.dataset.id);
        const price = parseFloat(buyModal.dataset.price);
        const userId = parseInt(localStorage.getItem("currentUserId"));
        const username = localStorage.getItem("currentUser");
        const platform = localStorage.getItem("platformAccount");
        const address = document.getElementById("buyAddress").value.trim();
        const phone = document.getElementById("buyPhone").value.trim();
        const email = document.getElementById("buyEmail").value.trim();

        if (!address || !phone || !email) {
            alert("Please fill out all fields");
            return;
        }

        try {
            // 先刷新 schema cache 避免 product_id 找不到
            await supabaseClient.from("order_reviews").select("*").limit(1);

            // 获取用户当前余额
            const { data: userData, error: userErr } = await supabaseClient
                .from("users")
                .select("balance")
                .eq("id", userId)
                .maybeSingle();

            if (userErr || !userData) {
                alert("Failed to get user balance");
                return;
            }

            if (userData.balance < price) {
                alert("❌ Not enough balance to buy this product");
                return;
            }

            // 扣除余额
            const { error: updateErr } = await supabaseClient
                .from("users")
                .update({ balance: userData.balance - price })
                .eq("id", userId);

            if (updateErr) {
                alert("Failed to deduct balance: " + updateErr.message);
                return;
            }

            // 插入订单审核表
            const { data, error } = await supabaseClient
                .from("order_reviews")
                .insert({
                    product_id: productId,
                    user_id: userId,
                    username,
                    platform,
                    address,
                    phone,
                    email,
                    status: "pending"
                })
                .select()
                .single();

            if (error) {
                console.error("❌ Failed to submit order:", error.message);
                alert("Failed to submit order: " + error.message);
                return;
            }

            alert(`✅ Your order has been submitted for review! $${price.toFixed(2)} has been deducted from your balance.`);
            buyModal.style.display = "none";

            // 清空输入框
            document.getElementById("buyAddress").value = "";
            document.getElementById("buyPhone").value = "";
            document.getElementById("buyEmail").value = "";

        } catch (e) {
            console.error("⚠️ Unexpected error:", e);
            alert("An unexpected error occurred.");
        }
    });
}
