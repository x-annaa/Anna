// Telegram 一键复制
document.getElementById("copyTelegramBtn")?.addEventListener("click", () => {
  const text = document.getElementById("telegramAccount")?.textContent || "";
  if (!text) return;
  navigator.clipboard.writeText(text).then(() =>
    alert("已复制 Telegram 账号：" + text)
  );
});
