const ARBITER_URL = (process.env.ARBITER_API_URL || "https://arbiter-gvm7m9x4o-nishantneus-projects.vercel.app").replace(/\/$/, "");

module.exports = async function handler(req, res) {
  try {
    const r = await fetch(`${ARBITER_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    res.status(200).json({ online: true, ...data });
  } catch {
    res.status(200).json({ online: false });
  }
};
