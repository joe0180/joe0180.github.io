const { Redis } = require("@upstash/redis");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_ATTEMPTS = 3;
const LOCK_TIME = 300000;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }

    const ip =
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown";

    const key = `login:${ip}`;

    let record = await redis.get(key);

    if (!record) {
      record = { count: 0, lockUntil: 0 };
    }

    const now = Date.now();

    if (record.lockUntil > now) {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Try again later."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const { username, password } = body || {};


    if (username === "admin" && password === "password") {
      await redis.set(key, { count: 0, lockUntil: 0 });

      res.setHeader(
        "Set-Cookie",
        "session=valid; HttpOnly; Secure; SameSite=Strict; Path=/"
      );

      return res.status(200).json({
        success: true,
        message: "Login successful"
      });
    }


    record.count++;

    if (record.count >= MAX_ATTEMPTS) {
      record.lockUntil = now + LOCK_TIME;
    }

    await redis.set(key, record);

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
};
