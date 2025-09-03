// 页面切换 // 
const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    // 1️⃣ 先把所有导航按钮的 active 样式去掉
    buttons.forEach(b => b.classList.remove("active"));
    // 2️⃣ 给当前点击的按钮加上 active 样式
    btn.classList.add("active");

    // 3️⃣ 找到按钮上 data-page 对应的页面 ID
    const pageId = btn.dataset.page;
    // 4️⃣ 隐藏所有页面
    pages.forEach(p => p.classList.remove("active"));
    // 5️⃣ 显示对应的页面
    document.getElementById(pageId).classList.add("active");
  });
});
