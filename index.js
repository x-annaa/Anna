// 获取全局 Supabase
const supabaseClient = window.supabaseClient;

// =======================
// 密码可见切换
// =======================
document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
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

// =======================
// Tab 切换
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
// 随机平台账号
// =======================
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let acc = "";
  for (let i = 0; i < 2; i++) acc += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) acc += numbers[Math.floor(Math.random() * numbers.length)];
  return acc;
}

// =======================
// 注册逻辑
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) return alert("请输入用户名和密码");
  if (password !== confirm) return alert("两次输入的密码不一致");
  if (!agree) return alert("请先勾选同意条款");

  const { data, error } = await supabaseClient.auth.signUp({
    email: username + "@example.com",
    password
  });

  if (error) return alert("注册失败: " + error.message);

  const platformAccount = generatePlatformAccount();

  const { error: insertError } = await supabaseClient
    .from("users")
    .insert({ auth_id: data.user.id, username, coins: 0, balance: 0, traffic: 0, platform_account: platformAccount });

  if (insertError) return alert("保存用户信息失败: " + insertError.message);

  localStorage.setItem("currentUserId", data.user.id);
  localStorage.setItem("currentUser", username);

  alert("注册成功！");
  window.location.href = "HOME.html";
});

// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!username || !password) return alert("请输入用户名和密码");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: username + "@example.com",
    password
  });

  if (error) return alert("登录失败: " + error.message);

  localStorage.setItem("currentUserId", data.user.id);
  localStorage.setItem("currentUser", username);

  alert("登录成功！");
  window.location.href = "HOME.html";
});
