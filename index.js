// =======================
// 绑定所有“👁️”按钮点击事件
// =======================
document.querySelectorAll(".toggle-password").forEach(btn => {
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

function generatePlatformAccount() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const allChars = letters + digits;

  let result = "";

  // 第一个字符必须是字母
  const firstIndex = Math.floor(Math.random() * letters.length);
  result += letters[firstIndex];

  // 剩下5位，先确保至少有一个数字
  const remaining = [];

  // 随机选择一个位置放数字（1~5位置）
  const digitPosition = Math.floor(Math.random() * 5);

  for (let i = 0; i < 5; i++) {
    if (i === digitPosition) {
      // 放一个数字
      const digitIndex = Math.floor(Math.random() * digits.length);
      remaining.push(digits[digitIndex]);
    } else {
      // 放字母或数字
      const charIndex = Math.floor(Math.random() * allChars.length);
      remaining.push(allChars[charIndex]);
    }
  }

  result += remaining.join("");
  return result;
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
// 注册逻辑 (密码至少 6 位数字)
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

  // ✅ 密码至少 6 位，可包含字母和数字
  if (!/^[A-Za-z0-9]{6,}$/.test(password)) {
    alert("密码至少 6 位，可包含字母和数字");
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

  // 检查用户名是否已存在
  const { data: exist } = await supabaseClient
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (exist) {
    alert("该用户名已存在，请换一个");
    return;
  }

  const platformAccount = generatePlatformAccount(); // 混合字母+数字
  const uuid = generateUUID();
  const sessionToken = generateUUID();

  // 插入新用户
  const { data, error } = await supabaseClient
    .from("users")
    .insert({
      username,
      password, // ⚠️ 建议 hash
      coins: 0,
      balance: 0,
      platform_account: platformAccount,
      uuid,
      session_token: sessionToken
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
  localStorage.setItem("platformAccount", platformAccount);
  localStorage.setItem("currentUserUUID", data.uuid);
  localStorage.setItem("sessionToken", sessionToken);

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

  const sessionToken = generateUUID();

  // 更新 session_token
  const { error: updateErr } = await supabaseClient
    .from("users")
    .update({ session_token: sessionToken })
    .eq("id", data.id);

  if (updateErr) {
    alert("更新 session 失败: " + updateErr.message);
    return;
  }

  localStorage.setItem("currentUserId", data.id);
  localStorage.setItem("currentUser", data.username);
  localStorage.setItem("platformAccount", data.platform_account);
  localStorage.setItem("currentUserUUID", data.uuid);
  localStorage.setItem("sessionToken", sessionToken);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
