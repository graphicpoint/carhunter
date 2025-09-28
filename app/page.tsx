'use client';

import { useState } from 'react';
import SearchForm from './search/Form';
import { SearchFormData, SearchResponse, SearchRequest } from '../types/search';

export default function Home() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (formData: SearchFormData) => {
    setLoading(true);
    setResult(null);

    try {
      // Convert form data to API request format
      const allModels = Object.values(formData.models).flat();

      const searchRequest: SearchRequest = {
        mode: formData.mode,
        makes: formData.makes,
        models: allModels,
        year_from: formData.year_from,
        year_to: formData.year_to,
        fuel_types: formData.fuel_types,
        equipment: formData.equipment,
        max_price: formData.max_price,
        monthly_max: formData.monthly_max,
        downpayment_max: formData.downpayment_max,
        tax_paid: formData.tax_paid,
        optimization: formData.optimization,
        sites: formData.sites as string[],
      };

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchRequest),
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        ok: false,
        error: 'Network error - kunne ikke forbinde til serveren'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDirectSearch = async (formData: SearchFormData) => {
    setLoading(true);
    setResult(null);

    try {
      // Convert form data to API request format
      const allModels = Object.values(formData.models).flat();

      const searchRequest: SearchRequest = {
        mode: formData.mode,
        makes: formData.makes,
        models: allModels,
        year_from: formData.year_from,
        year_to: formData.year_to,
        fuel_types: formData.fuel_types,
        equipment: formData.equipment,
        max_price: formData.max_price,
        monthly_max: formData.monthly_max,
        downpayment_max: formData.downpayment_max,
        tax_paid: formData.tax_paid,
        optimization: formData.optimization,
        sites: formData.sites as string[],
      };

      const response = await fetch('/api/direct-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchRequest),
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        ok: false,
        error: 'Network error - kunne ikke forbinde til serveren'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div style={{ padding: '2rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
          <h1 style={{
            textAlign: 'center',
            marginBottom: '2rem',
            color: '#333',
            fontSize: '2.5rem'
          }}>
            CarHunter - Avanceret Bilsøgning
          </h1>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            marginBottom: '2rem'
          }}>
            <SearchForm onSubmit={handleSearch} onDirectSearch={handleDirectSearch} loading={loading} />
          </div>

          {result && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              padding: '2rem'
            }}>
              <h2 style={{ marginBottom: '1rem', color: '#333' }}>Søgeresultater</h2>

              {!result.ok ? (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  borderRadius: '4px',
                  border: '1px solid #f5c6cb'
                }}>
                  <strong>Fejl:</strong> {result.error || 'Ukendt fejl opstod'}
                </div>
              ) : result.results ? (
                Array.isArray(result.results) ? (
                  result.results.length > 0 ? (
                    <div>
                      <p style={{ marginBottom: '1rem', color: '#666' }}>
                        Fandt {result.results.length} gyldige resultater
                        {result.raw_total && result.raw_total > result.results.length && (
                          <span style={{ color: '#888', fontSize: '0.9em' }}>
                            {' '}(filtrerede {result.raw_total - result.results.length} irrelevante resultater fra)
                          </span>
                        )}
                        {result.debug && (
                          <span style={{ color: '#666', fontSize: '0.8em', display: 'block', marginTop: '0.25rem' }}>
                            Debug: Original {result.debug.original_count}, Filtered {result.debug.filtered_count}
                            {result.debug.extraction_used && ' (JSON extracted from text)'}
                          </span>
                        )}
                      </p>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.9rem'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8f9fa' }}>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Model</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Årgang</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Km</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Pris</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Lokation</th>
                              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.results.map((car, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                                <td style={{ padding: '0.75rem' }}>{car.title || `${car.make} ${car.model}` || 'N/A'}</td>
                                <td style={{ padding: '0.75rem' }}>{car.year || 'N/A'}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  {car.mileage ? car.mileage.toLocaleString('da-DK') : 'N/A'}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {car.ask_price ? `${car.ask_price.toLocaleString('da-DK')} kr` :
                                   car.monthly_price ? `${car.monthly_price.toLocaleString('da-DK')} kr/md` : 'N/A'}
                                </td>
                                <td style={{ padding: '0.75rem' }}>{car.location || 'N/A'}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  {car.url ? (
                                    <a
                                      href={car.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: '#007bff',
                                        textDecoration: 'none',
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      Se bil
                                    </a>
                                  ) : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '2rem',
                      textAlign: 'center',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px'
                    }}>
                      <h3 style={{ color: '#666', marginBottom: '1rem' }}>Ingen resultater fundet</h3>
                      <p style={{ color: '#666' }}>
                        Prøv at udvide dine søgekriterier eller vælg flere mærker/sites.
                      </p>
                    </div>
                  )
                ) : result.results.raw ? (
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#d1ecf1',
                    color: '#0c5460',
                    borderRadius: '4px',
                    border: '1px solid #bee5eb',
                    marginBottom: '1rem'
                  }}>
                    <strong>Rå svar fra Perplexity:</strong>
                    <div style={{
                      marginTop: '0.5rem',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}>
                      {result.results.raw}
                    </div>
                  </div>
                ) : null
              ) : (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  borderRadius: '4px',
                  border: '1px solid #ffeaa7'
                }}>
                  Ingen data modtaget fra søgningen.
                </div>
              )}

              {/* Debug section */}
              <details style={{ marginTop: '2rem' }}>
                <summary style={{
                  cursor: 'pointer',
                  padding: '0.5rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontWeight: 'bold'
                }}>
                  Debug Information
                </summary>
                <pre style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
