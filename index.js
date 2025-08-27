// 临时存储在浏览器 localStorage
function register() {
  const username = document.getElementById("regUsername").value;
  const password = document.getElementById("regPassword").value;

  if (username && password) {
    localStorage.setItem("username", username);
    localStorage.setItem("password", password);
    document.getElementById("message").innerText = "✅ Registration successful! Please login.";
  } else {
    document.getElementById("message").innerText = "⚠️ Please fill all fields.";
  }
}

function login() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;

  const savedUser = localStorage.getItem("username");
  const savedPass = localStorage.getItem("password");

  if (username === savedUser && password === savedPass) {
    document.getElementById("message").innerText = "✅ Login successful!";
    // 登录成功 → 跳转
    window.location.href = "frontend/home.html";
  } else {
    document.getElementById("message").innerText = "❌ Invalid credentials.";
  }
}
