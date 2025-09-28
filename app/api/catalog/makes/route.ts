import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 86400; // 24 hours
export const dynamic = 'force-dynamic'; // Prevent static generation

interface CarQueryMake {
  make_id: string;
  make_display: string;
  make_is_common: string;
  make_country: string;
}

interface VPICMake {
  Make_ID: number;
  Make_Name: string;
}

async function fetchFromCarQuery(): Promise<string[]> {
  try {
    const response = await fetch(
      'https://www.carqueryapi.com/api/0.3/?cmd=getMakes&sold_in_us=0',
      { next: { revalidate: 86400 } }
    );
    
    if (!response.ok) {
      throw new Error(`CarQuery API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.Makes && Array.isArray(data.Makes)) {
      return data.Makes
        .map((make: CarQueryMake) => make.make_display)
        .filter((name: string) => name && name.trim())
        .sort();
    }
    
    throw new Error('Invalid CarQuery response format');
  } catch (error) {
    console.error('CarQuery API failed:', error);
    throw error;
  }
}

async function fetchFromVPIC(): Promise<string[]> {
  try {
    const response = await fetch(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json',
      { next: { revalidate: 86400 } }
    );
    
    if (!response.ok) {
      throw new Error(`vPIC API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.Results && Array.isArray(data.Results)) {
      return data.Results
        .map((make: VPICMake) => make.Make_Name)
        .filter((name: string) => name && name.trim())
        .sort();
    }
    
    throw new Error('Invalid vPIC response format');
  } catch (error) {
    console.error('vPIC API failed:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider') || 'carquery';
    
    let makes: string[];
    
    if (provider === 'vpic') {
      makes = await fetchFromVPIC();
    } else {
      try {
        makes = await fetchFromCarQuery();
      } catch (error) {
        console.log('CarQuery failed, falling back to vPIC:', error);
        makes = await fetchFromVPIC();
      }
    }
    
    return NextResponse.json({ makes });
    
  } catch (error) {
    console.error('Makes API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch makes', makes: [] },
      { status: 500 }
    );
  }
}
