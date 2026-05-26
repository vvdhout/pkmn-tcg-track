import { NextRequest, NextResponse } from 'next/server';

const PROMPT = `You analyze content to extract Pokémon TCG card information. Return ONLY a JSON array — no markdown, no explanation.

The input may be:
- A photo of physical cards (read the name printed at the top, the number at the bottom like "051/198" or "051", and the set info)
- A text list of card names with optional quantities, set codes, or card numbers
- A screenshot of a card list or collection

For each card return an object with:
- "name": card name exactly as printed or written (string, required)
- "quantity": number of copies — parse from "4x", "×4", "4 copies" etc., default to 1 (integer)
- "setCode": set ID like "sv1", "swsh1", "base1", "xy1" — make your best guess if a set is mentioned but code is unclear, otherwise null (string or null)
- "number": card number like "051" — strip the "/198" total if present, otherwise null (string or null)

Return ONLY the JSON array, nothing else.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set. Add it to .env.local or Vercel environment variables.');
    return NextResponse.json({ error: 'Scanner not set up: ANTHROPIC_API_KEY is missing on the server.' }, { status: 503 });
  }

  try {
    const body = await req.json() as {
      imageBase64?: string;
      mediaType?: string;
      text?: string;
    };

    const contentParts: unknown[] = [];

    if (body.imageBase64) {
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: body.mediaType ?? 'image/jpeg',
          data: body.imageBase64,
        },
      });
    }

    contentParts.push({
      type: 'text',
      text: body.text ? `${PROMPT}\n\nCard list to parse:\n${body.text}` : PROMPT,
    });

    // Model preference: cheapest/fastest first, fall back to next tier on 404
    const MODELS = [
      'claude-haiku-4-5',
      'claude-sonnet-4-6',
    ];

    let res: Response | null = null;
    let lastErrText = '';

    for (const model of MODELS) {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [{ role: 'user', content: contentParts }],
        }),
      });

      if (res.ok) break;

      lastErrText = await res.text();
      console.error(`Claude API error with model ${model} — status ${res.status}:`, lastErrText);

      // Only retry on 404 (model not found/accessible); anything else is a hard error
      if (res.status !== 404) break;
    }

    if (!res!.ok) {
      const status = res!.status;

      if (status === 401) {
        return NextResponse.json(
          { error: 'Invalid Anthropic API key. Check ANTHROPIC_API_KEY in your environment.' },
          { status: 500 },
        );
      }
      if (status === 403) {
        return NextResponse.json(
          { error: 'API key lacks permission. You may need to add billing at console.anthropic.com.' },
          { status: 500 },
        );
      }
      if (status === 404) {
        return NextResponse.json(
          { error: 'Claude model not found. Please contact support.' },
          { status: 500 },
        );
      }
      if (status === 429) {
        return NextResponse.json(
          { error: 'Claude API rate limit hit. Please wait a moment and try again.' },
          { status: 500 },
        );
      }
      if (status === 529 || status === 503) {
        return NextResponse.json(
          { error: 'Claude API is temporarily overloaded. Please try again in a moment.' },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: `Failed to analyze content (Claude API ${status}): ${lastErrText.slice(0, 120)}` },
        { status: 500 },
      );
    }

    const data = await res!.json() as { content: { text: string }[] };
    const raw = data.content[0].text.trim();

    let cards;
    try {
      cards = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        cards = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: 'Could not parse Claude response.' }, { status: 500 });
      }
    }

    return NextResponse.json({ cards });
  } catch (err) {
    console.error('Scan route error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
