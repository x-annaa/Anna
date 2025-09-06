// 获取消息列表容器
const messageList = document.getElementById("messageList");

/**
 * 添加一条提交信息到 MESSAGE 页面
 * @param {number} amount - 用户提交的提现金额
 */
function addMessageCard(amount) {
  const now = new Date();
  const formattedTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;

  const card = document.createElement("div");
  card.className = "message-card";

  card.innerHTML = `
    <h4>提交信息</h4>
    <p>提交审核中。。。</p>
    <p>提交余额：${amount.toFixed(2)}</p>
    <p>提交时间：${formattedTime}</p>
    <p style="font-weight:bold; color:#f00;">您的提现正在进行中。。。。请稍等</p>
  `;

  // 插入到顶部（最新消息在最上面）
  messageList.prepend(card);
}
