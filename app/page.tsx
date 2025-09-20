'use client';

import { useState } from 'react';
import styles from "./page.module.css";

export default function Home() {
  const [formData, setFormData] = useState({
    make: 'BMW',
    model: 'X3',
    year_from: 2020,
    year_to: 2024,
    max_price: 500000,
    equipment: 'læder, panoramatag',
    optimization: 'laveste pris',
    sites: 'bilbasen.dk\ndba.dk\nbiltorvet.dk\nautotorvet.dk'
  });

  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          sites: formData.sites.split('\n').filter(s => s.trim())
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>CarHunter - Search Test</h1>

        <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              Make:
              <input
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>
              Model:
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ flex: 1 }}>
              Year From:
              <input
                type="number"
                value={formData.year_from}
                onChange={(e) => setFormData({ ...formData, year_from: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
            <label style={{ flex: 1 }}>
              Year To:
              <input
                type="number"
                value={formData.year_to}
                onChange={(e) => setFormData({ ...formData, year_to: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>
              Max Price (DKK):
              <input
                type="number"
                value={formData.max_price}
                onChange={(e) => setFormData({ ...formData, max_price: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>
              Equipment:
              <input
                type="text"
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>
              Optimization:
              <input
                type="text"
                value={formData.optimization}
                onChange={(e) => setFormData({ ...formData, optimization: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label>
              Sites (one per line):
              <textarea
                value={formData.sites}
                onChange={(e) => setFormData({ ...formData, sites: e.target.value })}
                rows={4}
                style={{ width: '100%', padding: '0.5rem', margin: '0.25rem 0' }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              backgroundColor: loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Searching...' : 'Search Cars'}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h3>Result:</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
