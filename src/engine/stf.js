// US study tagging files (STF) for eCTD v3.2.2, modelled on the public ICH STF
// specification and FDA file-tag list. Leaves in Modules 4.2 and 5.3 carry
// leaf.study = { id, tag }; one STF per study and heading is generated per sequence.
import { INDEX, folderPath, slug } from './tree.js';
import { docForLeaf } from './model.js';

export const FILE_TAGS = {
  4: [
    { value: 'pre-clinical-study-report', label: 'Pre-clinical study report' },
    { value: 'data-tabulation-dataset-send', label: 'Data tabulation dataset (SEND)' },
    { value: 'publication-based-on-study', label: 'Publication based on study' },
  ],
  5: [
    { value: 'study-report', label: 'Study report (complete report in this file)' },
    { value: 'legacy-clinical-study-report', label: 'Legacy clinical study report' },
    { value: 'synopsis', label: 'Synopsis' },
    { value: 'protocol-or-amendment', label: 'Protocol or amendment' },
    { value: 'statistical-methods-interim-analysis-plan', label: 'Statistical methods / analysis plan' },
    { value: 'case-report-forms', label: 'Case report forms' },
    { value: 'publications-based-on-study', label: 'Publications based on study' },
  ],
};
export const DEFAULT_TAG = { 4: 'pre-clinical-study-report', 5: 'study-report' };

export const needsStudyTag = (code) => /^4\.2\./.test(code) || /^5\.3\./.test(code);
export const moduleOf = (code) => Number(String(code).split('.')[0]);

export function suggestedStudy(doc) {
  if (!doc) return null;
  if (doc.study) return doc.study;
  const m = /\b(HR[NP]-\d{3,4})\b/.exec(doc.title ?? '');
  return m ? m[1] : null;
}

export function suggestedTag(leaf) {
  return { id: null, tag: DEFAULT_TAG[moduleOf(leaf.nodeCode)] ?? 'study-report' };
}

export function tagFromDoc(project, leaf) {
  const doc = docForLeaf(project, leaf);
  const id = suggestedStudy(doc);
  if (!id || !needsStudyTag(leaf.nodeCode)) return null;
  return { id, tag: DEFAULT_TAG[moduleOf(leaf.nodeCode)] };
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Groups this sequence's tagged leaves into study tagging files.
export function studyFiles(project, seq) {
  const groups = new Map();
  for (const l of seq.leaves) {
    if (l.operation === 'delete' || !l.study?.id || !needsStudyTag(l.nodeCode)) continue;
    const key = `${l.nodeCode}|${l.study.id}`;
    if (!groups.has(key)) groups.set(key, { nodeCode: l.nodeCode, studyId: l.study.id, leaves: [] });
    groups.get(key).leaves.push(l);
  }
  return [...groups.values()].map((g) => {
    const folder = folderPath(g.nodeCode, project.settings);
    const fileName = `stf-${slug(g.studyId, 40)}.xml`;
    const depth = folder.split('/').length;
    const back = '../'.repeat(depth);
    const firstDoc = docForLeaf(project, g.leaves[0]);
    const title = (firstDoc?.title ?? g.studyId).replace(/^Study [^:]+:\s*/, '');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- TRAINING ONLY: fictional study tagging file modelled on the public ICH STF v2.2 specification. Not for submission. -->
<!DOCTYPE ectd:study SYSTEM "${back}util/dtd/ich-stf-v2-2.dtd">
<ectd:study xmlns:ectd="http://www.ich.org/ectd" xmlns:xlink="http://www.w3c.org/1999/xlink" xml:lang="en" dtd-version="2.2">
  <study-identifier>
    <title>${esc(title)}</title>
    <study-id>${esc(g.studyId)}</study-id>
  </study-identifier>
  <study-document>
${g.leaves.map((l) => `    <doc-content xlink:href="${back}index.xml#${esc(l.id)}">
      <file-tag name="${esc(l.study.tag)}" info-type="ich"/>
    </doc-content>`).join('\n')}
  </study-document>
</ectd:study>
`;
    return {
      id: `STF-${slug(g.nodeCode.replace(/\./g, '-'))}-${slug(g.studyId)}`.replace(/-+/g, '-'),
      nodeCode: g.nodeCode,
      studyId: g.studyId,
      fileName,
      path: `${folder}/${fileName}`,
      title: `Study tagging file: ${g.studyId}`,
      xml,
      leafIds: g.leaves.map((l) => l.id),
    };
  });
}

export function isValidTag(code, tag) {
  return (FILE_TAGS[moduleOf(code)] ?? []).some((t) => t.value === tag);
}

export const nodeLabel = (code) => `${code} ${INDEX.map[code]?.title ?? ''}`;
