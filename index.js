// =======================
// 密码可见切换
// =======================
document.addEventListener("DOMContentLoaded", () => {
  const toggleButtons = document.querySelectorAll(".toggle-password");
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
      } else {
        input.type = "password";
        btn.textContent = "👁️";
      }
    });
  });
});


// =======================
// 登录 / 注册 Tab 切换
// =======================
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showLoginBtn = document.getElementById("showLogin");
const showRegisterBtn = document.getElementById("showRegister");

showLoginBtn.addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  showLoginBtn.classList.add("active");
  showRegisterBtn.classList.remove("active");
});

showRegisterBtn.addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  showLoginBtn.classList.remove("active");
  showRegisterBtn.classList.add("active");
});

// =======================
// 生成随机平台账号（2位大写字母 + 4位数字，如 AB1234）
// =======================
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let acc = "";
  for (let i = 0; i < 2; i++) acc += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) acc += numbers[Math.floor(Math.random() * numbers.length)];
  return acc;
}

document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;
  const msgDiv = document.getElementById("registerMsg");

  msgDiv.textContent = ""; // 清空提示

  if (!username || !password) {
    msgDiv.textContent = "请输入用户名和密码";
    msgDiv.style.color = "red";
    return;
  }
  if (password !== confirm) {
    msgDiv.textContent = "两次输入的密码不一致";
    msgDiv.style.color = "red";
    return;
  }
  if (!agree) {
    msgDiv.textContent = "请先勾选同意条款";
    msgDiv.style.color = "red";
    return;
  }

  // 检查是否已有用户名
  const { data: exist } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (exist) {
    msgDiv.textContent = "该用户名已存在，请换一个";
    msgDiv.style.color = "red";
    return;
  }

  // 生成唯一平台账号
  const platformAccount = await generateUniquePlatformAccount();

  // 插入新用户
  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password, // ⚠️ 明文存储不安全，建议 hash
      coins: 0,
      balance: 0,
      traffic: 0,
      platform_account: platformAccount
    })
    .select()
    .single();

  if (error) {
    msgDiv.textContent = "注册失败: " + error.message;
    msgDiv.style.color = "red";
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);

  msgDiv.textContent = "注册成功！";
  msgDiv.style.color = "green";

  // 可以延迟跳转，让用户看到提示
  setTimeout(() => {
    window.location.href = "frontend/HOME.html";
  }, 800);
});


// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msgDiv = document.getElementById("loginMsg");

  msgDiv.textContent = ""; // 清空提示

  if (!username || !password) {
    msgDiv.textContent = "请输入用户名和密码";
    msgDiv.style.color = "red";
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, username, password, platform_account")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    msgDiv.textContent = "登录失败: " + error.message;
    msgDiv.style.color = "red";
    return;
  }
  if (!data) {
    msgDiv.textContent = "用户不存在";
    msgDiv.style.color = "red";
    return;
  }
  if (data.password !== password) {
    msgDiv.textContent = "密码错误";
    msgDiv.style.color = "red";
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);

  msgDiv.textContent = "登录成功！";
  msgDiv.style.color = "green";

  setTimeout(() => {
    window.location.href = "frontend/HOME.html";
  }, 500);
});
