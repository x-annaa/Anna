// =======================
// 密码可见切换
// =======================
window.togglePassword = function (id, el) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    el.textContent = "🙈";
  } else {
    input.type = "password";
    el.textContent = "👁️";
  }
};

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
// 注册逻辑
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }
  if (password !== confirm) {
    alert("两次输入的密码不一致");
    return;
  }
  if (!agree) {
    alert("请先勾选同意条款");
    return;
  }

  // 检查是否已有用户
  const { data: exist } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (exist) {
    alert("该用户名已存在，请换一个");
    return;
  }

  // 插入新用户
  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password, // ⚠️ 明文存储不安全，建议 hash
      coins: 0,
      balance: 0
    })
    .select()
    .single();

  if (error) {
    alert("注册失败: " + error.message);
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);

  alert("注册成功！");
  window.location.href = "frontend/home.html";
});

// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, username, password")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    alert("登录失败: " + error.message);
    return;
  }
  if (!data) {
    alert("用户不存在");
    return;
  }
  if (data.password !== password) {
    alert("密码错误");
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);

  alert("登录成功！");
  window.location.href = "frontend/home.html";
});
