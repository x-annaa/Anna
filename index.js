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

// =======================
// 注册逻辑（Supabase Auth + users 表）
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  if (!username || !password) return alert("请输入用户名和密码");
  if (password !== confirm) return alert("两次输入的密码不一致");
  if (!agree) return alert("请先勾选同意条款");

  try {
    // 1️⃣ 用 Supabase Auth 注册
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: username + "@fakeemail.com", // 用伪造 email
      password
    });

    if (authError) return alert("注册失败：" + authError.message);

    const userId = authData.user.id; // Supabase Auth 用户 id

    // 2️⃣ 检查 users 表是否已有该 username
    const { data: exist } = await supabaseClient
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (exist) return alert("该用户名已存在，请换一个");

    // 3️⃣ 插入 users 表自定义信息
    const platformAccount = generatePlatformAccount();
    const { data, error } = await supabaseClient
      .from("users")
      .insert({
        id: userId,          // 用 Auth 用户 id
        username,
        coins: 0,
        balance: 0,
        traffic: 0,
        platform_account: platformAccount
      })
      .select()
      .single();

    if (error) return alert("注册失败: " + error.message);

    // 4️⃣ 保存 session 和 localStorage
    const session = await supabaseClient.auth.getSession();
    localStorage.setItem("currentUserId", userId);
    localStorage.setItem("currentUser", username);
    localStorage.setItem("platformAccount", platformAccount);

    alert("注册成功！");
    window.location.href = "frontend/HOME.html";

  } catch (err) {
    console.error(err);
    alert("操作异常，请重试");
  }
});

// =======================
// 登录逻辑（Supabase Auth + users 表）
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) return alert("请输入用户名和密码");

  try {
    // 1️⃣ 使用 Supabase Auth 登录
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: username + "@fakeemail.com",
      password
    });

    if (authError) return alert("登录失败：" + authError.message);
    const session = authData.session;
    if (!session) return alert("登录失败，未获取 session");

    // 2️⃣ 获取 users 表信息
    const { data, error } = await supabaseClient
      .from("users")
      .select("id, username, platform_account")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !data) return alert("获取用户信息失败");

    // 3️⃣ 保存 localStorage
    localStorage.setItem("currentUserId", data.id);
    localStorage.setItem("currentUser", data.username);
    localStorage.setItem("platformAccount", data.platform_account);

    alert("登录成功！");
    window.location.href = "frontend/HOME.html";

  } catch (err) {
    console.error(err);
    alert("操作异常，请重试");
  }
});

// =======================
// 获取当前 session
// =======================
async function getCurrentSession() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session;
}
