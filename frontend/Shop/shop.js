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
            productDiv.classList.add("container-s4");
            productDiv.innerHTML = `
                <img src="${item.image1_url}" class="product-image" alt="product" />
                <p><strong>Code:</strong> ${item.product_code}</p>
                <p><strong>Price:</strong> $${item.price.toFixed(2)}</p>
                <p><strong>Rating:</strong> ⭐ ${item.rating}</p>
                <button class="buyBtn" data-id="${item.id}" data-price="${item.price}">Buy</button>
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
        const productId = buyModal.dataset.id;
        const productPrice = parseFloat(buyModal.dataset.price);
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
            // 1️⃣ 获取用户余额
            const { data: user, error: userErr } = await supabaseClient
                .from("users")
                .select("balance")
                .eq("id", userId)
                .maybeSingle();

            if (userErr || !user) {
                alert("Failed to fetch user balance");
                return;
            }

            if (user.balance < productPrice) {
                alert("❌ Insufficient balance. Please recharge.");
                return;
            }

            // 2️⃣ 扣除余额
            const { data: updatedUser, error: updateErr } = await supabaseClient
                .from("users")
                .update({ balance: user.balance - productPrice })
                .eq("id", userId)
                .select()
                .single();

            if (updateErr) {
                alert("Failed to deduct balance: " + updateErr.message);
                return;
            }

            // 3️⃣ 提交订单到审核表
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
                alert("Failed to submit order: " + error.message);
                return;
            }

            alert("✅ Order submitted for review! Balance has been deducted.");
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
