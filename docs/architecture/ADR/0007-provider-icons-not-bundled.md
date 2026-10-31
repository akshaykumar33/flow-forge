# ADR-0007: do not bundle official cloud icons; load the user's own icon packs

Status: accepted, 2026-10-25.

## Context

The brief asks for official Azure, AWS and Google Cloud icons, but only where licensing permits.
Checked on 2026-10-25:

- **Azure** ([Azure icons](https://learn.microsoft.com/en-us/azure/architecture/icons/), set V24,
  July 2026): "Microsoft permits the use of these icons in architectural diagrams, training
  materials, or documentation. You can copy, distribute, and display the icons only for the
  permitted use unless granted explicit permission by Microsoft." Also: do not crop, flip, rotate
  or distort.
- **AWS** ([AWS Architecture Icons](https://aws.amazon.com/architecture/icons/), package dated
  2026-07-31): customers and partners may "use these toolkits and assets to create architecture
  diagrams". Nothing about redistributing the files inside software.
- **Google Cloud** ([Google Cloud icons](https://cloud.google.com/icons)): product icons may be
  used to accurately reference Google technology, for instance in architecture diagrams, under
  Google's brand guidelines.

All three allow the icons in the diagrams FlowForge produces. None clearly allows shipping the
icon files inside a redistributed npm package or web app bundle.

## Decision

1. FlowForge packages contain **no official provider icons**.
2. `@flowforge/providers` ships only data: service ids, names, categories, aliases and
   documentation links. That is factual reference to the services, not their artwork.
3. Users download each provider's official pack themselves, accepting its terms, and point
   FlowForge at it (CLI flag now, file upload in the web editor later). FlowForge indexes the pack
   locally and embeds the matching icons into the diagrams it renders, which is the permitted use.
4. Without a pack, recognised services render with FlowForge's own generic category shapes and
   the service name. Nothing is drawn to imitate a provider logo.
5. Icons are embedded as `<image>` data URIs, never inlined as SVG markup. Browsers render SVG
   images in secure static mode, without scripts or external loads, so a tampered pack cannot
   inject active content into an exported diagram.

## Consequences

- Risk R2 is closed by design rather than accepted.
- Users need one extra setup step per provider; the docs must make it short.
- Icons are scaled uniformly and never cropped, flipped or rotated, per Azure's guidelines.
