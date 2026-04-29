import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_ATTEMPTS = 3;
const LOCK_TIME = 300; 

export default async function handler(req, res) {

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
    const remaining = Math.ceil((record.lockUntil - now) / 1000);

    return res.status(429).json({
      success: false,
      message: `Too many attempts. Try again in ${remaining}s`
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
      "session=valid-user; HttpOnly; Secure; SameSite=Strict; Path=/"
    );

    return res.status(200).json({
      success: true,
      message: "Login successful"
    });
  }

=
  record.count++;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockUntil = now + LOCK_TIME * 1000;
  }

  await redis.set(key, record, { ex: LOCK_TIME });

  return res.status(401).json({
    success: false,
    message:
      record.count >= MAX_ATTEMPTS
        ? "Too many attempts. You are locked out."
        : `Invalid credentials. Attempts left: ${MAX_ATTEMPTS - record.count}`
  });
}
