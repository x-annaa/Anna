// =======================
// 注册逻辑 (Supabase Auth)
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

  // 注册到 Supabase Auth
  const { data, error } = await supabaseClient.auth.signUp({
    email: username + "@example.com", // ⚠️ 你也可以直接要求用户输入邮箱
    password: password
  });

  if (error) {
    alert("注册失败: " + error.message);
    return;
  }

  // 生成平台账号
  const platformAccount = generatePlatformAccount();

  // 在你自己的 users 表插入数据（关联 auth 用户）
  const { error: insertError } = await supabaseClient
    .from("users")
    .insert({
      auth_id: data.user.id, // 新增一列存 auth 用户的 id
      username: username,
      coins: 0,
      balance: 0,
      traffic: 0,
      platform_account: platformAccount
    });

  if (insertError) {
    alert("保存用户信息失败: " + insertError.message);
    return;
  }

  // 保存 Token
  if (data.session) {
    localStorage.setItem("currentUserToken", data.session.access_token);
  }

  alert("注册成功！");
  window.location.href = "frontend/HOME.html";
});

// =======================
// 登录逻辑 (Supabase Auth)
// =======================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    alert("请输入用户名和密码");
    return;
  }

  // 登录 Supabase Auth
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: username + "@example.com", // ⚠️ 如果用邮箱注册，这里就直接用邮箱
    password: password
  });

  if (error) {
    alert("登录失败: " + error.message);
    return;
  }

  // 保存 Token
  localStorage.setItem("currentUserToken", data.session.access_token);
  localStorage.setItem("currentUser", username);

  alert("登录成功！");
  window.location.href = "frontend/HOME.html";
});
