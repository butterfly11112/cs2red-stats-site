// CS2RED Stats — server
//
// Serves the static frontend (public/) and one API endpoint:
//   GET /api/profile?q=<steam link, vanity name, or SteamID64>
//
// cs2red.ru blocks plain server-to-server requests (its own anti-bot
// protection — same thing we ran into building the browser extension
// version of this tool). The honest way around it, same as the extension,
// is to never fake anything: launch a real (headless) browser here, have
// it actually visit cs2red.ru / steamcommunity.com, and read the response
// from inside that real page — exactly what happens when a person visits
// the site themselves. No spoofed headers, no bypassing anything.

const path = require("path");
const express = require("express");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// --- Shared headless browser -------------------------------------------
//
// One browser process is launched lazily and reused across requests (each
// request gets its own isolated context/tab, closed when done) — cheaper
// than launching a fresh browser every time, while still fine on a small
// free-tier server.

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

async function runOnPage(url, pageFunction, arg) {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    return await page.evaluate(pageFunction, arg);
  } finally {
    await context.close();
  }
}

// --- Steam link parsing ---------------------------------------------------

function parseSteamInput(raw) {
  let value = String(raw || "").trim();
  value = value.replace(/^https?:\/\//i, "");

  const idMatch = value.match(/\b(7656\d{13})\b/);
  if (idMatch) return { type: "id", value: idMatch[1] };

  const vanityMatch = value.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (vanityMatch) return { type: "vanity", value: vanityMatch[1] };

  if (/^[a-zA-Z0-9_-]{2,32}$/.test(value)) return { type: "vanity", value };

  return null;
}

async function resolveVanityToId(vanity) {
  const url = `https://steamcommunity.com/id/${encodeURIComponent(vanity)}`;
  return runOnPage(url, () => {
    const html = document.documentElement.outerHTML;
    const m =
      html.match(/"steamid":"(\d{17})"/) || html.match(/g_steamID\s*=\s*"(\d{17})"/);
    return m ? m[1] : null;
  });
}

async function fetchCs2redProfile(steamid64) {
  const apiUrl = `https://cs2red.ru/api/profile?steamid=${encodeURIComponent(steamid64)}`;
  const text = await runOnPage(
    "https://cs2red.ru/",
    async (url) => {
      const r = await fetch(url, { credentials: "omit" });
      return r.text();
    },
    apiUrl
  );
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function lookupPlayer(raw) {
  const parsed = parseSteamInput(raw);
  if (!parsed) return { success: false, error: "bad_input" };

  const steamid64 = parsed.type === "id" ? parsed.value : await resolveVanityToId(parsed.value);
  if (!steamid64) return { success: false, error: "steam_not_found" };

  const profile = await fetchCs2redProfile(steamid64);
  if (!profile || profile.success === false) {
    return { success: false, error: "cs2red_not_found" };
  }
  return { success: true, steamid64, user: profile.user };
}

// --- Routes ---------------------------------------------------------------

app.get("/api/profile", async (req, res) => {
  const raw = req.query.q;
  if (!raw) return res.status(400).json({ success: false, error: "missing_query" });

  try {
    const result = await lookupPlayer(raw);
    res.status(result.success ? 200 : 404).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "server_error", message: String((err && err.message) || err) });
  }
});

app.get("/api/compare", async (req, res) => {
  const a = req.query.a;
  const b = req.query.b;
  if (!a || !b) return res.status(400).json({ success: false, error: "missing_query" });

  try {
    const [resA, resB] = await Promise.all([lookupPlayer(a), lookupPlayer(b)]);
    if (!resA.success || !resB.success) {
      return res.status(404).json({ success: false, error: "not_found", a: resA, b: resB });
    }
    res.json({ success: true, a: resA, b: resB });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "server_error", message: String((err && err.message) || err) });
  }
});

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`cs2red-stats-site listening on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close().catch(() => {});
  }
  process.exit(0);
});
