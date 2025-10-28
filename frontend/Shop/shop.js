// 搜索框功能（示例，需根据你的商品数据修改）
const shopSearchInput = document.getElementById("shopSearchInput");

if (shopSearchInput) {
  shopSearchInput.addEventListener("input", function () {
    const keyword = shopSearchInput.value.toLowerCase();
    const items = document.querySelectorAll(".ad-item");

    items.forEach(item => {
      const name = item.getAttribute("data-name") || ""; 
      item.style.display = name.toLowerCase().includes(keyword)
        ? "block"
        : "none";
    });
  });
}

// 点击购物车按钮 → 跳转订单页并自动打开历史
document.getElementById("cartBtn").addEventListener("click", function () {
  document.querySelector(`[data-page="orderPage"]`).click();

  setTimeout(() => {
    const historyBtn = document.querySelector(".left-box");
    if (historyBtn) historyBtn.click();
  }, 200);
});
