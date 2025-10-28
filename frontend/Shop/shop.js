document.addEventListener("DOMContentLoaded", () => {
    // 显示当前用户信息到 Buy 弹窗
    const username = localStorage.getItem("currentUser") || "";
    const platform = localStorage.getItem("platformAccount") || "";

    document.getElementById("buyUsername").innerText = username;
    document.getElementById("buyPlatform").innerText = platform;

    // 加载产品列表
    loadShopProducts();
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
                <button class="buyBtn" data-id="${item.id}">Buy</button>
            `;
            shopContainer.appendChild(productDiv);
        });

        addBuyButtonListeners();

    } catch (e) {
        console.error("⚠️ Unexpected error:", e);
    }
}

// Buy 弹窗按钮事件
function addBuyButtonListeners() {
    const buyButtons = document.querySelectorAll(".buyBtn");
    const buyModal = document.getElementById("buyModal");

    // 点击 Buy 显示弹窗
    buyButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const productId = btn.getAttribute("data-id");
            buyModal.dataset.id = productId;
            buyModal.style.display = "flex";
        });
    });

    // 取消按钮
    document.getElementById("cancelBuy").addEventListener("click", () => {
        buyModal.style.display = "none";
    });

    // 确认提交订单
    document.getElementById("confirmBuy").addEventListener("click", async () => {
        const productId = buyModal.dataset.id;
        const userId = localStorage.getItem("currentUserId");
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
            // 获取产品价格
            const { data: product, error: prodErr } = await supabaseClient
                .from("products2")
                .select("id, price")
                .eq("id", productId)
                .maybeSingle();

            if (prodErr || !product) throw new Error(prodErr?.message || "Product not found");

            // 获取用户余额
            const { data: user, error: userErr } = await supabaseClient
                .from("users")
                .select("id, balance")
                .eq("id", userId)
                .maybeSingle();

            if (userErr || !user) throw new Error(userErr?.message || "User not found");

            if (user.balance < product.price) {
                alert("❌ Not enough balance to buy this product");
                return;
            }

            // 扣除余额
            const { error: deductErr } = await supabaseClient
                .from("users")
                .update({ balance: user.balance - product.price })
                .eq("id", userId);

            if (deductErr) throw new Error(deductErr.message);

            // 调用 RPC 插入 order_reviews
            const { data: order, error: orderErr } = await supabaseClient.rpc('add_order_review', {
                p_product_id: productId,
                p_user_id: userId,
                p_username: username,
                p_platform: platform,
                p_address: address,
                p_phone: phone,
                p_email: email
            });

            if (orderErr) throw new Error(orderErr.message);

            alert("✅ Your order has been submitted for review!");
            buyModal.style.display = "none";

            // 清空输入框
            document.getElementById("buyAddress").value = "";
            document.getElementById("buyPhone").value = "";
            document.getElementById("buyEmail").value = "";

        } catch (e) {
            console.error("❌ Failed to submit order:", e.message);
            alert("Failed to submit order: " + e.message);
        }
    });
}
