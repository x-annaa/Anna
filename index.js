// ⚡ 初始化 Supabase
const SUPABASE_URL = "https://ffdrwsemmfvqlqhyjlnb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZHJ3c2VtbWZ2cWxxaHlqbG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDI1ODQsImV4cCI6MjA3MTg3ODU4NH0.x7TQHZ2af8O_f9ye__mT6eVstlH9BiyVkNVaOnL3h74";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    eyeIcon.textContent = "🙈";
  } else {
    input.type = "password";
    eyeIcon.textContent = "👁️";
  }
}

// 生成随机平台账号（2位大写字母 + 4位数字，如 AB1234）
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let acc = "";
  for (let i = 0; i < 2; i++) acc += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) acc += numbers[Math.floor(Math.random() * numbers.length)];
  return acc;
}

// 尝试创建用户（带唯一平台账号，最多重试 5 次防碰撞）
async function createUserWithUniqueAccount(username, pass) {
  const MAX_TRIES = 5;
  for (let i = 0; i < MAX_TRIES; i++) {
    const platform_account = generatePlatformAccount();
    const payload = {
      username,
      password: pass,
      balance: 0,               // 默认余额 0
      platform_account
    };

    const { error } = await supabaseClient.from("users").insert([payload]);

    if (!error) {
      return { platform_account }; // 成功
    }
    if (error.code === "23505") {
      console.warn("平台账号重复，重试生成...", platform_account);
      continue;
    }
    return { error };
  }
  return { error: { message: "生成唯一平台账号失败，请稍后重试。" } };
}

// 🔑 登录
document.getElementById("loginBtn").addEventListener("click", async function () {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password);

  if (error) {
    alert("Login failed: " + error.message);
  } else if (data && data.length > 0) {
    // ✅ 登录成功，把用户名存到 localStorage
    localStorage.setItem("currentUser", username);

    alert("Login success! Redirecting...");
    window.location.href = "frontend/home.html";
  } else {
    alert("Invalid username or password!");
  }
});

// 📝 注册
document.getElementById("registerBtn").addEventListener("click", async function () {
  const username = document.getElementById("regUsername").value.trim();
  const pass = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !pass) {
    alert("Username and password cannot be empty!");
    return;
  }
  if (pass.length < 6) {
    alert("Password must be at least 6 characters!");
    return;
  }
  if (pass !== confirm) {
    alert("Passwords do not match!");
    return;
  }
  if (!agree) {
    alert("Please agree to the terms!");
    return;
  }

  // ✅ 检查用户名是否存在
  const { data: existing, error: checkError } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username);

  if (checkError) {
    alert("Error checking user: " + checkError.message);
    return;
  }
  if (existing && existing.length > 0) {
    alert("Username already exists, please choose another!");
    return;
  }

  // ⚡ 插入新用户
  const { platform_account, error: insertError } = await createUserWithUniqueAccount(username, pass);

  if (insertError) {
    alert("Registration failed: " + (insertError.message || "Unknown error"));
  } else {
    // ✅ 插入成功，保存用户名
    localStorage.setItem("currentUser", username);

    alert("Registered successfully! 🎉\nYour Platform Account: " + platform_account);
    window.location.href = "frontend/home.html";  // 🚀 注册成功跳转
  }
});

