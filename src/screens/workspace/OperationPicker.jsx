import React, { useEffect, useRef, useState } from 'react';

// Asks which lifecycle operation a newly placed document should carry.
// Standard mode offers only valid targets (current leaves under the same heading);
// expert mode lists every earlier leaf so users can make mistakes on purpose.
export default function OperationPicker({ code, doc, prevState, expert, onCancel, onConfirm }) {
  const all = [...prevState.entries.values()].filter((e) => e.leaf.operation !== 'delete');
  const valid = all.filter((e) => e.status === 'current' && e.leaf.nodeCode === code);
  const targets = expert ? all : valid;
  const [choice, setChoice] = useState(valid.length ? `replace|${valid[0].key}` : 'new');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onCancel]);

  const confirm = () => {
    const [op, key] = choice.split('|');
    if (op === 'new') return onConfirm({ operation: 'new', target: null });
    const e = prevState.entries.get(key);
    onConfirm({ operation: op, target: { seq: e.seq, leafId: e.leaf.id } });
  };
  const opt = (value, label, sub) => (
    <label className="choice" key={value}>
      <input type="radio" name="op" value={value} checked={choice === value} onChange={() => setChoice(value)} />
      <span><strong>{label}</strong>{sub && <span className="small muted" style={{ display: 'block' }}>{sub}</span>}</span>
    </label>
  );
  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="op-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="op-title" ref={ref} tabIndex={-1}>Lifecycle operation for "{doc?.title}"</h2>
        <p className="small">You are placing this in {code}. {valid.length ? 'Earlier sequences already have a current document here.' : 'There is no current document here yet.'}</p>
        {opt('new', 'New', 'Adds the document alongside anything already current here.')}
        {targets.map((e) => opt(`replace|${e.key}`, `Replace: ${e.leaf.title || '(no title)'}`, `${e.leaf.nodeCode}, sequence ${e.seq}${e.status !== 'current' ? `, already ${e.status}` : ''}`))}
        {targets.map((e) => opt(`append|${e.key}`, `Append to: ${e.leaf.title || '(no title)'}`, `${e.leaf.nodeCode}, sequence ${e.seq}. Adds to it without replacing it.`))}
        {expert && <p className="small muted">Expert mode: every earlier leaf is listed, including invalid targets.</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '.75rem' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={confirm}>Place document</button>
        </div>
      </div>
    </div>
  );
}
