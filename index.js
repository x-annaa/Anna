// 翻译字典
const translations = {
  en: {
    title: "Welcome",
    description: "Please register or login below:"
  },
  zh: {
    title: "欢迎",
    description: "请在下方注册或登录："
  },
  jp: {
    title: "ようこそ",
    description: "以下から登録またはログインしてください："
  }
};

// 切换语言
document.getElementById("language").addEventListener("change", function () {
  const lang = this.value;
  document.getElementById("title").textContent = translations[lang].title;
  document.getElementById("description").textContent = translations[lang].description;
});
