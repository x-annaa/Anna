<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>注册 / 登录</title>
<script src="https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.33.1/dist/supabase.min.js"></script>
<style>
body { font-family: sans-serif; padding: 2rem; background: #f0f2f5; }
.container { max-width: 400px; margin: auto; background: #fff; padding: 2rem; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);}
h2 { text-align: center; }
form { display: flex; flex-direction: column; }
input { margin-bottom: 1rem; padding: 0.5rem; font-size: 1rem; }
button { padding: 0.5rem; font-size: 1rem; cursor: pointer; }
p.switch { text-align: center; cursor: pointer; color: blue; }
#error { color: red; }
</style>
</head>
<body>

<div class="container">
  <h2 id="formTitle">登录</h2>
  <div id="error"></div>

  <form id="authForm">
    <input type="text" id="username" placeholder="用户名" required>
    <input type="password" id="password" placeholder="密码" required>
    <button type="submit" id="submitBtn">登录</button>
  </form>

  <p class="switch" id="toggleForm">没有账号？去注册</p>
</div>

<script>
// 初始化 Supabase
window.supabaseClient = window.supabase.createClient(
  "https://ofaxbeydyeajdgwwqrzz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mYXhiZXlkeWVhamRnd3dxcnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NzQxMTQsImV4cCI6MjA3NDA1MDExNH0.mJGdh6BBEy2Mp83H7aBEo3wIFyIsUsVfqgTErgsvFdY"
);

let isRegister = false;

const formTitle = document.getElementById("formTitle");
const toggleForm = document.getElementById("toggleForm");
const authForm = document.getElementById("authForm");
const submitBtn = document.getElementById("submitBtn");
const errorDiv = document.getElementById("error");

toggleForm.addEventListener("click", () => {
  isRegister = !isRegister;
  formTitle.textContent = isRegister ? "注册" : "登录";
  submitBtn.textContent = isRegister ? "注册" : "登录";
  toggleForm.textContent = isRegister ? "已有账号？去登录" : "没有账号？去注册";
  errorDiv.textContent = "";
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorDiv.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    errorDiv.textContent = "用户名和密码不能为空";
    return;
  }

  try {
    if (isRegister) {
      // 注册：先检查用户名是否存在
      const { data: existing, error: checkErr } = await supabaseClient
        .from("users")
        .select("id")
        .eq("username", username)
        .limit(1)
        .single();

      if (existing) {
        errorDiv.textContent = "用户名已存在";
        return;
      }

      // 密码哈希
      const hash = bcrypt.hashSync(password, 10);

      const { data: newUser, error: insertErr } = await supabaseClient
        .from("users")
        .insert({ username, password_hash: hash })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 保存到 localStorage
      localStorage.setItem("currentUserId", newUser.id);
      localStorage.setItem("currentUser", newUser.username);
      localStorage.setItem("currentUserUUID", newUser.uuid);

      // 跳转
      window.location.href = "frontend/HOME.html";

    } else {
      // 登录
      const { data: user, error: loginErr } = await supabaseClient
        .from("users")
        .select("*")
        .eq("username", username)
        .limit(1)
        .single();

      if (!user) {
        errorDiv.textContent = "用户不存在";
        return;
      }

      // 验证密码
      if (!bcrypt.compareSync(password, user.password_hash)) {
        errorDiv.textContent = "密码错误";
        return;
      }

      // 保存到 localStorage
      localStorage.setItem("currentUserId", user.id);
      localStorage.setItem("currentUser", user.username);
      localStorage.setItem("currentUserUUID", user.uuid);

      // 跳转
      window.location.href = "frontend/HOME.html";
    }
  } catch (err) {
    console.error(err);
    errorDiv.textContent = err.message || "操作失败";
  }
});
</script>

</body>
</html>
