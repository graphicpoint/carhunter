import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 86400; // 24 hours

interface CarQueryModel {
  model_name: string;
  model_make_id: string;
}

interface VPICModel {
  Make_ID: number;
  Make_Name: string;
  Model_ID: number;
  Model_Name: string;
}

async function fetchFromCarQuery(make: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://www.carqueryapi.com/api/0.3/?cmd=getModels&make=${encodeURIComponent(make)}`,
      { next: { revalidate: 86400 } }
    );
    
    if (!response.ok) {
      throw new Error(`CarQuery API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.Models && Array.isArray(data.Models)) {
      return data.Models
        .map((model: CarQueryModel) => model.model_name)
        .filter((name: string) => name && name.trim())
        .sort();
    }
    
    throw new Error('Invalid CarQuery response format');
  } catch (error) {
    console.error('CarQuery API failed:', error);
    throw error;
  }
}

async function fetchFromVPIC(make: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`,
      { next: { revalidate: 86400 } }
    );
    
    if (!response.ok) {
      throw new Error(`vPIC API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.Results && Array.isArray(data.Results)) {
      return data.Results
        .map((model: VPICModel) => model.Model_Name)
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
    const { searchParams } = new URL(request.url);
    const make = searchParams.get('make');
    const provider = searchParams.get('provider') || 'carquery';
    
    if (!make) {
      return NextResponse.json(
        { error: 'Make parameter is required', models: [] },
        { status: 400 }
      );
    }
    
    let models: string[];
    
    if (provider === 'vpic') {
      models = await fetchFromVPIC(make);
    } else {
      try {
        models = await fetchFromCarQuery(make);
      } catch (error) {
        console.log('CarQuery failed, falling back to vPIC:', error);
        models = await fetchFromVPIC(make);
      }
    }
    
    return NextResponse.json({ models });
    
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models', models: [] },
      { status: 500 }
    );
  }
}
