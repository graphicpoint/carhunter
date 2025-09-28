import { EquipmentValue } from '../lib/equipment';
import { SiteValue } from '../lib/sites';

export type SearchMode = 'buy' | 'leasing';

export type FuelType = 'benzin' | 'diesel' | 'ev' | 'hybrid' | 'phev';

export type BuyOptimization = 
  | 'laveste_pris'
  | 'bedste_værdi'
  | 'nyeste_årgang'
  | 'laveste_km'
  | 'bedste_udstyr'
  | 'hurtigste_salg';

export type LeasingOptimization = 
  | 'laveste_månedlig'
  | 'laveste_udbetaling'
  | 'bedste_værdi'
  | 'kortest_bindingsperiode'
  | 'bedste_service'
  | 'laveste_total';

export interface SearchFormData {
  // Mode selection
  mode: SearchMode;

  // Vehicle selection
  makes: string[];
  models: Record<string, string[]>; // make -> models[]

  // Specifications
  year_from?: number;
  year_to?: number;
  fuel_types: FuelType[];
  equipment: EquipmentValue[];

  // Pricing (conditional based on mode)
  max_price?: number; // for buy mode
  monthly_max?: number; // for leasing mode
  downpayment_max?: number; // for leasing mode

  // Danish tax considerations
  tax_paid?: boolean; // true = kun biler med betalt afgift, false = inkluder biler uden afgift

  // Search preferences
  optimization: BuyOptimization | LeasingOptimization;
  sites: SiteValue[];
}

export interface SearchRequest {
  mode: SearchMode;
  makes: string[];
  models: string[];
  year_from?: number;
  year_to?: number;
  fuel_types: FuelType[];
  equipment: EquipmentValue[];
  max_price?: number;
  monthly_max?: number;
  downpayment_max?: number;
  tax_paid?: boolean;
  optimization: string;
  sites: string[];
}

export interface CarResult {
  title?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  ask_price?: number;
  monthly_price?: number;
  location?: string;
  url?: string;
  description?: string;
  fuel_type?: string;
  transmission?: string;
  engine_size?: string;
  power?: string;
  equipment?: string[];
  images?: string[];
  dealer?: string;
  phone?: string;
  email?: string;
}

export interface SearchResponse {
  ok: boolean;
  query?: SearchRequest;
  results?: CarResult[] | { raw: string };
  error?: string;
  timestamp?: number;
  total_found?: number;
  raw_total?: number;
}

// Option types for react-select
export interface SelectOption {
  value: string;
  label: string;
  isGroup?: boolean;
  group?: string;
}

export interface MakeOption extends SelectOption {
  value: string;
  label: string;
}

export interface ModelOption extends SelectOption {
  value: string;
  label: string;
  make: string;
}

export interface EquipmentOption extends SelectOption {
  value: EquipmentValue;
  label: string;
}

export interface SiteOption extends SelectOption {
  value: SiteValue;
  label: string;
  isGroup?: boolean;
  group?: string;
}

// Form validation
export interface FormErrors {
  makes?: string;
  models?: string;
  year_from?: string;
  year_to?: string;
  max_price?: string;
  monthly_max?: string;
  downpayment_max?: string;
  fuel_types?: string;
  sites?: string;
  optimization?: string;
}

// API response types
export interface MakesResponse {
  makes: string[];
  error?: string;
}

export interface ModelsResponse {
  models: string[];
  error?: string;
}
