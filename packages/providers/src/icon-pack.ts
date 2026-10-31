import type { GraphModel } from '@flowforge/core';
import { SERVICES } from './registry.js';
import type { ProviderId, ServiceEntry } from './types.js';

/** One file from a provider's official icon pack, as the caller read it. */
export interface IconFile {
  /** Path inside the pack, used only for matching and ranking. */
  path: string;
  svg: string;
}

/** Service id → SVG source, built from the user's own downloaded pack (ADR-0007). */
export type IconIndex = ReadonlyMap<string, string>;

export interface IconPackReport {
  index: IconIndex;
  /** Registry services of this provider the pack has no icon for. */
  missing: string[];
}

/**
 * Reduces an icon file name to the words of the product it depicts, removing each provider's
 * packaging conventions:
 * - Azure: `10130-icon-service-SQL-Database.svg`
 * - AWS: `Arch_Amazon-DynamoDB_64.svg`, `Res_Amazon-DynamoDB_Table_48.svg`
 * - Google Cloud: `Cloud-Run.svg`, `cloud_run.svg`
 */
export function iconFileWords(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? '';
  return file
    .replace(/\.svg$/i, '')
    .replace(/^\d+-icon-service-/i, '')
    .replace(/^(Arch|Res|Arch-Category)_/i, '')
    .replace(/_(16|32|48|64)(_(Light|Dark))?$/i, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Lower is better: prefer service icons over resource icons, and 64 px over smaller sizes. */
function rank(path: string): number {
  const file = path.split(/[\\/]/).pop() ?? '';
  let score = 0;
  if (/^Res_/i.test(file)) score += 10;
  const size = /_(16|32|48|64)(_(Light|Dark))?\.svg$/i.exec(file)?.[1];
  if (size) score += (64 - Number(size)) / 16;
  if (/_Dark\.svg$/i.test(file)) score += 1;
  return score;
}

function namesFor(service: ServiceEntry): Set<string> {
  const strip = (s: string) =>
    s
      .toLowerCase()
      .replace(/^(microsoft|azure|amazon|aws|google cloud|google)\s+/, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const names = new Set<string>();
  for (const n of [service.name, ...service.aliases]) {
    names.add(
      n
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim(),
    );
    names.add(strip(n));
    // Pack files sometimes pluralise the product ("App-Services" for App Service).
    names.add(`${strip(n)}s`);
  }
  return names;
}

/**
 * Matches a provider's pack files to registry services. Deterministic: when several files match
 * one service, the best-ranked wins and ties break by path.
 */
export function indexIconPack(
  provider: ProviderId,
  files: readonly IconFile[],
  services: readonly ServiceEntry[] = SERVICES,
): IconPackReport {
  const byWords = new Map<string, IconFile[]>();
  for (const file of files) {
    const words = iconFileWords(file.path);
    if (words === '') continue;
    byWords.set(words, [...(byWords.get(words) ?? []), file]);
  }
  for (const list of byWords.values()) {
    list.sort((a, b) => rank(a.path) - rank(b.path) || (a.path < b.path ? -1 : 1));
  }

  const index = new Map<string, string>();
  const missing: string[] = [];
  for (const service of services.filter((s) => s.provider === provider)) {
    const names = namesFor(service);
    const match = [...names].map((n) => byWords.get(n)?.[0]).find((f) => f !== undefined);
    if (match) index.set(service.id, match.svg);
    else missing.push(service.id);
  }
  return { index, missing };
}

/** Icons for every node whose `service` inference has a matching icon in one of the packs. */
export function iconsForModel(
  model: GraphModel,
  packs: readonly IconIndex[],
): Record<string, string> {
  const icons: Record<string, string> = {};
  for (const node of model.nodes) {
    const service = node.inferences.find((i) => i.key === 'service')?.value;
    if (service === undefined) continue;
    const svg = packs.map((p) => p.get(service)).find((s) => s !== undefined);
    if (svg !== undefined) icons[node.id] = svg;
  }
  return icons;
}
