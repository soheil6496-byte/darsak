const AI_WORKER_URL = "https://darsak-ai.darsak-ai.workers.dev";
const form = document.getElementById("ai-form");
const input = document.getElementById("ai-input");
const messagesEl = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-ai");
const statusEl = document.getElementById("ai-status");
const quotaEl = document.getElementById("quota-label");
const history = [];
let busy = false;

function addMessage(role, content, extraClass = "") {
  const node = document.createElement("div");
  node.className = "message " + role + (extraClass ? " " + extraClass : "");
  node.textContent = content;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}
function setQuota(used, limit) {
  const remaining = Math.max(0, limit - used);
  quotaEl.textContent = "مصرف امروز: " + used.toLocaleString("fa-IR") + " از " + limit.toLocaleString("fa-IR") + " توکن • باقی‌مانده: " + remaining.toLocaleString("fa-IR");
}
async function currentSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) return null;
  return data.session;
}
async function init() {
  try {
    const session = await currentSession();
    if (!session) {
      statusEl.textContent = "برای استفاده ابتدا وارد حساب شو";
      addMessage("assistant", "برای استفاده از معلم هوشمند، ابتدا وارد حساب کاربری درسک شو.");
      return;
    }
    statusEl.textContent = "متصل به حساب درسک • آمادهٔ پاسخ‌گویی";
    const login = document.getElementById("ai-login");
    if (login) login.textContent = "حساب من";
  } catch {
    statusEl.textContent = "بررسی ورود ناموفق بود";
  }
}
async function sendMessage(text) {
  if (busy || !text.trim()) return;
  const session = await currentSession();
  if (!session) { statusEl.textContent = "ابتدا وارد حساب درسک شو"; return; }
  busy = true; sendButton.disabled = true; input.disabled = true;
  addMessage("user", text);
  history.push({ role: "user", content: text });
  const pending = addMessage("assistant", "در حال فکر کردن…");
  try {
    const response = await fetch(AI_WORKER_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ messages: history.slice(-12) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "ارتباط با معلم هوشمند برقرار نشد.");
    pending.textContent = data.answer;
    history.push({ role: "assistant", content: data.answer });
    setQuota(data.used, data.limit);
    statusEl.textContent = "متصل • Gemma 4 A4B";
  } catch (error) {
    pending.textContent = error.message || "خطای ناشناخته";
    pending.classList.add("error");
    history.pop();
  } finally {
    busy = false; sendButton.disabled = false; input.disabled = false; input.focus();
  }
}
form.addEventListener("submit", e => { e.preventDefault(); const text = input.value.trim(); if (!text) return; input.value = ""; sendMessage(text); });
document.querySelectorAll(".suggestions button").forEach(b => b.addEventListener("click", () => sendMessage(b.textContent)));
document.getElementById("clear-chat").addEventListener("click", () => {
  history.length = 0;
  messagesEl.innerHTML = '<div class="welcome-message"><div class="welcome-icon">✦</div><h2>گفت‌وگوی تازه شروع شد</h2><p>سؤالت رو بنویس تا با هم بررسی کنیم.</p></div>';
});
init();