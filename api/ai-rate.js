export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token  = authHeader.slice(7);
  const { logId } = req.body;
  if (!logId) return res.status(400).json({ error: 'logId required' });

  const SUPABASE_URL      = process.env.SUPABASE_URL;
  const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const sbHeaders = {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
    'Content-Type': 'application/json'
  };

  // Verify the JWT — Supabase auth endpoint returns the user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': SERVICE_KEY }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Unauthorized' });
  const user = await userRes.json();

  // Fetch the log, enforce ownership via query params
  const logRes = await fetch(
    `${SUPABASE_URL}/rest/v1/coffee_logs?id=eq.${logId}&user_id=eq.${user.id}&select=id,photo_url,ai_rating&limit=1`,
    { headers: sbHeaders }
  );
  const logs = await logRes.json();
  const log  = logs?.[0];

  if (!log)            return res.status(404).json({ error: 'Log not found' });
  if (!log.photo_url)  return res.status(400).json({ error: 'No photo to rate' });
  if (log.ai_rating !== null && log.ai_rating !== undefined)
                       return res.status(409).json({ error: 'already_rated' });

  // Rate limit: 5 AI ratings per user per calendar day (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/coffee_logs?user_id=eq.${user.id}&ai_rated_at=gte.${todayStart.toISOString()}&select=id`,
    { headers: sbHeaders }
  );
  const todayRatings = await countRes.json();
  if (Array.isArray(todayRatings) && todayRatings.length >= 5) {
    return res.status(429).json({ error: 'daily_limit_reached' });
  }

  // Call Claude
  let result;
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: log.photo_url } },
            {
              type: 'text',
              text: `You are a strict, experienced World Latte Art Championship judge. Rate this latte art photo on a scale from 1.0 to 5.0 in 0.1 increments. Be precise and harsh — use the full range.

Scoring guide:
- 1.0–1.9: No recognisable pattern, poor milk texture, blotchy or messy
- 2.0–2.9: Basic attempt at a pattern, some definition but inconsistent, rough edges
- 3.0–3.4: Recognisable pattern with reasonable symmetry, decent contrast, minor flaws
- 3.5–3.9: Good pattern with clear definition, solid symmetry, minor technical issues only
- 4.0–4.4: Strong pattern, sharp contrast, good symmetry — competition-worthy home pour
- 4.5–4.9: Near-flawless execution, crisp edges, excellent contrast and symmetry — exceptional
- 5.0: Reserved for genuinely world-class work only. Almost never award this.

Most home baristas should score between 2.0 and 3.5. Be specific about flaws. Do not be encouraging in your score — save that for the tips.

Respond with JSON only:
{
  "rating": <number from 1.0 to 5.0 in 0.1 increments>,
  "tips": "<2-3 specific, actionable tips to improve this pour, max 80 words>"
}

If this is not a photo of latte art or a milk-based coffee drink, respond with:
{ "error": "not_latte_art" }`
            }
          ]
        }]
      })
    });

    const data  = await claudeRes.json();
    const text  = data.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    result = JSON.parse(match[0]);
  } catch (err) {
    console.error('Claude error:', err);
    return res.status(500).json({ error: 'AI rating failed. Please try again.' });
  }

  if (result.error === 'not_latte_art') {
    return res.status(422).json({ error: 'not_latte_art' });
  }

  // Persist
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/coffee_logs?id=eq.${logId}`,
    {
      method: 'PATCH',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ ai_rating: result.rating, ai_tips: result.tips, ai_rated_at: new Date().toISOString() })
    }
  );

  if (!updateRes.ok) {
    console.error('DB update failed:', await updateRes.text());
    return res.status(500).json({ error: 'Failed to save rating' });
  }

  return res.json({ rating: result.rating, tips: result.tips });
}
