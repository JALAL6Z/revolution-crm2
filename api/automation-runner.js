export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ ok: false, error: "CRON_SECRET missing" });

  const authorization = req.headers.authorization || "";
  if (authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    return res.status(500).json({ ok: false, error: "Supabase env missing" });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/sequence-runner`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "apikey": publishableKey,
      "x-cron-secret": cronSecret,
    },
    body: "{}",
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  return res.status(response.ok ? 200 : 502).json({
    ok: response.ok,
    status: response.status,
    payload,
  });
}
