// 翻译字典
const translations = {
  en: {
    title: "Welcome",
    description: "Please register or login below:",
    username: "Username",
    password: "Password",
    register: "Register",
    login: "Login"
  },
  zh: {
    title: "欢迎",
    description: "请在下方注册或登录：",
    username: "用户名",
    password: "密码",
    register: "注册",
    login: "登录"
  },
  jp: {
    title: "ようこそ",
    description: "以下から登録またはログインしてください：",
    username: "ユーザー名",
    password: "パスワード",
    register: "登録",
    login: "ログイン"
  }
};

// 切换语言函数
function updateLanguage(lang) {
  document.getElementById("title").textContent = translations[lang].title;
  document.getElementById("description").textContent = translations[lang].description;
  document.getElementById("username").placeholder = translations[lang].username;
  document.getElementById("password").placeholder = translations[lang].password;
  document.getElementById("registerBtn").textContent = translations[lang].register;
  document.getElementById("loginBtn").textContent = translations[lang].login;
}

// 监听语言切换
document.getElementById("language").addEventListener("change", function () {
  updateLanguage(this.value);
});

// 登录按钮跳转（先模拟，不连数据库）
document.getElementById("loginBtn").addEventListener("click", function () {
  alert("Login success! Redirecting...");
  window.location.href = "frontend/home.html"; // 登录后跳转
});

// 注册按钮
document.getElementById("registerBtn").addEventListener("click", function () {
  alert("Registered successfully (demo, not saved yet).");
});
