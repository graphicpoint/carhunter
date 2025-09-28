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
 */
function isValidCarURL(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Bilbasen.dk - should have specific car ID, not category pages
  if (urlLower.includes('bilbasen.dk')) {
    // Valid: https://www.bilbasen.dk/brugt/bil/bmw/x3/id/12345678
    // Invalid: https://www.bilbasen.dk/brugt/bil/bmw/x3
    // Invalid: https://www.bilbasen.dk/brugt/bil/ps-bmw_suv?page=7
    if (urlLower.includes('?page=') || urlLower.includes('/ps-')) return false;
    if (urlLower.includes('/brugt/bil/') && !urlLower.match(/\/\d{6,}$/)) return false;
    return urlLower.match(/\/\d{6,}$/) !== null;
  }

  // Biltorvet.dk - should have detailed car specification path
  if (urlLower.includes('biltorvet.dk')) {
    // Valid: https://www.biltorvet.dk/bil/bmw/x3/2-0-xdrive20d-m-sport-aut/2876734
    // Invalid: https://www.biltorvet.dk/bil/bmw/x3/14938579
    if (!urlLower.includes('/bil/')) return false;
    const pathParts = urlLower.split('/bil/')[1]?.split('/');
    if (!pathParts || pathParts.length < 4) return false;
    // Should have: brand/model/specification/id
    return pathParts.length >= 4 && /\d{6,}$/.test(pathParts[pathParts.length - 1]);
  }

  // DBA.dk - should have specific car ID
  if (urlLower.includes('dba.dk')) {
    // Valid: https://www.dba.dk/bil/bmw-x3/id-12345678
    return urlLower.match(/\/id-\d{6,}/) !== null;
  }

  // Autotorvet.dk - should have specific car ID
  if (urlLower.includes('autotorvet.dk')) {
    // Valid: https://www.autotorvet.dk/bil/bmw/x3/12345678
    return urlLower.match(/\/\d{6,}$/) !== null;
  }

  return false;
}

/**
 * Filter out invalid car results with strict validation
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

    // Validate URL format for each site
    if (!isValidCarURL(car.url)) return false;

    // Must have basic car information
    if (!car.title && !car.year && !car.ask_price) return false;

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

  // Different prompts for buy vs leasing
  if (body.mode === 'leasing') {
    return `Du er en ekspert bil-søgemaskine for danske bilsites specialiseret i LEASING tilbud.

KRITISKE INSTRUKTIONER FOR LEASING:
- Søg KUN på disse specificerede danske sites: ${sitesText}
- IGNORER alle andre websites (autouncle.dk, autoline.dk, bn.dk, bil360.dk, etc.)
- Find LEASING tilbud og månedlige priser, ikke købs-annoncer
- Returner MINIMUM 10 leasing tilbud hvis tilgængelige
- Kun direkte links til specifikke bil-annoncer med leasing priser
- Inkluder månedlige leasing priser og udbetaling

SØGEKRITERIER FOR LEASING:
${modeText} ${vehicleText} ${yearText} ${priceText}${fuelText}${equipmentText}${optimizationText}

RETURNER JSON FORMAT:
[
  {
    "title": "konkret bil titel med mærke og model",
    "url": "direkte link til specifik bil-annonce",
    "ask_price": købs_pris_i_kr_eller_null,
    "monthly_price": månedlig_leasing_pris_i_kr,
    "year": årstal_som_nummer,
    "mileage": kilometer_som_nummer,
    "location": "dansk_by/område",
    "fuel_type": "brændstof",
    "transmission": "gearkasse"
  }
]

VIGTIGT FOR LEASING:
- Minimum 10 leasing tilbud
- Kun specifikke bil-annoncer med leasing priser
- Kun de angivne danske sites: ${sitesText}
- INGEN kategorisider eller søgesider`;
  } else {
    return `Du er en ekspert bil-søgemaskine for danske bilsites specialiseret i BIL-KØB.

KRITISKE INSTRUKTIONER FOR KØB:
- Søg KUN på disse specificerede danske sites: ${sitesText}
- IGNORER alle andre websites (autouncle.dk, autoline.dk, bn.dk, bil360.dk, etc.)
- Find biler til salg med købs-priser
- Returner MINIMUM 10 bil-annoncer hvis tilgængelige
- Kun direkte links til specifikke bil-annoncer
- Kun danske resultater

SØGEKRITERIER FOR KØB:
${modeText} ${vehicleText} ${yearText} ${priceText}${fuelText}${equipmentText}${optimizationText}

RETURNER JSON FORMAT:
[
  {
    "title": "konkret bil titel med mærke og model",
    "url": "direkte link til specifik bil-annonce",
    "ask_price": købs_pris_i_kr_som_nummer,
    "monthly_price": null,
    "year": årstal_som_nummer,
    "mileage": kilometer_som_nummer,
    "location": "dansk_by/område",
    "fuel_type": "brændstof",
    "transmission": "gearkasse"
  }
]

VIGTIGT FOR KØB:
- Minimum 10 bil-annoncer
- Kun specifikke bil-annoncer med købs-priser
- Kun de angivne danske sites: ${sitesText}
- INGEN kategorisider eller søgesider`;
  }
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

      // Filter valid car results with strict validation
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
