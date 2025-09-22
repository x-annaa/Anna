// =======================
// 密码可见切换
// =======================
document.querySelectorAll(".toggle-password").forEach(btn => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
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
// 生成随机平台账号（2位大写字母 + 4位数字）
// =======================
function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let account = "";
  for (let i = 0; i < 2; i++) account += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 4; i++) account += numbers[Math.floor(Math.random() * numbers.length)];
  return account;
}

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

  if (!username || !password) return alert("请输入用户名和密码");
  if (password !== confirm) return alert("两次输入的密码不一致");
  if (!agree) return alert("请先勾选同意条款");

  // 检查是否已有用户
  const { data: exist, error: existErr } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existErr) return alert("查询用户失败：" + existErr.message);
  if (exist) return alert("用户名已存在");

  // 哈希密码
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const platformAccount = generatePlatformAccount();
  const uuid = generateUUID();

  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password_hash: hash,
      coins: 0,
      balance: 0,
      platform_account: platformAccount,
      uuid
    })
    .select()
    .single();

  if (error) return alert("注册失败：" + error.message);

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);

  alert("注册成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// 登录逻辑
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) return alert("请输入用户名和密码");

  const { data, error } = await supabaseClient
    .from("users")
    .select("id, username, password_hash, platform_account, uuid")
    .eq("username", username)
    .maybeSingle();

  if (error) return alert("登录失败：" + error.message);
  if (!data) return alert("用户不存在");

  if (!bcrypt.compareSync(password, data.password_hash)) {
    return alert("密码错误");
  }

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
