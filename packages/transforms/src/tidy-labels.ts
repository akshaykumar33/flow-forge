import type { Transform } from './transform.js';

/** Trims labels and collapses runs of whitespace. A clean model comes back unchanged. */
export const tidyLabelsTransform: Transform = {
  id: 'tidy-labels',
  description: 'Trim labels and collapse repeated whitespace.',
  apply(model) {
    const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();
    return {
      model: {
        ...model,
        nodes: model.nodes.map((n) => ({ ...n, label: tidy(n.label) })),
        edges: model.edges.map((e) => ({ ...e, label: tidy(e.label) })),
        groups: model.groups.map((g) => ({ ...g, label: tidy(g.label) })),
      },
    };
  },
};
