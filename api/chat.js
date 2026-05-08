export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model, temperature, stream } = req.body;
    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured in Vercel' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing or invalid messages' });
    }

    const requestBody = {
      model: model || 'grok-4.3',
      messages: messages,
      temperature: temperature || 0.7
    };

    if (stream) {
      requestBody.stream = true;
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({
        error: error.error?.message || 'Failed to call Grok API'
      });
    }

    if (stream) {
      // For streaming, pass through the response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        res.write(chunk);
      }

      res.end();
    } else {
      // For non-streaming, send the response
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
