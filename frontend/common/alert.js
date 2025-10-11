// === 全局自定义 alert() 替换 ===
window.alert = function(message) {
  let overlay = document.getElementById("customAlert");
  if (!overlay) {
    // 如果 alert 容器不存在，动态创建它（适用于任何页面）
    overlay = document.createElement("div");
    overlay.id = "customAlert";
    overlay.className = "alert-overlay";
    overlay.innerHTML = `
      <div class="alert-box">
        <p id="alertText"></p>
        <button id="alertOk">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const text = document.getElementById("alertText");
  const ok = document.getElementById("alertOk");

  text.textContent = message;
  overlay.style.display = "flex";

  ok.onclick = () => {
    overlay.style.display = "none";
  };
};
