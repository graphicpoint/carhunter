import { NextRequest, NextResponse } from 'next/server';
import { SearchRequest } from '../../../types/search';

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

function buildSearchPrompt(body: SearchRequest): string {
  const sitesText = body.sites.join(', ');

  // Build vehicle description
  const makesText = body.makes.length > 0 ? body.makes.join(' eller ') : 'alle mærker';
  const modelsText = body.models.length > 0 ? ` (modeller: ${body.models.join(', ')})` : '';
  const vehicleText = `${makesText}${modelsText}`;

  // Build year range
  const yearText = body.year_from && body.year_to
    ? `fra ${body.year_from} til ${body.year_to}`
    : body.year_from
      ? `fra ${body.year_from}`
      : body.year_to
        ? `til ${body.year_to}`
        : 'alle årgange';

  // Build price criteria
  let priceText = '';
  if (body.mode === 'buy' && body.max_price) {
    priceText = `med maksimal pris ${body.max_price.toLocaleString('da-DK')} kr`;
  } else if (body.mode === 'leasing') {
    const monthlyText = body.monthly_max ? `max ${body.monthly_max.toLocaleString('da-DK')} kr/md` : '';
    const downText = body.downpayment_max ? `max udbetaling ${body.downpayment_max.toLocaleString('da-DK')} kr` : '';
    const parts = [monthlyText, downText].filter(Boolean);
    priceText = parts.length > 0 ? `med ${parts.join(' og ')}` : '';
  }

  // Build fuel types
  const fuelText = body.fuel_types.length > 0
    ? ` (brændstof: ${body.fuel_types.join(', ')})`
    : '';

  // Build equipment
  const equipmentText = body.equipment.length > 0
    ? ` med udstyr: ${body.equipment.join(', ')}`
    : '';

  // Build optimization
  const optimizationText = body.optimization
    ? ` (optimeret for ${body.optimization.replace('_', ' ')})`
    : '';

  const modeText = body.mode === 'leasing' ? 'leasing af' : 'køb af';

  return `Som bilkøber-assistent skal du søge efter ${modeText} ${vehicleText} ${yearText} ${priceText}${fuelText}${equipmentText}${optimizationText} på følgende danske bilsites: ${sitesText}.

Søg kun på de specificerede sites og returner resultater i JSON format med følgende struktur:
[
  {
    "title": "bil titel",
    "url": "link til bil",
    "ask_price": pris_i_kr,
    "monthly_price": månedlig_pris_i_kr,
    "year": årstal,
    "mileage": kilometer,
    "location": "by/område",
    "fuel_type": "brændstof",
    "transmission": "gearkasse"
  }
]

Hvis JSON ikke er muligt, giv da et kort tekstsvar med de bedste fund.`;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SearchRequest = await request.json();

    // Validate required fields
    if (!body.mode || !body.sites || body.sites.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: mode, sites' },
        { status: 400 }
      );
    }

    // Validate makes or models are provided
    if ((!body.makes || body.makes.length === 0) && (!body.models || body.models.length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'At least one make or model must be specified' },
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
    const prompt = buildSearchPrompt(body);

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
    } catch {
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
