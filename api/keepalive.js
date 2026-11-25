// Daily keep-alive (Vercel cron, see vercel.json): one tiny public database call so the free
// Supabase project is never paused for inactivity between semesters.
export default async function handler(req, res) {
  try {
    const r = await fetch('https://vjefkhgompiilkricvtp.supabase.co/rest/v1/rpc/keepalive', {
      method: 'POST',
      headers: { apikey: 'sb_publishable_WS3PFKtrSDYSh4tGFdP0Aw_JPYwfuBH', 'Content-Type': 'application/json' },
      body: '{}'
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, at: await r.json().catch(() => null) });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
}
