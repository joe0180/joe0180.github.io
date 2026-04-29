export default function handler(req, res) {
  const { username, password } = req.body;

  const users = [
    { username: "admin", password: "password" }
  ];

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (user) {
    return res.status(200).json({
      success: true,
      message: "Login successful"
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials"
  });
}
