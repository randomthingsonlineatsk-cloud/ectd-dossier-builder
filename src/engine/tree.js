// Builds a flat index over the CTD Modules 2-5 tree and the regional Module 1 tree.
import ctd from '../data/ctd-tree.json' with { type: 'json' };
import usM1 from '../data/us-m1.json' with { type: 'json' };

export const REGION_PACKS = { US: usM1 };

function indexTree(root, out, parent = null, module = null, isM1 = false) {
  const node = {
    code: root.code,
    title: root.title,
    element: root.element ?? null,
    folder: root.folder ?? null,
    repeat: root.repeat ?? null,
    notInEctd: !!root.notInEctd,
    note: root.note ?? null,
    help: root.help ?? null,
    parent: parent ? parent.code : null,
    module: module ?? root.code,
    isM1,
    children: [],
  };
  out.map[node.code] = node;
  out.order.push(node.code);
  if (parent) parent.children.push(node.code);
  for (const c of root.children ?? []) indexTree(c, out, node, module ?? root.code, isM1);
  return node;
}

export function buildIndex(region = 'US') {
  const out = { map: {}, order: [], roots: [] };
  const pack = REGION_PACKS[region];
  const m1 = indexTree(pack.tree, out, null, '1', true);
  out.roots.push(m1.code);
  for (const mod of ctd.modules) {
    const n = indexTree(mod, out, null, mod.code, false);
    out.roots.push(n.code);
  }
  return out;
}

export const INDEX = buildIndex('US');

export const nodeOf = (code) => INDEX.map[code];
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

// Path of a file relative to the sequence folder, e.g. m3/32-body-data/32p-drug-prod/ostrevia-tablet/32p5-contr-drug-prod/32p51-spec/specifications.pdf
export function folderPath(code, settings) {
  const n = INDEX.map[code];
  if (!n) return null;
  if (n.isM1) return REGION_PACKS.US.folder;
  const parts = [];
  for (const a of ancestors(code)) {
    if (a.folder) parts.push(a.folder);
    if (a.repeat && a.repeat !== 'excipient' && a.code !== '2.7.3') {
      const rf = repeatFolder(a.repeat, settings);
      if (rf) parts.push(rf);
    }
  }
  return parts.join('/');
}

export function filePath(code, fileName, settings) {
  const folder = folderPath(code, settings);
  return folder ? `${folder}/${fileName}` : fileName;
}

// All placeable codes under a node (inclusive).
export function placeableUnder(code) {
  const n = INDEX.map[code];
  if (!n) return [];
  if (n.children.length === 0) return [code];
  return n.children.flatMap(placeableUnder);
}
