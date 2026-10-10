import React, { useState } from 'react';
import glossary from '../data/glossary.json' with { type: 'json' };

export default function Glossary() {
  const [q, setQ] = useState('');
  const list = glossary.filter((g) => (g.term + ' ' + g.def).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.term.localeCompare(b.term));
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>Glossary</h1>
      <label className="field" style={{ maxWidth: 420 }}>Search terms
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. checksum" />
      </label>
      <dl style={{ marginTop: '1.5rem' }}>
        {list.map((g) => (
          <div key={g.term} id={`term-${g.term}`} style={{ padding: '.6rem 0', borderBottom: '1px solid var(--line)' }}>
            <dt style={{ fontWeight: 700 }}>{g.term}</dt>
            <dd style={{ margin: '.2rem 0 0' }}>{g.def}</dd>
          </div>
        ))}
        {!list.length && <p className="muted">No term matches "{q}".</p>}
      </dl>
    </div>
  );
}
