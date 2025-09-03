// ============= 小工具 =============
const $ = (sel) => document.querySelector(sel);

function showMsg(id, text, isError = true) {
  const el = $(id);
  if (!el) return;
  el.style.color = isError ? "#d00" : "#0a7b22";
  el.textContent = text || "";
}

function togglePasswordByTarget(targetId, btnEl) {
  const input = document.getElementById(targetId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btnEl.textContent = "🙈";
  } else {
    input.type = "password";
    btnEl.textContent = "👁️";
  }
}

function ensureSupabase() {
  if (!window.supabaseClient) {
    console.error("❌ supabaseClient 未初始化。请确认 supabaseClient.js 是否正确加载且在 index.js 之前引入。");
    alert("系统初始化失败，请刷新页面重试。");
    return false;
  }
  return true;
}

// ============= 事件绑定 & 逻辑 =============
document.addEventListener("DOMContentLoaded", () => {
  if (!ensureSupabase()) return;

  // Tab 切换
  $("#showLogin").addEventListener("click", () => {
    $("#showLogin").classList.add("active");
    $("#showRegister").classList.remove("active");
    $("#loginForm").classList.remove("hidden");
    $("#registerForm").classList.add("hidden");
    showMsg("#loginMsg", "");
    showMsg("#registerMsg", "");
  });

  $("#showRegister").addEventListener("click", () => {
    $("#showRegister").classList.add("active");
    $("#showLogin").classList.remove("active");
    $("#registerForm").classList.remove("hidden");
    $("#loginForm").classList.add("hidden");
    showMsg("#loginMsg", "");
    showMsg("#registerMsg", "");
  });

  // 密码可见（委托）
  document.body.addEventListener("click", (e) => {
    if (e.target.classList.contains("toggle-password")) {
      const target = e.target.getAttribute("data-target");
      if (target) togglePasswordByTarget(target, e.target);
    }
  });

  // Enter 提交（登录）
  $("#loginPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#loginBtn").click();
  });
  // Enter 提交（注册确认密码）
  $("#regConfirmPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#registerBtn").click();
  });

  // 登录
  $("#loginBtn").addEventListener("click", async () => {
    const btn = $("#loginBtn");
    const username = $("#loginUsername").value.trim();
    const password = $("#loginPassword").value.trim();

    showMsg("#loginMsg", "");
    if (!username || !password) {
      showMsg("#loginMsg", "请输入用户名和密码");
      return;
    }

    btn.disabled = true;
    try {
      const { data, error } = await supabaseClient
        .from("users")
        .select("id, username, password")
        .eq("username", username)
        .eq("password", password)   // ⚠️ 明文密码仅用于演示
        .single();

      if (error || !data) {
        showMsg("#loginMsg", "用户名或密码错误");
        return;
      }

      // 保存本地状态并跳转
      localStorage.setItem("currentUserId", data.id);
      localStorage.setItem("currentUser", data.username);
      showMsg("#loginMsg", "登录成功，正在进入…", false);

      // 延迟 300ms 让用户看到提示
      setTimeout(() => (window.location.href = "home.html"), 300);
    } catch (err) {
      showMsg("#loginMsg", "登录失败，请稍后重试");
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });

  // 注册
  $("#registerBtn").addEventListener("click", async () => {
    const btn = $("#registerBtn");
    const username = $("#regUsername").value.trim();
    const password = $("#regPassword").value.trim();
    const confirm = $("#regConfirmPassword").value.trim();
    const agree = $("#agreeTerms").checked;

    showMsg("#registerMsg", "");
    if (!username || !password || !confirm) {
      showMsg("#registerMsg", "请完整填写信息");
      return;
    }
    if (password !== confirm) {
      showMsg("#registerMsg", "两次密码不一致");
      return;
    }
    if (!agree) {
      showMsg("#registerMsg", "请先勾选同意条款");
      return;
    }

    btn.disabled = true;
    try {
      // 用户名查重
      const { data: existing } = await supabaseClient
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existing) {
        showMsg("#registerMsg", "用户名已存在");
        return;
      }

      // 插入
      const { data, error } = await supabaseClient
        .from("users")
        .insert({
          username,
          password,           // ⚠️ 明文密码仅用于演示
          coins: 0,
          balance: 0,
          platform_account: username,
          created_at: new Date().toISOString()
        })
        .select("id, username")
        .single();

      if (error) {
        showMsg("#registerMsg", "注册失败：" + error.message);
        return;
      }

      // 保存并跳转
      localStorage.setItem("currentUserId", data.id);
      localStorage.setItem("currentUser", data.username);
      showMsg("#registerMsg", "注册成功，正在进入…", false);

      setTimeout(() => (window.location.href = "home.html"), 300);
    } catch (err) {
      showMsg("#registerMsg", "注册异常，请稍后再试");
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });
});
