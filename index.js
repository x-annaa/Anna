// 翻译字典
const translations = {
  en: {
    title: "Welcome",
    description: "Please register or login below:",
    username: "Username",
    password: "Password",
    confirm: "Confirm Password",
    login: "Login",
    register: "Register",
    agree: "✅ I agree to the terms"
  },
  zh: {
    title: "欢迎",
    description: "请在下方注册或登录：",
    username: "用户名",
    password: "密码",
    confirm: "确认密码",
    login: "登录",
    register: "注册",
    agree: "✅ 我已阅读并同意条款"
  },
  jp: {
    title: "ようこそ",
    description: "以下から登録またはログインしてください：",
    username: "ユーザー名",
    password: "パスワード",
    confirm: "確認パスワード",
    login: "ログイン",
    register: "登録",
    agree: "✅ 利用規約に同意します"
  }
};

// 更新语言
function updateLanguage(lang) {
  document.getElementById("title").textContent = translations[lang].title;
  document.getElementById("description").textContent = translations[lang].description;
  
  document.getElementById("loginUsername").placeholder = translations[lang].username;
  document.getElementById("loginPassword").placeholder = translations[lang].password;
  document.getElementById("loginBtn").textContent = translations[lang].login;
  
  document.getElementById("regUsername").placeholder = translations[lang].username;
  document.getElementById("regPassword").placeholder = translations[lang].password;
  document.getElementById("regConfirmPassword").placeholder = translations[lang].confirm;
  document.getElementById("registerBtn").textContent = translations[lang].register;
  document.querySelector(".agreement").innerHTML = `<input type="checkbox" id="agreeTerms"> ${translations[lang].agree}`;
}

document.getElementById("language").addEventListener("change", function () {
  updateLanguage(this.value);
});

// 切换窗口
document.getElementById("showLogin").addEventListener("click", () => {
  document.getElementById("loginForm").classList.remove("hidden");
  document.getElementById("registerForm").classList.add("hidden");
  document.getElementById("showLogin").classList.add("active");
  document.getElementById("showRegister").classList.remove("active");
});

document.getElementById("showRegister").addEventListener("click", () => {
  document.getElementById("registerForm").classList.remove("hidden");
  document.getElementById("loginForm").classList.add("hidden");
  document.getElementById("showRegister").classList.add("active");
  document.getElementById("showLogin").classList.remove("active");
});

// 密码显示/隐藏
function togglePassword(inputId, eyeIcon) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    eyeIcon.textContent = "🙈"; // 切换图标
  } else {
    input.type = "password";
    eyeIcon.textContent = "👁️";
  }
}

// 登录跳转
document.getElementById("loginBtn").addEventListener("click", function () {
  alert("Login success! Redirecting...");
  window.location.href = "frontend/home.html";
});

// 注册验证
document.getElementById("registerBtn").addEventListener("click", function () {
  const pass = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (pass !== confirm) {
    alert("Passwords do not match!");
    return;
  }
  if (!agree) {
    alert("Please agree to the terms!");
    return;
  }

  alert("Registered successfully (demo, not saved yet).");
});
