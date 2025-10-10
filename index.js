const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("adminPassword");
const errorMsg = document.getElementById("errorMsg");

// 这里设置管理员密码
const ADMIN_PASSWORD = "1"; // ⚠️ 可以改成你自己的密码

loginBtn.addEventListener("click", () => {
  const inputPwd = passwordInput.value.trim();

  if (!inputPwd) {
    errorMsg.textContent = "请输入密码！";
    return;
  }

  if (inputPwd === ADMIN_PASSWORD) {
    // 密码正确，跳转到 home.html
    window.location.href = "backend/home.html";
  } else {
    // 密码错误
    errorMsg.textContent = "密码错误，请重试！";
    passwordInput.value = "";
    passwordInput.focus();
  }
});
