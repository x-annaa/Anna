// ===================== About 页面逻辑 ===================== //

document.addEventListener("DOMContentLoaded", () => {
  const msgPage = document.getElementById("msgPage");

  // About 页面容器结构
  msgPage.innerHTML = `
    <div class="about-container">
      <h2>关于我们</h2>

      <div class="about-grid">
        <div class="about-item">
          <img src="https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/331.png" alt="图1">
          <p>高效的商品交易系统</p>
        </div>
        <div class="about-item">
          <img src="https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/332.png" alt="图2">
          <p>安全的账户与资金管理</p>
        </div>
        <div class="about-item">
          <img src="https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Home%20Photos/333.png" alt="图3">
          <p>多平台统一体验</p>
        </div>
      </div>

      <div class="robot-section">
        <h3>🤖 智能客服助理</h3>
        <img src="https://airkbwolmkidaokqhxjj.supabase.co/storage/v1/object/public/Photos/robot.gif" alt="机器人动画">
      </div>
    </div>
  `;
});
