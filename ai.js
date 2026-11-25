const AI_WORKER_URL = "https://darsak-ai-tutor.darsak-ai.workers.dev";
const form = document.getElementById("ai-form");
const input = document.getElementById("ai-input");
const messagesEl = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-ai");
const statusEl = document.getElementById("ai-status");
const quotaEl = document.getElementById("quota-label");
const history = [];
let busy = false;
let workerReachable = false;

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

async function checkWorker() {
  try {
    const response = await fetch(AI_WORKER_URL, { method: "GET", cache: "no-store" });
    const data = await response.json();
    workerReachable = response.ok && data.ok === true;
    return workerReachable;
  } catch {
    workerReachable = false;
    return false;
  }
}

async function loadQuota() {
  try {
    const { data, error } = await supabaseClient.rpc("get_ai_quota");
    if (error) throw error;
    const quota = Array.isArray(data) ? data[0] : data;
    if (quota && Number.isFinite(Number(quota.tokens_used))) {
      setQuota(Number(quota.tokens_used), 2000);
    }
  } catch (error) {
    console.error("خطا در دریافت سهمیه ذخیره‌شده:", error);
    quotaEl.textContent = "سهمیهٔ روزانه: دریافت اطلاعات ناموفق بود";
  }
}

async function init() {
  try {
    const [session, online] = await Promise.all([currentSession(), checkWorker()]);
    if (!online) {
      statusEl.textContent = "ارتباط با سرور هوش مصنوعی برقرار نشد";
      addMessage("assistant", "سرور معلم هوشمند از این مرورگر در دسترس نیست. ممکن است اتصال به دامنهٔ سرویس یا تنظیمات شبکه/CORS مشکل داشته باشد.");
    } else if (!session) {
      statusEl.textContent = "سرور آماده است • برای استفاده وارد حساب شو";
      addMessage("assistant", "برای استفاده از معلم هوشمند، ابتدا وارد حساب کاربری درسک شو.");
      return;
    } else {
      statusEl.textContent = "متصل به حساب درسک • آمادهٔ پاسخ‌گویی";
    }

    if (session) {
      const login = document.getElementById("ai-login");
      if (login) login.textContent = "حساب من";
      await loadQuota();
    }
  } catch {
    statusEl.textContent = "بررسی اتصال ناموفق بود";
  }
}

async function sendMessage(text) {
  if (busy || !text.trim()) return;
  const session = await currentSession();
  if (!session) {
    statusEl.textContent = "ابتدا وارد حساب درسک شو";
    return;
  }

  busy = true;
  sendButton.disabled = true;
  input.disabled = true;
  addMessage("user", text);
  history.push({ role: "user", content: text });
  const pending = addMessage("assistant", "در حال فکر کردن…");

  try {
    const response = await fetch(AI_WORKER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + session.access_token
      },
      body: JSON.stringify({ messages: history.slice(-12) })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || ("خطای سرور: " + response.status));
    }
    if (typeof data.answer !== "string" || !data.answer.trim()) {
      throw new Error("پاسخ معلم هوشمند خالی بود؛ دوباره امتحان کن.");
    }

    pending.textContent = data.answer;
    history.push({ role: "assistant", content: data.answer });
    if (Number.isFinite(data.used) && Number.isFinite(data.limit)) {
      setQuota(data.used, data.limit);
    }
    statusEl.textContent = "متصل • Gemma 4 A4B";
    workerReachable = true;
  } catch (error) {
    const message = error instanceof TypeError
      ? "ارتباط مرورگر با سرور برقرار نشد. آدرس سرویس، اینترنت یا تنظیمات CORS را بررسی می‌کنیم."
      : (error.message || "خطای ناشناخته");
    pending.textContent = message;
    pending.classList.add("error");
    history.pop();
    statusEl.textContent = "خطا در ارتباط با معلم هوشمند";
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendMessage(text);
});

document.querySelectorAll(".suggestions button").forEach(button => {
  button.addEventListener("click", () => sendMessage(button.textContent));
});

document.getElementById("clear-chat").addEventListener("click", () => {
  history.length = 0;
  messagesEl.innerHTML = '<div class="welcome-message"><div class="welcome-icon">✦</div><h2>گفت‌وگوی تازه شروع شد</h2><p>سؤالت رو بنویس تا با هم بررسی کنیم.</p></div>';
});

init();
