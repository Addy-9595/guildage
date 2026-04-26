const { ensureReady } = require('../../lib/db');
const { verifyWithArbiter, syncTaskToArbiter } = require('../../lib/arbiter');

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

  // Demo/test mode — use mock response when no real API key is provided
  const isDemoKey = !api_key || ['demo', 'test', 'mock', 'demo-key'].includes(api_key.toLowerCase()) || api_key.startsWith('sk-test-');

  let resultText;

  if (isDemoKey) {
    const mockResponses = {
      Writer: `Here's a short story based on your prompt:\n\n"${task_prompt.slice(0, 60)}..." — the words hung in the air like smoke. She hadn't expected the answer to arrive so quietly, tucked between the lines of a letter she'd read a hundred times. But there it was. The truth, patient as stone.\n\n[Demo mode — add a real Anthropic or OpenAI API key to get live responses]`,
      Chef: `Great question! For "${task_prompt.slice(0, 50)}...", I'd recommend starting with fresh, high-quality ingredients. Season generously, trust your instincts, and don't be afraid to taste as you go. A splash of acid at the end — lemon juice or a dash of vinegar — will brighten the whole dish.\n\n[Demo mode — add a real API key to get live responses]`,
      Florist: `For this arrangement, I'd suggest pairing seasonal blooms with complementary textures. Consider soft eucalyptus as a base, then layer in peonies or ranunculus for volume. Finish with a trailing vine element to add movement. Keep stems at varying heights for a natural, garden-gathered look.\n\n[Demo mode — add a real API key to get live responses]`,
      Coder: `Here's a clean approach:\n\n\`\`\`javascript\n// Solution for: ${task_prompt.slice(0, 60)}\nfunction solve(input) {\n  // Parse and validate input\n  if (!input) throw new Error('Input required');\n  \n  // Core logic here\n  const result = input.trim().split('\\n').map(line => line.trim());\n  \n  return result;\n}\n\`\`\`\n\nThis handles edge cases and keeps things readable.\n\n[Demo mode — add a real API key to get live responses]`,
      Analyst: `Based on your query: "${task_prompt.slice(0, 60)}..."\n\nKey insights:\n• The primary driver here is likely market positioning, not cost structure\n• A 10–15% efficiency gain is achievable within 2 quarters with focused execution\n• Risk: dependency on a single channel creates fragility — diversification is recommended\n\nConclusion: Prioritize quick wins in Q1, then re-evaluate the roadmap with real data.\n\n[Demo mode — add a real API key to get live responses]`,
      Translator: `Translation (Demo):\n\nOriginal: "${task_prompt.slice(0, 80)}"\nTranslated: "Esta es una traducción de demostración. Por favor, agrega una clave API real para obtener traducciones precisas en el idioma solicitado."\n\n[Demo mode — add a real API key to get live responses]`,
      Researcher: `Research summary for: "${task_prompt.slice(0, 60)}..."\n\nFindings:\n1. The topic has seen significant development over the past 5 years\n2. Leading studies suggest a correlation between the variables in question\n3. Counterarguments exist — notably from the 2022 meta-analysis literature\n4. Current consensus leans toward a nuanced, context-dependent conclusion\n\nRecommendation: Further primary research is needed before drawing firm conclusions.\n\n[Demo mode — add a real API key to get live responses]`,
      Lawyer: `Legal memo (Demo) — re: "${task_prompt.slice(0, 60)}..."\n\nKey considerations:\n• Jurisdiction matters — this analysis assumes a general common-law framework\n• Primary risk: potential liability under contract or tort doctrine\n• Mitigation: clear written agreements, proper disclosures, and documented consent\n• Flag: if this involves regulated industries (finance, health, data), additional compliance layers apply\n\nThis is not legal advice. Consult a licensed attorney for your jurisdiction.\n\n[Demo mode — add a real API key to get live responses]`,
      Accountant: `Financial analysis for: "${task_prompt.slice(0, 60)}..."\n\nSummary:\n• Revenue recognition should follow accrual-basis accounting per GAAP/IFRS\n• Recommended: review your cost-of-goods-sold classification for accuracy\n• Tax implication: timing of deductions may create a material difference in this fiscal year\n• Action: reconcile accounts monthly and maintain audit-ready documentation\n\n[Demo mode — add a real API key to get live responses]`,
      Designer: `Design recommendation for: "${task_prompt.slice(0, 60)}..."\n\nApproach:\n• Lead with a clear visual hierarchy — one dominant element, two supporting\n• Colour palette: limit to 3 colours max; use the 60-30-10 rule\n• Typography: pair a bold display font with a neutral body font for contrast\n• Whitespace is not empty — it's breathing room. Use it generously.\n\nNext step: prototype in low fidelity before committing to high-res assets.\n\n[Demo mode — add a real API key to get live responses]`,
    };
    resultText = mockResponses[skill] || `[Demo response for ${skill}]\n\nTask received: "${task_prompt}"\n\nThis is a simulated response from agent ${agent_name}. To get real AI-powered responses, register the agent with a valid Anthropic (sk-ant-...) or OpenAI (sk-...) API key.\n\n[Demo mode — add a real API key to get live responses]`;
  } else {
    let response, data;

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

  if (agent_id) {
    syncTaskToArbiter(agent_id, 'exec-' + Date.now(), `${skill}: ${task_prompt.slice(0, 100)}`, verification?.token_reward || 0, verification);
  }

  return res.status(200).json({ result: resultText, agent_name, skill, verification });
}
