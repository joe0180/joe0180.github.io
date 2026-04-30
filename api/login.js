import { kv } from "@vercel/kv";

const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 5 * 60 * 1000; 

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        .trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const key = `login:${ip}`;

    let record = await kv.get(key);

    if (!record) {
      record = { count: 0, lockUntil: 0 };
    }

    const now = Date.now();

    if (record.lockUntil > now) {
      const remaining = Math.ceil((record.lockUntil - now) / 1000);

      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${remaining}s`
      });
    }


    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { username, password } = body || {};


    if (username === "admin" && password === "password") {
      await kv.set(key, { count: 0, lockUntil: 0 });

      res.setHeader(
        "Set-Cookie",
        "session=valid; HttpOnly; Secure; SameSite=Strict; Path=/"
      );

      return res.status(200).json({
        success: true,
        message: "Login successful"
      });
    }


    record.count += 1;

    if (record.count >= MAX_ATTEMPTS) {
      record.lockUntil = now + LOCK_TIME_MS;
    }

    await kv.set(key, record);

    return res.status(401).json({
      success: false,
      message:
        record.count >= MAX_ATTEMPTS
          ? "Too many attempts. You are locked out for 5 minutes."
          : `Attempts left: ${MAX_ATTEMPTS - record.count}`
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}
