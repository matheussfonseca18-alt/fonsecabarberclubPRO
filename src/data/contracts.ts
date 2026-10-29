/** Local preparation only. No authentication, tenant selection or transport. */
export type EntityKind = "clients" | "professionals" | "services" | "products";

export type ClientCreateInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type ProfessionalCreateInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type ServiceCreateInput = {
  name: string;
  priceCents: number;
  durationMinutes: number;
};

export type ProductCreateInput = {
  name: string;
  priceCents: number;
  stockQuantity?: number | null;
};

export type EntityCreateMap = {
  clients: ClientCreateInput;
  professionals: ProfessionalCreateInput;
  services: ServiceCreateInput;
  products: ProductCreateInput;
};

/** Only the future authenticated server may assign these response fields. */
export type ServerIdentity = { id: string; tenantId: string };

export type EntityRecordMap = {
  [K in EntityKind]: EntityCreateMap[K] & ServerIdentity;
};

export type EntityCreateInput<K extends EntityKind> = EntityCreateMap[K];
export type EntityRecord<K extends EntityKind> = EntityRecordMap[K];

export type ConnectionStatus = { state: "disconnected"; reason: string };

export type QueryResult<T> =
  | { state: "unavailable"; reason: string }
  | { state: "ready"; records: readonly T[] }
  | { state: "error"; message: string; code?: string };

export type WriteResult<T> =
  | { state: "unavailable"; reason: string }
  | { state: "saved"; record: T }
  | { state: "error"; message: string; code?: string };

export interface DataAdapter {
  status(): Promise<ConnectionStatus>;
  list<K extends EntityKind>(kind: K): Promise<QueryResult<EntityRecord<K>>>;
  create<K extends EntityKind>(
    kind: K,
    input: EntityCreateInput<K>,
  ): Promise<WriteResult<EntityRecord<K>>>;
}

export type ValidationResult<T> =
  | { valid: true; errors: Record<string, string>; value: T }
  | { valid: false; errors: Record<string, string>; value?: never };
