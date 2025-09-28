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
 * Filter out invalid car results (category pages, invalid URLs, etc.)
 */
function filterValidCarResults(results: CarResult[]): CarResult[] {
  if (!Array.isArray(results)) return [];

  return results.filter(car => {
    // Must have a URL
    if (!car.url) return false;

    // Filter out category pages and search pages
    const url = car.url.toLowerCase();
    const invalidPatterns = [
      '/brugt/bil/', // Category pages like /brugt/bil/audi/rs6
      '/biler/brugte-biler/', // Category pages
      '/da/brugte-biler/', // Category pages
      '/search', // Search pages
      '/soeg', // Danish search pages
      '/kategori', // Category pages
      '/models', // Model overview pages
      '/bil/bmw/', // Category pages like /bil/bmw/x3/51
      '/bilmaerker/', // Brand category pages
      '/varevogn-moms-', // Commercial vehicle pages
    ];

    // Check if URL contains invalid patterns without specific car ID
    const hasInvalidPattern = invalidPatterns.some(pattern => {
      if (url.includes(pattern)) {
        // Allow if it has a specific car ID (7+ digits or specific patterns)
        const afterPattern = url.split(pattern)[1];
        // Must have a long ID or specific car identifier
        return !afterPattern || (!/\d{7,}/.test(afterPattern) && !/\d+-\d+/.test(afterPattern));
      }
      return false;
    });

    if (hasInvalidPattern) return false;

    // Must have basic car information
    if (!car.title && !car.year && !car.ask_price) return false;

    // URL should be from allowed Danish sites ONLY
    const allowedDomains = ['bilbasen.dk', 'dba.dk', 'biltorvet.dk', 'autotorvet.dk'];
    const hasAllowedDomain = allowedDomains.some(domain => url.includes(domain));
    if (!hasAllowedDomain) return false;

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

  return `Du er en ekspert bil-søgemaskine for danske bilsites.

KRITISKE INSTRUKTIONER:
- Søg KUN på disse specificerede danske sites: ${sitesText}
- IGNORER alle andre websites (bn.dk, bil360.dk, etc.)
- Returner MINIMUM 10 bil-annoncer hvis tilgængelige
- Kun direkte links til specifikke bil-annoncer, ALDRIG kategorisider eller søgesider
- Links skal være til individuelle bil-annoncer med konkrete biler til salg
- Ignorer alle andre websites end de specificerede danske sites

SØGEKRITERIER:
${modeText} ${vehicleText} ${yearText} ${priceText}${fuelText}${equipmentText}${optimizationText}

RETURNER JSON FORMAT:
[
  {
    "title": "konkret bil titel med mærke og model",
    "url": "direkte link til specifik bil-annonce",
    "ask_price": pris_i_kr_som_nummer,
    "monthly_price": månedlig_pris_i_kr_eller_null,
    "year": årstal_som_nummer,
    "mileage": kilometer_som_nummer,
    "location": "by/område",
    "fuel_type": "brændstof",
    "transmission": "gearkasse"
  }
]

VIGTIGT:
- Minimum 10 resultater
- Kun specifikke bil-annoncer
- Kun de angivne danske sites: ${sitesText}
- INGEN kategorisider eller søgesider`;
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

      // Filter valid car results
      const filteredResults = filterValidCarResults(parsedResults);

      return NextResponse.json({
        ok: true,
        query: body,
        results: filteredResults,
        total_found: filteredResults.length,
        raw_total: Array.isArray(parsedResults) ? parsedResults.length : 0
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
