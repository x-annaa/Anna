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
// Tab 切换
// =======================
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
document.getElementById("showLogin").addEventListener("click", () => {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
});
document.getElementById("showRegister").addEventListener("click", () => {
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

// =======================
// 生成随机平台账号（前两位大写字母 + 后四位数字）
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

  // 检查用户名是否存在
  const { data: exist } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (exist) return alert("该用户名已存在，请换一个");

  // 生成平台账号和密码哈希
  const platformAccount = generatePlatformAccount();
  const uuid = crypto.randomUUID();
  const password_hash = bcrypt.hashSync(password, 10);

  // 插入用户
  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password_hash,
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

  if (error) return alert("登录失败: " + error.message);
  if (!data) return alert("用户不存在");
  if (!bcrypt.compareSync(password, data.password_hash)) return alert("密码错误");

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
