import { NextRequest, NextResponse } from 'next/server';
import { SearchRequest } from '../../../types/search';
import { expandEquipmentTerms } from '../../../lib/equipment-synonyms';

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface CarResult {
  title?: string;
  url?: string;
  ask_price?: number;
  monthly_price?: number;
  year?: number;
  mileage?: number;
  location?: string;
  fuel_type?: string;
  transmission?: string;
}

/**
 * Validate specific URL patterns for each Danish car site
 * Made more lenient to allow more valid car listings through
 */
function isValidCarURL(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Bilbasen.dk - allow various formats
  if (urlLower.includes('bilbasen.dk')) {
    // Block obvious category pages
    if (urlLower.includes('?page=') || urlLower.includes('/ps-') || urlLower.includes('?includeengroscvr=')) return false;
    if (urlLower.includes('/brugt/bil/') && urlLower.split('/').length < 6) return false; // Too short path
    // Allow if it has a number at the end (car ID) - more lenient
    return /\/\d{4,}$/.test(urlLower) || /\/id\/\d{4,}/.test(urlLower);
  }

  // Biltorvet.dk - more lenient validation
  if (urlLower.includes('biltorvet.dk')) {
    if (!urlLower.includes('/bil/')) return false;
    // Allow if it has a number at the end (car ID)
    return /\/\d{4,}$/.test(urlLower);
  }

  // DBA.dk - allow various ID formats
  if (urlLower.includes('dba.dk')) {
    // Allow id-XXXXX or just ending with numbers
    return /\/id-\d{4,}/.test(urlLower) || (/\/bil\//.test(urlLower) && /\/\d{4,}$/.test(urlLower));
  }

  // Autotorvet.dk - more lenient
  if (urlLower.includes('autotorvet.dk')) {
    // Allow if it has /bil/ and ends with numbers
    return urlLower.includes('/bil/') && /\/\d{4,}$/.test(urlLower);
  }

  return false;
}

/**
 * Filter out invalid car results with more lenient validation
 */
function filterValidCarResults(results: CarResult[]): CarResult[] {
  if (!Array.isArray(results)) return [];

  return results.filter(car => {
    // Must have a URL
    if (!car.url) return false;

    const url = car.url.toLowerCase();

    // Strict whitelist - ONLY these domains allowed
    const allowedDomains = ['bilbasen.dk', 'dba.dk', 'biltorvet.dk', 'autotorvet.dk'];
    const hasAllowedDomain = allowedDomains.some(domain => url.includes(domain));
    if (!hasAllowedDomain) return false;

    // Validate URL format for each site (more lenient now)
    if (!isValidCarURL(car.url)) return false;

    // Must have basic car information (more lenient)
    if (!car.title && !car.year && !car.ask_price && !car.monthly_price) return false;

    // Block foreign locations
    if (car.location && (
      car.location.toLowerCase().includes('praha') ||
      car.location.toLowerCase().includes('czech') ||
      car.location.toLowerCase().includes('germany') ||
      car.location.toLowerCase().includes('poland')
    )) return false;

    return true;
  });
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

  // Build equipment with synonyms
  const equipmentText = body.equipment.length > 0
    ? ` med udstyr: ${expandEquipmentTerms(body.equipment)}`
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

      // Filter valid car results with more lenient validation
      const filteredResults = filterValidCarResults(parsedResults);

      return NextResponse.json({
        ok: true,
        query: body,
        results: filteredResults,
        total_found: filteredResults.length,
        raw_total: Array.isArray(parsedResults) ? parsedResults.length : 0,
        debug: {
          original_count: Array.isArray(parsedResults) ? parsedResults.length : 0,
          filtered_count: filteredResults.length,
          filtered_out: Array.isArray(parsedResults) ? parsedResults.length - filteredResults.length : 0
        }
      });
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw content:', content);

      // Try to extract JSON from text that might have extra content
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const extractedResults = JSON.parse(jsonMatch[0]);
          const filteredResults = filterValidCarResults(extractedResults);

          return NextResponse.json({
            ok: true,
            query: body,
            results: filteredResults,
            total_found: filteredResults.length,
            raw_total: Array.isArray(extractedResults) ? extractedResults.length : 0,
            debug: {
              extraction_used: true,
              original_count: Array.isArray(extractedResults) ? extractedResults.length : 0,
              filtered_count: filteredResults.length
            }
          });
        } catch {
          // Still failed, return raw
        }
      }

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
