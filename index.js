// =======================
// 密码可见切换
// =======================
window.togglePassword = function (id, el) {
  const input = document.getElementById(id);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    el.textContent = "🙈"; // 显示密码时的图标
  } else {
    input.type = "password";
    el.textContent = "👁️"; // 隐藏密码时的图标
  }
};

// =======================
// 注册逻辑
// =======================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("regUsername").value.trim();
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirmPassword").value;
  const agree = document.getElementById("agreeTerms").checked;

  // 用户名长度限制
  if (!username || username.length < 3 || username.length > 15) {
    alert("用户名必须为3到15个字符");
    return;
  }

  if (!password) {
    alert("请输入密码");
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

  // 生成平台账号（随机字母+数字混合6位）
  const platformAccount = generatePlatformAccount();

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
    alert("注册失败: " + error.message);
    return;
  }

  // 保存到 localStorage
  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);

  alert("注册成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// 生成随机平台账号（6位字母+数字混合）
// =======================
function generatePlatformAccount() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let acc = "";
  for (let i = 0; i < 6; i++) {
    acc += chars[Math.floor(Math.random() * chars.length)];
  }
  return acc;
}

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
    .select("id, username, password, platform_account")
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
  localStorage.setItem("platformAccount", data.platform_account);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
