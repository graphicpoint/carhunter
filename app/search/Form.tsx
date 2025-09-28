'use client';

import { useState, useEffect } from 'react';
import Select from 'react-select';
import makeAnimated from 'react-select/animated';
import { useQuery } from '@tanstack/react-query';
import {
  SearchFormData,
  SearchMode,
  FuelType,
  BuyOptimization,
  LeasingOptimization,
  MakeOption,
  EquipmentOption,
  SiteOption,
  MakesResponse,
  ModelsResponse
} from '../../types/search';
import { EQUIPMENT_OPTIONS } from '../../lib/equipment';
import { SITE_OPTIONS } from '../../lib/sites';

const animatedComponents = makeAnimated();

const FUEL_OPTIONS = [
  { value: 'benzin', label: 'Benzin' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'ev', label: 'El' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'phev', label: 'Plugin Hybrid' },
] as const;

const BUY_OPTIMIZATION_OPTIONS = [
  { value: 'laveste_pris', label: 'Laveste pris' },
  { value: 'bedste_værdi', label: 'Bedste værdi' },
  { value: 'nyeste_årgang', label: 'Nyeste årgang' },
  { value: 'laveste_km', label: 'Laveste km' },
  { value: 'bedste_udstyr', label: 'Bedste udstyr' },
  { value: 'hurtigste_salg', label: 'Hurtigste salg' },
] as const;

const LEASING_OPTIMIZATION_OPTIONS = [
  { value: 'laveste_månedlig', label: 'Laveste månedlige' },
  { value: 'laveste_udbetaling', label: 'Laveste udbetaling' },
  { value: 'bedste_værdi', label: 'Bedste værdi' },
  { value: 'kortest_bindingsperiode', label: 'Kortest bindingsperiode' },
  { value: 'bedste_service', label: 'Bedste service' },
  { value: 'laveste_total', label: 'Laveste total' },
] as const;

interface SearchFormProps {
  onSubmit: (data: SearchFormData) => void;
  onDirectSearch?: (data: SearchFormData) => void;
  loading?: boolean;
}

export default function SearchForm({ onSubmit, onDirectSearch, loading = false }: SearchFormProps) {
  const [formData, setFormData] = useState<SearchFormData>({
    mode: 'buy',
    makes: [],
    models: {},
    fuel_types: [],
    equipment: [],
    optimization: 'laveste_pris',
    sites: ['group:DK'],
  });

  // Fetch makes
  const { data: makesData, isLoading: makesLoading } = useQuery<MakesResponse>({
    queryKey: ['makes'],
    queryFn: async () => {
      const response = await fetch('/api/catalog/makes');
      if (!response.ok) throw new Error('Failed to fetch makes');
      return response.json();
    },
  });

  // Fetch models for selected makes
  const selectedMakes = formData.makes;
  const { data: modelsData, isLoading: modelsLoading } = useQuery<Record<string, string[]>>({
    queryKey: ['models', selectedMakes],
    queryFn: async () => {
      if (selectedMakes.length === 0) return {};
      
      const modelsPromises = selectedMakes.map(async (make) => {
        const response = await fetch(`/api/catalog/models?make=${encodeURIComponent(make)}`);
        if (!response.ok) throw new Error(`Failed to fetch models for ${make}`);
        const data: ModelsResponse = await response.json();
        return { make, models: data.models || [] };
      });
      
      const results = await Promise.all(modelsPromises);
      return results.reduce((acc, { make, models }) => {
        acc[make] = models;
        return acc;
      }, {} as Record<string, string[]>);
    },
    enabled: selectedMakes.length > 0,
  });

  // Update available models when makes change, but don't auto-select them
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (modelsData) {
      setAvailableModels(modelsData);
      // Only remove models for makes that are no longer selected, don't auto-add
      setFormData(prev => {
        const newModels = { ...prev.models };
        Object.keys(newModels).forEach(make => {
          if (!selectedMakes.includes(make)) {
            delete newModels[make];
          }
        });
        return { ...prev, models: newModels };
      });
    }
  }, [modelsData, selectedMakes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleDirectSearch = () => {
    if (onDirectSearch) {
      onDirectSearch(formData);
    }
  };

  const makeOptions: MakeOption[] = makesData?.makes?.map(make => ({
    value: make,
    label: make,
  })) || [];

  const equipmentOptions: EquipmentOption[] = EQUIPMENT_OPTIONS.map(eq => ({
    value: eq.value,
    label: eq.label,
  }));

  const siteOptions: SiteOption[] = SITE_OPTIONS.map(site => ({
    value: site.value,
    label: site.label,
    isGroup: 'isGroup' in site ? site.isGroup : undefined,
    group: 'group' in site ? site.group : undefined,
  }));

  const optimizationOptions = formData.mode === 'buy' 
    ? BUY_OPTIMIZATION_OPTIONS 
    : LEASING_OPTIMIZATION_OPTIONS;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Søgetype</h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label>
            <input
              type="radio"
              value="buy"
              checked={formData.mode === 'buy'}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                mode: e.target.value as SearchMode,
                optimization: 'laveste_pris'
              }))}
            />
            Køb
          </label>
          <label>
            <input
              type="radio"
              value="leasing"
              checked={formData.mode === 'leasing'}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                mode: e.target.value as SearchMode,
                optimization: 'laveste_månedlig'
              }))}
            />
            Leasing
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Mærker *</label>
        <Select
          isMulti
          components={animatedComponents}
          closeMenuOnSelect={false}
          options={makeOptions}
          value={makeOptions.filter(option => formData.makes.includes(option.value))}
          onChange={(selected) => {
            const makes = selected ? selected.map(s => s.value) : [];
            setFormData(prev => ({ ...prev, makes, models: {} }));
          }}
          placeholder="Vælg mærker..."
          isLoading={makesLoading}
          required
        />
      </div>

      {formData.makes.length > 0 && (
        <div className="form-section">
          <label>Modeller</label>
          {formData.makes.map(make => (
            <div key={make} className="model-select">
              <label>{make} modeller:</label>
              <Select
                isMulti
                components={animatedComponents}
                closeMenuOnSelect={false}
                options={availableModels?.[make]?.map(model => ({ value: model, label: model })) || []}
                value={formData.models[make]?.map(model => ({ value: model, label: model })) || []}
                onChange={(selected) => {
                  const models = selected ? selected.map(s => s.value) : [];
                  setFormData(prev => ({
                    ...prev,
                    models: { ...prev.models, [make]: models }
                  }));
                }}
                placeholder={`Vælg ${make} modeller...`}
                isLoading={modelsLoading}
              />
            </div>
          ))}
        </div>
      )}

      <div className="form-row">
        <div className="form-section">
          <label>Fra årgang</label>
          <input
            type="number"
            min="1990"
            max={new Date().getFullYear() + 1}
            value={formData.year_from || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              year_from: e.target.value ? parseInt(e.target.value) : undefined 
            }))}
            placeholder="2020"
          />
        </div>
        <div className="form-section">
          <label>Til årgang</label>
          <input
            type="number"
            min="1990"
            max={new Date().getFullYear() + 1}
            value={formData.year_to || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              year_to: e.target.value ? parseInt(e.target.value) : undefined 
            }))}
            placeholder="2024"
          />
        </div>
      </div>

      <div className="form-section">
        <label>Brændstof</label>
        <Select
          isMulti
          components={animatedComponents}
          closeMenuOnSelect={false}
          options={FUEL_OPTIONS}
          value={FUEL_OPTIONS.filter(option => formData.fuel_types.includes(option.value as FuelType))}
          onChange={(selected) => {
            const fuelTypes = selected ? selected.map(s => s.value as FuelType) : [];
            setFormData(prev => ({ ...prev, fuel_types: fuelTypes }));
          }}
          placeholder="Vælg brændstof..."
        />
      </div>

      {formData.mode === 'buy' ? (
        <div className="form-section">
          <label>Max pris (kr)</label>
          <input
            type="number"
            min="0"
            step="1000"
            value={formData.max_price || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              max_price: e.target.value ? parseInt(e.target.value) : undefined 
            }))}
            placeholder="500000"
          />
        </div>
      ) : (
        <div className="form-row">
          <div className="form-section">
            <label>Max månedlig (kr)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={formData.monthly_max || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                monthly_max: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              placeholder="5000"
            />
          </div>
          <div className="form-section">
            <label>Max udbetaling (kr)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={formData.downpayment_max || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                downpayment_max: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              placeholder="50000"
            />
          </div>
        </div>
      )}

      <div className="form-section">
        <label>Udstyr</label>
        <Select
          isMulti
          components={animatedComponents}
          closeMenuOnSelect={false}
          options={equipmentOptions}
          value={equipmentOptions.filter(option => formData.equipment.includes(option.value))}
          onChange={(selected) => {
            const equipment = selected ? selected.map(s => s.value) : [];
            setFormData(prev => ({ ...prev, equipment }));
          }}
          placeholder="Vælg udstyr..."
        />
      </div>

      <div className="form-section">
        <label>Optimering *</label>
        <Select
          options={optimizationOptions}
          value={optimizationOptions.find(option => option.value === formData.optimization)}
          onChange={(selected) => {
            if (selected) {
              setFormData(prev => ({
                ...prev,
                optimization: selected.value as BuyOptimization | LeasingOptimization
              }));
            }
          }}
          placeholder="Vælg optimering..."
          required
        />
      </div>

      <div className="form-section">
        <label>Sites *</label>
        <Select
          isMulti
          components={animatedComponents}
          closeMenuOnSelect={false}
          options={siteOptions}
          value={siteOptions.filter(option => formData.sites.includes(option.value))}
          onChange={(selected) => {
            const sites = selected ? selected.map(s => s.value) : [];
            setFormData(prev => ({ ...prev, sites }));
          }}
          placeholder="Vælg sites..."
          required
        />
      </div>

      <div className="button-group">
        <button type="submit" disabled={loading} className="submit-button perplexity-button">
          {loading ? 'Søger...' : 'Søg med Perplexity'}
        </button>

        <button
          type="button"
          disabled={loading}
          className="submit-button direct-button"
          onClick={handleDirectSearch}
        >
          {loading ? 'Søger...' : 'Pålidelig Søgning'}
        </button>
      </div>

      <style jsx>{`
        .button-group {
          display: flex;
          gap: 1rem;
        }

        .submit-button {
          flex: 1;
          padding: 0.75rem 1.5rem;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .perplexity-button {
          background-color: #007bff;
        }

        .perplexity-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .direct-button {
          background-color: #28a745;
        }

        .direct-button:hover:not(:disabled) {
          background-color: #1e7e34;
        }

        .submit-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}
