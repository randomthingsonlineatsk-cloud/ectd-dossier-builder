import React from 'react';
import status from '../data/ectd-status.json' with { type: 'json' };

export default function StatusTable() {
  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="sr-only">eCTD version status by region</caption>
        <thead><tr><th>Region</th><th>v3.2.2</th><th>v4.0 status</th><th>In this app</th></tr></thead>
        <tbody>
          {status.rows.map((r) => (
            <tr key={r.region}>
              <td><strong>{r.region}</strong></td>
              <td>{r.v322}</td>
              <td>{r.v40}{r.source && <> (<a href={r.source} target="_blank" rel="noreferrer">source</a>)</>}</td>
              <td>{r.app}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">Last reviewed {status.lastReviewed}. Dates change as agencies announce them; this table is a data file in the repo.</p>
    </div>
  );
}
