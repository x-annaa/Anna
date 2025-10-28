document.addEventListener("DOMContentLoaded", () => {
    loadShopProducts();
});

// 加载 products2 表数据
async function loadShopProducts() {
    try {
        const { data: products2, error } = await supabaseClient
            .from("products2")
            .select("*");

        if (error) {
            console.error("❌ Failed to load product2:", error.message);
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

    document.getElementById("cancelBuy").addEventListener("click", () => {
        buyModal.style.display = "none";
    });

    document.getElementById("confirmBuy").addEventListener("click", async () => {
        const productId = buyModal.dataset.id;
        const username = document.getElementById("buyUsername").innerText;
        const platform = document.getElementById("buyPlatform").innerText;
        const address = document.getElementById("buyAddress").value;
        const phone = document.getElementById("buyPhone").value;
        const email = document.getElementById("buyEmail").value;

        if (!address || !phone || !email) {
            alert("Please fill out all fields");
            return;
        }

        console.log("✅ Submit order:", { productId, username, platform });

        alert("✅ Your order has been submitted for review!");
        buyModal.style.display = "none";
    });
}
