// One flat index over every heading the app knows: each region's Module 1 tree plus
// the harmonised CTD Modules 2-5. Region Module 1 codes other than the US carry a prefix
// (e.g. "eu:1.3.1") so they never clash; displayCode() strips it for people.
import ctd from '../data/ctd-tree.json' with { type: 'json' };
import usM1 from '../data/us-m1.json' with { type: 'json' };
import euM1 from '../data/eu-m1.json' with { type: 'json' };
import jpM1 from '../data/jp-m1.json' with { type: 'json' };
import inM1 from '../data/in-m1.json' with { type: 'json' };
import caM1 from '../data/ca-m1.json' with { type: 'json' };
import chM1 from '../data/ch-m1.json' with { type: 'json' };

export const REGION_PACKS = { US: usM1, EU: euM1, JP: jpM1, IN: inM1, CA: caM1, CH: chM1 };
export const M1_ROOT = { US: '1', EU: 'eu:1', JP: 'jp:1', IN: 'in:1', CA: 'ca:1', CH: 'ch:1' };
export const REGION_LABEL = { US: 'US', EU: 'EU', JP: 'Japan', IN: 'India', CA: 'Canada', CH: 'Switzerland' };
export const REGIONS = Object.keys(REGION_PACKS);

function indexTree(root, out, parent, module, region) {
  const node = {
    code: root.code,
    display: root.display ?? root.code,
    title: root.title,
    titleJa: root.titleJa ?? null,
    cou: root.cou ?? null,
    element: root.element ?? null,
    folder: root.folder ?? null,
    country: root.country ?? null,
    repeat: root.repeat ?? null,
    notInEctd: !!root.notInEctd,
    note: root.note ?? null,
    help: root.help ?? null,
    parent: parent ? parent.code : null,
    module,
    region,
    isM1: module === '1',
    children: [],
  };
  out.map[node.code] = node;
  out.order.push(node.code);
  if (parent) parent.children.push(node.code);
  for (const c of root.children ?? []) indexTree(c, out, node, module, region);
  return node;
}

function buildIndex() {
  const out = { map: {}, order: [], roots: [] };
  for (const r of REGIONS) out.roots.push(indexTree(REGION_PACKS[r].tree, out, null, '1', r).code);
  for (const mod of ctd.modules) out.roots.push(indexTree(mod, out, null, mod.code, null).code);
  return out;
}

export const INDEX = buildIndex();

export const nodeOf = (code) => INDEX.map[code];
export const displayCode = (code) => INDEX.map[code]?.display ?? String(code ?? '').replace(/^(eu|jp|in|ca|ch):/, '');
export const nodeLabel = (code) => `${displayCode(code)} ${INDEX.map[code]?.title ?? ''}`.trim();
export const rootsFor = (region) => [M1_ROOT[region] ?? '1', '2', '3', '4', '5'];
export const inRegion = (code, region) => {
  const n = INDEX.map[code];
  return !!n && (!n.isM1 || n.region === region);
};
export const isPlaceable = (code) => {
  const n = INDEX.map[code];
  return !!n && n.children.length === 0;
};

export function ancestors(code) {
  const list = [];
  let n = INDEX.map[code];
  while (n) {
    list.unshift(n);
    n = n.parent ? INDEX.map[n.parent] : null;
  }
  return list;
}

export function slug(s, max = 40) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

// Folder name for a repeatable node instance, from project settings.
export function repeatFolder(kind, settings) {
  if (kind === 'substance') return slug(`${settings.substance?.name}-${settings.substance?.manufacturer}`, 50) || 'substance-1';
  if (kind === 'product') return slug(`${settings.product?.name}-${settings.product?.dosageForm}`, 50) || 'product-1';
  if (kind === 'indication') return slug(settings.indication, 40) || 'indication-1';
  return null;
}

// EU Module 1 country folders: 'ema' in the centralised procedure, the receiving member state
// (or 'common') otherwise. Product information (1.3.1) adds a language folder.
export const EU_LANG = { ema: 'en', common: 'en', nl: 'nl', de: 'de', fr: 'fr', ie: 'en', be: 'nl', es: 'es', it: 'it', se: 'sv', at: 'de', dk: 'da', pl: 'pl', pt: 'pt' };
export function euCountry(node, settings, leaf = null) {
  if (!node?.country) return null;
  if (node.country === 'common') return 'common';
  const proc = settings?.eu?.procedureType ?? 'centralised';
  const cc = leaf?.country ?? (proc === 'centralised' ? 'ema' : 'common');
  if (node.country.includes('/')) return `${cc}/${leaf?.lang ?? EU_LANG[cc] ?? 'en'}`;
  return cc;
}

// Path of a file's folder relative to the sequence folder. The leaf, when given, supplies
// leaf-level attributes: an EU country and language, or an ASMF part (applicant's or restricted).
export function folderPath(code, settings, leaf = null) {
  const n = INDEX.map[code];
  if (!n) return null;
  if (n.isM1) {
    const pack = REGION_PACKS[n.region];
    if (n.region === 'CH') {
      const parts = [pack.folder, settings?.ch?.galenicFolder || 'common'];
      for (const a of ancestors(code).slice(1)) if (a.folder) parts.push(a.folder);
      return parts.join('/');
    }
    if (n.region !== 'EU') return pack.folder;
    const parts = [pack.folder];
    for (const a of ancestors(code).slice(1)) if (a.folder) parts.push(a.folder);
    const cc = euCountry(n, settings, leaf);
    if (cc) parts.push(cc);
    return parts.join('/');
  }
  const parts = [];
  for (const a of ancestors(code)) {
    if (a.folder) parts.push(a.folder);
    if (a.repeat && a.repeat !== 'excipient' && a.code !== '2.7.3') {
      const rf = repeatFolder(a.repeat, settings);
      if (rf) parts.push(a.repeat === 'substance' && leaf?.part ? `${rf}-${leaf.part}` : rf);
    }
  }
  return parts.join('/');
}

export function filePath(code, fileName, settings, leaf = null) {
  const folder = folderPath(code, settings, leaf);
  return folder ? `${folder}/${fileName}` : fileName;
}

// All placeable codes under a node (inclusive).
export function placeableUnder(code) {
  const n = INDEX.map[code];
  if (!n) return [];
  if (n.children.length === 0) return [code];
  return n.children.flatMap(placeableUnder);
}
