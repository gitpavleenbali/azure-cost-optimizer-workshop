import type { Section } from './types';

export const introductionId = 'azure-cost-optimizer-workshop';
export const headingId = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

export function readRoute(pathname: string, hash: string) {
  let anchor = introductionId;
  try { anchor = decodeURIComponent(hash.slice(1)) || introductionId; } catch { anchor = introductionId; }
  const view = pathname === '/facilitator' ? 'admin' : pathname === '/evidence' ? 'submit' : pathname === '/kudos' ? 'wall' : 'guide';
  return { anchor, view };
}

export function sectionForAnchor(sections: Section[], anchor: string) {
  return sections.find(section => section.id === anchor) ?? sections.find(section => section.markdown.split('\n').some(line => /^#{3,6} /.test(line) && headingId(line.replace(/^#+ /, '')) === anchor));
}