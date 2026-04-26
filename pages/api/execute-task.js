const { ensureReady } = require('../../lib/db');
const { verifyWithArbiter } = require('../../lib/arbiter');

const serviceTypeMap = {
  Coder: 'code_review',
  Translator: 'translator',
  Analyst: 'data_analysis',
  Accountant: 'data_analysis',
  Writer: 'general',
  Chef: 'general',
  Florist: 'general',
  Designer: 'general',
  Researcher: 'general',
  Lawyer: 'general',
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { skill, task_prompt, agent_name, api_key, model_endpoint, agent_id } = req.body;
  if (!skill || !task_prompt) return res.status(400).json({ error: 'skill and task_prompt required' });
  if (!api_key) return res.status(400).json({ error: 'No API key provided for this agent' });

  const skillPrompts = {
    Writer: 'You are an expert writer and storyteller. Write with creativity, clarity and craft.',
    Chef: 'You are a professional chef with deep culinary knowledge. Give practical, delicious advice.',
    Florist: 'You are an expert florist with an eye for beauty and seasonal arrangements.',
    Coder: 'You are a senior software engineer. Write clean, efficient, well-commented code.',
    Designer: 'You are a creative UI/UX designer. Think visually and user-first.',
    Analyst: 'You are a sharp business analyst. Be data-driven, concise and insightful.',
    Translator: 'You are a professional translator fluent in many languages. Be precise and natural.',
    Researcher: 'You are a thorough researcher. Synthesize information clearly and accurately.',
    Lawyer: 'You are an experienced legal advisor. Be precise, thorough and flag key risks.',
    Accountant: 'You are a certified accountant. Be accurate, clear and financially rigorous.'
  };

  const systemPrompt = skillPrompts[skill] || `You are a skilled ${skill} agent.`;
  const endpoint = model_endpoint || 'https://api.anthropic.com/v1/messages';
  const isAnthropic = endpoint.includes('anthropic.com');

  let response, data, resultText;

  if (isAnthropic) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `${systemPrompt} You are operating as ${agent_name} inside Guildage, a licensed agent bank.`,
        messages: [{ role: 'user', content: task_prompt }]
      })
    });
    data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });
    resultText = data.content[0].text;
  } else {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: `${systemPrompt} You are operating as ${agent_name} inside Guildage.` },
          { role: 'user', content: task_prompt }
        ]
      })
    });
    data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' });
    resultText = data.choices[0].message.content;
  }

  // Verify with Arbiter and award tokens
  let verification = null;
  if (agent_id) {
    const serviceType = serviceTypeMap[skill] || 'general';
    verification = await verifyWithArbiter(
      agent_id,
      agent_name,
      serviceType,
      { prompt: task_prompt, skill },
      { response: resultText }
    );

    if (verification) {
      const db = await ensureReady();
      if (verification.passed && verification.token_reward > 0) {
        await db.query(
          'UPDATE agents SET token_balance = token_balance + $1, task_count = task_count + 1 WHERE id = $2',
          [verification.token_reward, agent_id]
        );
      } else if (!verification.passed && verification.token_penalty > 0) {
        await db.query(
          'UPDATE agents SET token_balance = GREATEST(0, token_balance - $1), task_count = task_count + 1 WHERE id = $2',
          [verification.token_penalty, agent_id]
        );
      }
    }
  }

  return res.status(200).json({ result: resultText, agent_name, skill, verification });
}
