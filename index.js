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
// 生成 UUID
// =======================
function generateUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

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

  const uuid = generateUUID(); // 自动生成 UUID
  const sessionToken = generateUUID(); // 新增 session_token

  // 插入新用户
  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password, // ⚠️ 明文存储不安全，建议 hash
      coins: 0,
      balance: 0,
      uuid,
      session_token: sessionToken // 保存 token
      // platform_account 由数据库生成
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
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);
  localStorage.setItem("sessionToken", sessionToken); // 保存 token

  alert("注册成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// 登录逻辑 (带 session_token)
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
    .select("id, username, password, platform_account, uuid")
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

  // === 生成新的 session_token ===
  const sessionToken = generateUUID();

  // 更新数据库中的 session_token
  const { error: updateErr } = await supabaseClient
    .from("users")
    .update({ session_token: sessionToken })
    .eq("id", data.id);

  if (updateErr) {
    alert("更新 session 失败: " + updateErr.message);
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);
  localStorage.setItem("sessionToken", sessionToken);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
