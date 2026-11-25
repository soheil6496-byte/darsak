const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const DAILY_LIMIT = 2000;
const MAX_OUTPUT = 384;

// The production site uses the apex domain. Keep www as an accepted canonical
// variant so browser preflight requests are not rejected after a redirect.
const ALLOWED_ORIGINS = new Set([
  "https://darsaak.ir",
  "https://www.darsaak.ir"
]);

function corsHeaders(origin) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin)
  });
}

async function supabaseRpc(env, token, name, args) {
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_ANON_KEY,
      "authorization": "Bearer " + token,
      "content-type": "application/json"
    },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.msg || "Supabase quota operation failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // Permit a plain browser navigation to the health endpoint (no Origin header).
    if (request.method === "GET" && !origin) {
      return new Response(JSON.stringify({ ok: true, service: "darsak-ai-tutor", model: "Gemma 4 A4B" }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Handle CORS preflight before parsing a body or checking authentication.
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden origin", { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-max-age": "86400",
          "vary": "Origin"
        }
      });
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }

    // Authenticated GET returns the persisted quota for the signed-in account.
    if (request.method === "GET") {
      const auth = request.headers.get("Authorization") || "";
      if (auth.startsWith("Bearer ") && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
        try {
          const rows = await supabaseRpc(
            env,
            auth.slice(7),
            "get_ai_quota",
            {}
          );
          const quota = Array.isArray(rows) ? rows[0] : rows;
          return json({
            ok: true,
            used: quota?.tokens_used ?? 0,
            reserved: quota?.tokens_reserved ?? 0,
            remaining: quota?.tokens_remaining ?? DAILY_LIMIT,
            limit: DAILY_LIMIT,
            usageDate: quota?.usage_date ?? null,
            model: "Gemma 4 A4B"
          }, 200, origin);
        } catch (error) {
          const status = error.status === 401 || error.status === 403 ? 401 : 503;
          return json({ error: status === 401 ? "نشست ورود معتبر نیست؛ دوباره وارد حساب شو." : "دریافت سهمیه از پایگاه داده انجام نشد." }, status, origin);
        }
      }
      return json({ ok: true, service: "darsak-ai-tutor", model: "Gemma 4 A4B" }, 200, origin);
    }

    if (request.method !== "POST") {
      return json({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405, origin);
    }
    if (!env.AI || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return json({ error: "سرویس هوشمند هنوز کامل پیکربندی نشده است." }, 503, origin);
    }

    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "برای استفاده وارد حساب درسک شو." }, 401, origin);
    }
    const token = auth.slice(7);

    let body;
    try {
      if (Number(request.headers.get("content-length") || 0) > 24000) {
        return json({ error: "پیام بیش از حد طولانی است." }, 413, origin);
      }
      body = await request.json();
    } catch {
      return json({ error: "درخواست نامعتبر است." }, 400, origin);
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length || messages.length > 12) {
      return json({ error: "گفت‌وگو نامعتبر است." }, 400, origin);
    }
    const clean = [];
    for (const m of messages) {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") continue;
      const content = m.content.trim();
      if (!content || content.length > 5000) {
        return json({ error: "هر پیام باید کمتر از ۵۰۰۰ نویسه باشد." }, 400, origin);
      }
      clean.push({ role: m.role, content });
    }
    if (!clean.length || clean[clean.length - 1].role !== "user") {
      return json({ error: "پیام کاربر پیدا نشد." }, 400, origin);
    }

    const inputEstimate = Math.ceil(clean.reduce((n, m) => n + m.content.length, 0) / 3.2) + 180;
    const reserveTokens = inputEstimate + MAX_OUTPUT;
    if (reserveTokens > DAILY_LIMIT) {
      return json({ error: "این گفت‌وگو برای سهمیهٔ روزانه بیش از حد طولانی است." }, 413, origin);
    }

    let reservationId;
    try {
      const result = await supabaseRpc(env, token, "reserve_ai_tokens", { p_tokens: reserveTokens });
      const reservation = Array.isArray(result) ? result[0] : result;
      if (!reservation?.allowed || !reservation?.reservation_id) {
        return json({
          error: "سهمیهٔ امروزت تمام شده است.",
          used: reservation?.tokens_used || 0,
          limit: DAILY_LIMIT,
          remaining: reservation?.tokens_remaining || 0
        }, 429, origin);
      }
      reservationId = reservation.reservation_id;
    } catch (error) {
      const status = error.status === 401 || error.status === 403 ? 401 : 503;
      return json({
        error: status === 401
          ? "نشست ورود معتبر نیست؛ دوباره وارد حساب شو."
          : "رزرو سهمیه در پایگاه داده انجام نشد."
      }, status, origin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "تو معلم هوشمند فارسی‌زبان درسک هستی. با لحنی روشن، صبور، دقیق و متناسب با دانش‌آموزان مدرسه آموزش بده. پاسخ را مرحله‌به‌مرحله و با مثال ساده توضیح بده. اگر صورت سؤال مبهم است، یک سؤال روشن‌کننده بپرس. پاسخ‌ها را به فارسی بنویس. اطلاعات ساختگی نساز. در موضوعات خطرناک یا نامناسب برای نوجوانان، ایمن و مسئولانه پاسخ بده."
          },
          ...clean
        ],
        max_tokens: MAX_OUTPUT,
        temperature: 0.35,
        chat_template_kwargs: { enable_thinking: false }
      });
      const answer = result?.choices?.[0]?.message?.content || result?.response || result?.result?.response || "";
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("empty model response");
      }

      // Character-based estimate, not the model's exact tokenizer count.
      const actualEstimate = Math.min(reserveTokens, inputEstimate + Math.ceil(answer.length / 3.2));
      const settled = await supabaseRpc(env, token, "settle_ai_tokens", {
        p_reservation_id: reservationId,
        p_actual_tokens: actualEstimate
      });
      const usage = Array.isArray(settled) ? settled[0] : settled;
      return json({
        answer: answer.trim(),
        used: usage?.tokens_used ?? actualEstimate,
        limit: DAILY_LIMIT,
        remaining: usage?.tokens_remaining ?? Math.max(0, DAILY_LIMIT - actualEstimate),
        model: "Gemma 4 A4B"
      }, 200, origin);
    } catch {
      try {
        await supabaseRpc(env, token, "cancel_ai_token_reservation", { p_reservation_id: reservationId });
      } catch {}
      return json({
        error: "مدل فعلاً پاسخ نداد. سهمیهٔ رزروشده آزاد شد؛ دوباره امتحان کن."
      }, 502, origin);
    }
  }
};
