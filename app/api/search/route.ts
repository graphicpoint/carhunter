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
 * Very lenient to allow most car listings through
 */
function isValidCarURL(url: string): boolean {
  const urlLower = url.toLowerCase();

  // Bilbasen.dk - very lenient
  if (urlLower.includes('bilbasen.dk')) {
    // Block obvious category pages
    if (urlLower.includes('?page=') || urlLower.includes('/ps-') || urlLower.includes('?includeengroscvr=')) return false;
    // Allow most URLs that look like car listings
    return urlLower.includes('/bil/') || /\/\d{3,}/.test(urlLower) || urlLower.includes('/id/');
  }

  // Biltorvet.dk - very lenient
  if (urlLower.includes('biltorvet.dk')) {
    // Allow most URLs that look like car listings
    return urlLower.includes('/bil/') || /\/\d{3,}/.test(urlLower);
  }

  // DBA.dk - very lenient
  if (urlLower.includes('dba.dk')) {
    // Allow most URLs that look like car listings
    return urlLower.includes('/bil/') || urlLower.includes('/id-') || /\/\d{3,}/.test(urlLower);
  }

  // Autotorvet.dk - very lenient
  if (urlLower.includes('autotorvet.dk')) {
    // Allow most URLs that look like car listings
    return urlLower.includes('/bil/') || /\/\d{3,}/.test(urlLower);
  }

  return false;
}

/**
 * Filter out invalid car results with debug logging
 */
function filterValidCarResults(results: CarResult[]): CarResult[] {
  if (!Array.isArray(results)) return [];

  return results.filter(car => {
    // Must have a URL
    if (!car.url) {
      console.log('Filtered out: No URL', car);
      return false;
    }

    const url = car.url.toLowerCase();

    // Expanded whitelist - Danish car sites
    const allowedDomains = [
      'bilbasen.dk',
      'dba.dk',
      'biltorvet.dk',
      'autotorvet.dk',
      'bilhandel.dk',  // Added - common Danish car dealer site
      'autouncle.dk',  // CRITICAL: Perplexity often uses this - major Danish car aggregator
      'audi.dk',       // Added - official brand sites
      'bmw.dk',
      'toyota.dk',
      'mercedes.dk',
      'volkswagen.dk',
      'ford.dk',
      'peugeot.dk',
      'citroen.dk',
      'nissan.dk',
      'hyundai.dk',
      'kia.dk',
      'mazda.dk',
      'honda.dk',
      'subaru.dk',
      'mitsubishi.dk',
      'bn.dk',         // Added - Bjarne Nielsen (common Danish dealer)
      'autouncle.dk',  // CRITICAL: Perplexity often uses this - major Danish car aggregator
      'bilpriser.dk',  // Additional Danish car sites
      'bilzonen.dk',
      'carsales.dk',
      'carbase.dk'
    ];
    const hasAllowedDomain = allowedDomains.some(domain => url.includes(domain));
    if (!hasAllowedDomain) {
      console.log('Filtered out: Domain not allowed', car.url);
      return false;
    }

    // Validate URL format for each site (more lenient now)
    if (!isValidCarURL(car.url)) {
      console.log('Filtered out: Invalid URL format', car.url);
      return false;
    }

    // Must have basic car information (more lenient)
    if (!car.title && !car.year && !car.ask_price && !car.monthly_price) {
      console.log('Filtered out: No basic car info', car);
      return false;
    }

    // Block foreign locations
    if (car.location && (
      car.location.toLowerCase().includes('praha') ||
      car.location.toLowerCase().includes('czech') ||
      car.location.toLowerCase().includes('germany') ||
      car.location.toLowerCase().includes('poland')
    )) {
      console.log('Filtered out: Foreign location', car.location);
      return false;
    }

    console.log('Passed filter:', car.url);
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

KRITISKE KRAV:
- Søg PRIMÆRT på: bilbasen.dk, dba.dk, biltorvet.dk, autotorvet.dk, autouncle.dk
- Find minimum 8-15 konkrete bil-annoncer med ALLE detaljer
- URLs skal være direkte links til specifikke bil-annoncer (ikke kategorisider eller søgeresultater)
- ALLE resultater skal have konkrete priser, årgange og kilometerstand
- Verificer at alle URLs er gyldige og fører til bil annoncer
- Inkluder kun resultater fra danske bilsites
- For leasing søgninger, prioriter leasing tilbud hvis tilgængelige
- Match udstyr fleksibelt (f.eks. "læder" matcher "læder sæder", "læder rat")
- Hvis få resultater findes, udvid søgningen til lignende modeller

Returner data i det specificerede JSON format med følgende felter:
- title: Bil titel/navn
- url: Direkte link til bil annoncen
- ask_price: Salgspris (hvis tilgængelig)
- monthly_price: Månedlig pris for leasing (hvis tilgængelig)
- year: Årgang
- mileage: Kilometerstand
- location: Lokation/by
- equipment: Array af udstyr (hvis tilgængeligt)`;
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

    // Define JSON Schema for structured output - simplified for better compatibility
    const carResultSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          ask_price: { type: "string" },
          monthly_price: { type: "string" },
          year: { type: "string" },
          mileage: { type: "string" },
          location: { type: "string" }
        },
        required: ["title", "url"]
      }
    };

    // Call Perplexity API with JSON Schema response format
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        return_citations: true,
        return_images: false,
        return_related_questions: false,
        search_domain_filter: ["bilbasen.dk", "dba.dk", "biltorvet.dk", "autotorvet.dk", "autouncle.dk"],
        search_recency_filter: "month",
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: carResultSchema
          }
        }
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

    // Try to parse as JSON directly (should work with JSON Schema)
    try {
      const parsedResults = JSON.parse(content);

      // Check if it's an array of car results
      if (Array.isArray(parsedResults)) {
        // Filter valid car results with more lenient validation
        const filteredResults = filterValidCarResults(parsedResults);

        console.log(`✅ Direct JSON parse successful: ${parsedResults.length} -> ${filteredResults.length} results`);

        return NextResponse.json({
          ok: true,
          query: body,
          results: filteredResults,
          total_found: filteredResults.length,
          raw_total: parsedResults.length,
          debug: {
            json_schema_used: true,
            original_count: parsedResults.length,
            filtered_count: filteredResults.length,
            filtered_out: parsedResults.length - filteredResults.length
          }
        });
      } else {
        console.log('❌ Parsed JSON is not an array, falling back to extraction');
        throw new Error('Not an array');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw content:', content);

      // Enhanced JSON extraction with multiple patterns
      console.log('🔄 Trying enhanced regex extraction patterns...');

      const patterns = [
        // JSON code blocks (most common with Perplexity)
        /```json\s*(\[[\s\S]*?\])\s*```/i,           // Standard JSON code block
        /```\s*(\[[\s\S]*?\])\s*```/i,               // Generic code block
        // Direct JSON array at start (for pure JSON Schema responses)
        /^(\[\s*\{[\s\S]*?\}\s*\])/,
        // Extract from results property
        /"results":\s*(\[[\s\S]*?\])/i,
        // Find arrays with car-specific properties
        /(\[[\s\S]*?\{[\s\S]*?"title"[\s\S]*?\])/,   // Find array with title property
        /(\[[\s\S]*?\{[\s\S]*?"url"[\s\S]*?\])/,     // Find array with url property
        /(\[[\s\S]*?\{[\s\S]*?"ask_price"[\s\S]*?\])/,  // Find array with ask_price property
        // Any JSON array (fallback)
        /(\[[\s\S]*\])/
      ];

      let jsonMatch = null;
      for (let i = 0; i < patterns.length; i++) {
        console.log(`🔍 Testing pattern ${i + 1}:`, patterns[i].toString());
        jsonMatch = content.match(patterns[i]);
        if (jsonMatch) {
          console.log(`✅ Pattern ${i + 1} matched! Captured:`, jsonMatch[1]?.substring(0, 100) + '...');
          break;
        } else {
          console.log(`❌ Pattern ${i + 1} no match`);
        }
      }

      if (jsonMatch) {
        try {
          // Use the captured group if available, otherwise the full match
          const jsonText = jsonMatch[1] || jsonMatch[0];
          console.log('Attempting to parse extracted JSON:', jsonText.substring(0, 200) + '...');
          const extractedResults = JSON.parse(jsonText);
          const filteredResults = filterValidCarResults(extractedResults);

          console.log(`JSON extraction successful: ${extractedResults.length} -> ${filteredResults.length} results`);

          return NextResponse.json({
            ok: true,
            query: body,
            results: filteredResults,
            total_found: filteredResults.length,
            raw_total: Array.isArray(extractedResults) ? extractedResults.length : 0,
            debug: {
              extraction_used: true,
              extraction_method: jsonMatch[1] ? 'markdown' : 'simple',
              original_count: Array.isArray(extractedResults) ? extractedResults.length : 0,
              filtered_count: filteredResults.length,
              json_preview: jsonText.substring(0, 100) + '...'
            }
          });
        } catch (extractError) {
          console.error('JSON extraction error:', extractError);
          console.log('Failed JSON text:', jsonMatch[1] || jsonMatch[0]);
          // Still failed, return raw
        }
      } else {
        console.log('No JSON match found in content:', content.substring(0, 200) + '...');
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
