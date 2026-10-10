import React, { useEffect, useState } from 'react';
import { download } from '../engine/io.js';

// Generates a leaf's stub PDF and shows it in the browser's own PDF viewer.
export default function PdfPreview({ project, seqNumber, leaf, inline = false, onClose }) {
  const [state, setState] = useState({ url: null, size: 0, md5: '', error: null });
  useEffect(() => {
    let url = null; let live = true;
    import('../engine/pdfgen.js')
      .then(async ({ leafPdf, md5Bytes }) => ({ bytes: await leafPdf(project, seqNumber, leaf), md5Bytes }))
      .then(({ bytes, md5Bytes }) => {
        if (!live) return;
        url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        setState({ url, size: bytes.length, md5: md5Bytes(bytes), error: null, bytes });
      })
      .catch((e) => live && setState({ url: null, error: e.message }));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [project, seqNumber, leaf]);

  const body = (
    <>
      {state.error && <p className="callout bad">Could not generate the PDF: {state.error}</p>}
      {!state.url && !state.error && <p className="muted">Generating PDF…</p>}
      {state.url && (
        <>
          <p className="small muted" style={{ margin: '0 0 .5rem' }}>
            Stub of {leaf.fileName}: {(state.size / 1024).toFixed(1)} KB, MD5 <span className="mono">{state.md5}</span>. Open the bookmarks panel in the viewer to see its outline.
          </p>
          <iframe title={`PDF preview: ${leaf.title}`} src={state.url} style={{ width: '100%', height: inline ? '70vh' : '72vh', border: '1px solid var(--line)', borderRadius: 'var(--radius-s)', background: '#fff' }} />
          <div className="row" style={{ marginTop: '.5rem' }}>
            <button className="btn small" onClick={() => download(leaf.fileName, state.bytes, 'application/pdf')}>Download PDF</button>
            <a className="btn small" href={state.url} target="_blank" rel="noreferrer">Open in a new tab</a>
          </div>
        </>
      )}
    </>
  );
  if (inline) return body;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} role="dialog" aria-modal="true" aria-label={`PDF preview: ${leaf.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>{leaf.title || leaf.fileName}</h2><button className="btn small" onClick={onClose}>Close</button></div>
        <div style={{ marginTop: '.75rem' }}>{body}</div>
      </div>
    </div>
  );
}
