export type ProviderId = 'azure' | 'aws' | 'gcp';

export type ServiceCategory =
  | 'compute'
  | 'containers'
  | 'serverless'
  | 'database'
  | 'storage'
  | 'cache'
  | 'messaging'
  | 'networking'
  | 'identity'
  | 'security'
  | 'integration'
  | 'analytics'
  | 'monitoring';

export interface ServiceEntry {
  /** Stable id, `<provider>.<slug>`, stored in model inferences. Never renamed once released. */
  id: string;
  provider: ProviderId;
  /** The provider's official product name. */
  name: string;
  category: ServiceCategory;
  /**
   * Phrases that name this service unambiguously when they are the whole label or a whole-word
   * part of it. Lower case. Never generic words like "database" or "queue".
   */
  aliases: readonly string[];
  /** Official documentation or product page. */
  docsUrl: string;
}

/** A label that names a kind of thing without naming a vendor product. */
export interface GenericTerm {
  category: ServiceCategory | 'actor' | 'api' | 'external';
  terms: readonly string[];
}
