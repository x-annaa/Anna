document.addEventListener("DOMContentLoaded", () => {
  const page = document.getElementById("msgPage");
  if (!page) return;

  page.innerHTML = `
    <h1>ℹ️ 关于我们</h1>
    
    <div class="content-block">
      <p><span class="emoji">🎉</span> 欢迎来到我们的可爱平台！</p>
      <p>我们致力于提供轻松愉快的购物体验，让每一笔订单都充满乐趣。</p>
    </div>

    <div class="content-block">
      <p><span class="emoji">💌</span> 联系我们：</p>
      <p>Email: support@example.com</p>
      <p>电话: +123 456 7890</p>
    </div>

    <div class="content-block">
      <p><span class="emoji">⚡</span> 版权信息：</p>
      <p>© 2025 可爱平台 All rights reserved.</p>
    </div>

    <hr>

    <div class="content-block">
      <p><span class="emoji">✨</span> 我们的愿景：</p>
      <p>用创意和热情，让每一次购物都成为小小惊喜！</p>
    </div>
  `;
});
