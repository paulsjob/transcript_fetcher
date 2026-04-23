import { safeParseJsonObject } from '../../utils/json.js';

const DEFAULT_PROVIDER = process.env.ANALYSIS_PROVIDER || 'extractive';
const DEFAULT_MODEL = process.env.ANALYSIS_MODEL || 'gpt-4.1-mini';

function extractJsonFromResponse(text = '') {
  const trimmed = `${text || ''}`.trim();
  if (!trimmed) {
    return {};
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return safeParseJsonObject(fencedMatch[1], {});
  }

  return safeParseJsonObject(trimmed, {});
}

function buildPrompt({ title, transcriptText }) {
  return `You are an editorial analyst supporting a newsroom.
Return STRICT JSON only with keys:
{
  "synopsis": string (2-4 sentences, concrete, why it matters),
  "keyPoints": string[] (3-8 concise and specific bullets),
  "entities": {
    "people": string[],
    "organizations": string[],
    "places": string[],
    "programs": string[],
    "issues": string[]
  },
  "tags": string[] (6-16 newsroom-style topical tags),
  "sections": [{"label": string, "startTimestamp": string|null, "endTimestamp": string|null, "summary": string}],
  "notableQuotes": [{"kind": "best_overall|best_emotional|best_policy|best_clip_ready", "quote": string, "timestamp": string|null, "rationale": string}]
}
Avoid fluff and repetition. Do not include markdown.
Title: ${title}
Transcript:
${transcriptText}`;
}

async function runOpenAiAnalysis({ title, transcriptText }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You generate concise editorial transcript analysis as valid JSON only.'
        },
        {
          role: 'user',
          content: buildPrompt({ title, transcriptText })
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider error (${response.status}): ${text.slice(0, 240)}`);
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || '';
  return extractJsonFromResponse(raw);
}

export async function generateProviderAnalysis({ title, transcriptText }) {
  if (DEFAULT_PROVIDER === 'openai') {
    return runOpenAiAnalysis({ title, transcriptText });
  }

  return null;
}
