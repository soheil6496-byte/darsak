const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const DAILY_LIMIT = 2000;
const MAX_OUTPUT = 384;
const ORIGIN = "https://darsaak.ir";

function json(data, status = 200, origin = ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      "vary": "Origin"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ORIGIN) return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "86400", "vary": "Origin"
      }});
    }
    if (request.method !== "POST") return json({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405);
    if (!env.DB || !env.AI || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return json({ error: "سرویس هوشمند هنوز کامل پیکربندی نشده است." }, 503);
    }

    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "برای استفاده وارد حساب درسک شو." }, 401);
    const token = auth.slice(7);
    let user;
    try {
      const authResponse = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
        headers: { "apikey": env.SUPABASE_ANON_KEY, "authorization": "Bearer " + token }
      });
      if (!authResponse.ok) return json({ error: "نشست ورود معتبر نیست؛ دوباره وارد حساب شو." }, 401);
      user = await authResponse.json();
      if (!user || !user.id) return json({ error: "احراز هویت انجام نشد." }, 401);
    } catch {
      return json({ error: "بررسی حساب کاربری ناموفق بود." }, 503);
    }

    let body;
    try {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 24000) return json({ error: "پیام بیش از حد طولانی است." }, 413);
      body = await request.json();
    } catch { return json({ error: "درخواست نامعتبر است." }, 400); }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length || messages.length > 12) return json({ error: "گفت‌وگو نامعتبر است." }, 400);
    const clean = [];
    for (const m of messages) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") continue;
      const content = m.content.trim();
      if (!content || content.length > 5000) return json({ error: "هر پیام باید کمتر از ۵۰۰۰ نویسه باشد." }, 400);
      clean.push({ role: m.role, content });
    }
    if (!clean.length || clean[clean.length - 1].role !== "user") return json({ error: "پیام کاربر پیدا نشد." }, 400);

    const inputEstimate = Math.ceil(clean.reduce((n, m) => n + m.content.length, 0) / 3.2) + 180;
    const reserve = inputEstimate + MAX_OUTPUT;
    if (reserve > DAILY_LIMIT) return json({ error: "این گفت‌وگو برای سهمیهٔ روزانه بیش از حد طولانی است." }, 413);

    const day = new Date().toISOString().slice(0, 10);
    const reservation = await env.DB.prepare(
      "INSERT INTO daily_usage (user_id, usage_date, tokens_used) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id, usage_date) DO UPDATE SET tokens_used = tokens_used + excluded.tokens_used, updated_at = CURRENT_TIMESTAMP " +
      "WHERE daily_usage.tokens_used + excluded.tokens_used <= ? RETURNING tokens_used"
    ).bind(user.id, day, reserve, DAILY_LIMIT).first();

    if (!reservation) {
      const row = await env.DB.prepare("SELECT tokens_used FROM daily_usage WHERE user_id = ? AND usage_date = ?").bind(user.id, day).first();
      return json({ error: "سهمیهٔ امروزت تمام شده است.", used: row?.tokens_used || 0, limit: DAILY_LIMIT }, 429);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "تو معلم هوشمند فارسی‌زبان درسک هستی. با لحنی روشن، صبور، دقیق و متناسب با دانش‌آموزان مدرسه آموزش بده. پاسخ را مرحله‌به‌مرحله و با مثال ساده توضیح بده. اگر صورت سؤال مبهم است، یک سؤال روشن‌کننده بپرس. پاسخ‌ها را به فارسی بنویس. اطلاعات ساختگی نساز. در موضوعات خطرناک یا نامناسب برای نوجوانان، ایمن و مسئولانه پاسخ بده." },
          ...clean
        ],
        max_tokens: MAX_OUTPUT,
        temperature: 0.35
      });
      const answer = result?.response || result?.result?.response || "";
      if (typeof answer !== "string" || !answer.trim()) throw new Error("empty model response");
      const actual = inputEstimate + Math.ceil(answer.length / 3.2);
      const delta = actual - reserve;
      if (delta < 0) {
        await env.DB.prepare("UPDATE daily_usage SET tokens_used = MAX(0, tokens_used + ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND usage_date = ?").bind(delta, user.id, day).run();
      }
      const usage = await env.DB.prepare("SELECT tokens_used FROM daily_usage WHERE user_id = ? AND usage_date = ?").bind(user.id, day).first();
      return json({ answer: answer.trim(), used: usage?.tokens_used || actual, limit: DAILY_LIMIT, model: "Gemma 4 A4B" });
    } catch {
      await env.DB.prepare("UPDATE daily_usage SET tokens_used = MAX(0, tokens_used - ?), updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND usage_date = ?").bind(reserve, user.id, day).run();
      return json({ error: "مدل فعلاً پاسخ نداد. سهمیهٔ رزروشده آزاد شد؛ دوباره امتحان کن." }, 502);
    }
  }
};