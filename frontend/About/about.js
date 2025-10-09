// ===================== About 页面逻辑 ===================== //

document.addEventListener("DOMContentLoaded", () => {
  const msgPage = document.getElementById("msgPage");

  // 动态生成 About 内容
  msgPage.innerHTML = `
    <div class="about-container">
      <img class="about-logo" src="https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Photos/123.jpg" alt="平台Logo">
      <h2>关于我们</h2>
      <p>
        欢迎来到 <strong>U9 平台</strong>！我们致力于为用户提供一个安全、高效、便捷的在线购物与服务体验。
        在这里，您可以浏览商品、完成订单、参与活动并享受专属客服支持。
      </p>

      <div class="about-section">
        <h3>我们的使命</h3>
        <p>
          我们的目标是让每一位用户都能通过 U9 发现更多优质商品，
          同时为合作伙伴提供一个透明、公正的交易环境。
        </p>
      </div>

      <div class="about-section">
        <h3>平台优势</h3>
        <ul>
          <li>✅ 安全的账户与资产管理体系</li>
          <li>🚀 极速的交易与订单处理</li>
          <li>💬 7×24 在线客服支持</li>
          <li>📱 移动端与桌面端双平台适配</li>
        </ul>
      </div>

      <div class="about-section about-contact">
        <h3>联系我们</h3>
        <p>Telegram 客服账号：<strong id="tgName">@U9_support</strong></p>
        <button id="copyTgBtn">复制账号</button>
      </div>

      <div class="about-section">
        <p style="text-align:center; margin-top:25px; font-size:13px; color:#888;">
          © 2025 U9 Platform. All Rights Reserved.
        </p>
      </div>
    </div>
  `;

  // Telegram 复制功能
  const copyTgBtn = document.getElementById("copyTgBtn");
  const tgName = document.getElementById("tgName");

  copyTgBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(tgName.textContent);
      copyTgBtn.textContent = "✅ 已复制";
      setTimeout(() => (copyTgBtn.textContent = "复制账号"), 2000);
    } catch (err) {
      alert("复制失败，请手动复制。");
    }
  });
});
