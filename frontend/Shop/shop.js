document.addEventListener("DOMContentLoaded", () => {
    // 显示当前用户信息到 Buy 弹窗
    const username = localStorage.getItem("currentUser") || "";
    const platform = localStorage.getItem("platformAccount") || "";

    document.getElementById("buyUsername").innerText = username;
    document.getElementById("buyPlatform").innerText = platform;

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
            productDiv.classList.add("product-card");
            productDiv.innerHTML = `
                <img src="${item.image1_url}" class="product-image" alt="product" />
                <div class="product-info">
                    <h4>Code: ${item.product_code}</h4>
                    <p>Rating: ⭐ ${item.rating}</p>
                    <p>Price: $${item.price ? item.price.toFixed(2) : "0.00"}</p>
                    <button class="buyBtn" data-id="${item.id}">Buy</button>
                </div>
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
            buyModal.dataset.id = productId;
            buyModal.style.display = "flex";
        });
    });

    // 取消按钮
    document.getElementById("cancelBuy").addEventListener("click", () => {
        buyModal.style.display = "none";
    });

    // 确认提交
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
            // 1️⃣ 获取产品信息
            const { data: product, error: prodErr } = await supabaseClient
                .from("products2")
                .select("id, product_code, price")
                .eq("id", productId)
                .maybeSingle();

            if (prodErr || !product) {
                alert("Product not found!");
                return;
            }

            const productPrice = parseFloat(product.price || 0);

            // 2️⃣ 获取用户余额
            const { data: user, error: userErr } = await supabaseClient
                .from("users")
                .select("balance")
                .eq("id", userId)
                .maybeSingle();

            if (userErr || !user) {
                alert("User not found!");
                return;
            }

            if (user.balance < productPrice) {
                alert("Insufficient balance!");
                return;
            }

            // 3️⃣ 扣除余额
            const newBalance = parseFloat(user.balance) - productPrice;
            const { error: updateErr } = await supabaseClient
                .from("users")
                .update({ balance: newBalance })
                .eq("id", userId);

            if (updateErr) {
                alert("Failed to deduct balance: " + updateErr.message);
                return;
            }

            // 4️⃣ 提交到审核表
            const { data: review, error: reviewErr } = await supabaseClient
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

            if (reviewErr) {
                alert("Failed to submit order: " + reviewErr.message);
                return;
            }

            alert(`✅ Order submitted! Balance deducted: $${productPrice.toFixed(2)}`);
            buyModal.style.display = "none";

            // 清空输入框
            document.getElementById("buyAddress").value = "";
            document.getElementById("buyPhone").value = "";
            document.getElementById("buyEmail").value = "";

            // 更新余额显示
            document.getElementById("balance").innerText = newBalance.toFixed(2);

        } catch (e) {
            console.error("⚠️ Unexpected error:", e);
            alert("An unexpected error occurred.");
        }
    });
}
