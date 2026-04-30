import { kv } from "@vercel/kv";

const MAX_ATTEMPTS = 3;
const LOCK_TIME = 300; 

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const ip =
      req.headers["x-forwarded-for"] ||
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
        message: `Locked. Try again in ${remaining}s`
      });
    }

    const body = req.body;
    const { username, password } = body;


    if (username === "admin" && password === "password") {
      await kv.set(key, { count: 0, lockUntil: 0 });

      res.setHeader(
        "Set-Cookie",
        "session=valid; HttpOnly; Secure; SameSite=Strict; Path=/"
      );

      return res.json({
        success: true,
        message: "Login successful"
      });
    }


    record.count++;

    if (record.count >= MAX_ATTEMPTS) {
      record.lockUntil = now + LOCK_TIME * 1000;
    }

    await kv.set(key, record);

    return res.status(401).json({
      success: false,
      message:
        record.count >= MAX_ATTEMPTS
          ? "Locked out"
          : `Attempts left: ${MAX_ATTEMPTS - record.count}`
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}
