import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const app = express();
app.use(express.json());

// ✅ CORS
app.use(
  cors({
    origin: ["https://www.si135.com", "https://si135.com", "http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

// ✅ health check
app.get("/health", (req, res) => res.status(200).send("ok"));

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

if (!GOOGLE_CLIENT_ID) {
  console.error("Missing GOOGLE_CLIENT_ID env");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET env");
  process.exit(1);
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.post("/api/auth/google", async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: "Missing id_token" });

    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid Google token" });

    const email = payload.email || "";

    // 🔒 จำกัดอีเมลมหาลัย
    const allowedDomain = "student.mahidol.edu";
    if (!email.endsWith(`@${allowedDomain}`)) {
      return res.status(403).json({ error: `University email only (@${allowedDomain})` });
    }

    // (แนะนำ) เช็ค email_verified ด้วย
    if (!payload.email_verified) {
      return res.status(401).json({ error: "Email not verified" });
    }

    const token = jwt.sign({ email, sub: payload.sub }, JWT_SECRET, { expiresIn: "7d" });
await supabase
  .from("profiles")
  .upsert(
    { email },               // ใส่ fields ขั้นต่ำก่อน
    { onConflict: "email" }
  );
    return res.json({ token, email });
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid Google token" });
  }
});

// ✅ listen บน PORT ของ Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
