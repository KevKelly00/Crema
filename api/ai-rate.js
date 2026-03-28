const Anthropic       = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token  = authHeader.slice(7);
  const { logId } = req.body;
  if (!logId) return res.status(400).json({ error: 'logId required' });

  // Service role client — used to verify the JWT and update the row
  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Verify the JWT and get the user
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  // Fetch the log, enforce ownership
  const { data: log, error: fetchError } = await admin
    .from('coffee_logs')
    .select('id, photo_url, ai_rating, user_id')
    .eq('id', logId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !log) return res.status(404).json({ error: 'Log not found' });
  if (!log.photo_url)     return res.status(400).json({ error: 'No photo to rate' });
  if (log.ai_rating !== null) return res.status(409).json({ error: 'already_rated' });

  // Call Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let result;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: log.photo_url }
          },
          {
            type: 'text',
            text: `You are an expert barista judging latte art. Rate this latte art on a scale from 1.0 to 5.0 in 0.5 increments. Consider symmetry, definition, contrast between milk and espresso, and technical execution.

Respond with JSON only:
{
  "rating": <number from 1.0 to 5.0 in 0.5 increments>,
  "tips": "<2-3 specific, actionable tips to improve this pour, max 80 words>"
}

If this is not a photo of latte art or a milk-based coffee drink, respond with:
{ "error": "not_latte_art" }`
          }
        ]
      }]
    });

    const text  = response.content[0].text;
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

  // Persist — only the API can write these columns
  const { error: updateError } = await admin
    .from('coffee_logs')
    .update({ ai_rating: result.rating, ai_tips: result.tips })
    .eq('id', logId);

  if (updateError) {
    console.error('DB update error:', updateError);
    return res.status(500).json({ error: 'Failed to save rating' });
  }

  return res.json({ rating: result.rating, tips: result.tips });
};
