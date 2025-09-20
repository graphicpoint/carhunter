import { NextRequest, NextResponse } from 'next/server';

interface SearchRequest {
  make: string;
  model: string;
  year_from: number;
  year_to: number;
  max_price: number;
  equipment?: string;
  optimization?: string;
  sites: string[];
}

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SearchRequest = await request.json();
    
    // Validate required fields
    if (!body.make || !body.model || !body.year_from || !body.year_to || !body.max_price || !body.sites) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: make, model, year_from, year_to, max_price, sites' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'Perplexity API key not configured' },
        { status: 500 }
      );
    }

    // Construct Danish prompt for Perplexity
    const sitesText = body.sites.join(', ');
    const equipmentText = body.equipment ? ` med ${body.equipment}` : '';
    const optimizationText = body.optimization ? ` (optimeret for ${body.optimization})` : '';
    
    const prompt = `Som bilkøber-assistent skal du søge efter ${body.make} ${body.model} fra ${body.year_from} til ${body.year_to} med maksimal pris ${body.max_price} kr${equipmentText}${optimizationText} på følgende danske bilsites: ${sitesText}.

Søg kun på de specificerede sites og returner resultater i JSON format med følgende struktur:
[
  {
    "title": "bil titel",
    "url": "link til bil",
    "ask_price": pris_i_kr,
    "year": årstal,
    "mileage": kilometer,
    "location": "by/område"
  }
]

Hvis JSON ikke er muligt, giv da et kort tekstsvar med de bedste fund.`;

    // Call Perplexity API
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!perplexityResponse.ok) {
      return NextResponse.json(
        { ok: false, error: `Perplexity API error: ${perplexityResponse.status}` },
        { status: 500 }
      );
    }

    const perplexityData: PerplexityResponse = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { ok: false, error: 'No content received from Perplexity API' },
        { status: 500 }
      );
    }

    // Try to parse as JSON
    try {
      const parsedResults = JSON.parse(content);
      return NextResponse.json({
        ok: true,
        query: body,
        results: parsedResults
      });
    } catch (parseError) {
      // Fallback to raw text response
      return NextResponse.json({
        ok: true,
        query: body,
        results: {
          raw: content
        }
      });
    }

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
