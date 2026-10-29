import {
  createCatalogReader,
  type CatalogReadConfig,
  type CatalogSession,
} from "./catalog-read.ts";
import { authSessionSource } from "../auth/session.ts";

/** An access proposal is not activation. No target, key, user or token is configured. */
export const catalogReadActivation: CatalogReadConfig = Object.freeze({
  enabled: false,
});

export interface CatalogSessionSource {
  getSession(): Promise<CatalogSession | null>;
  subscribe(onChange: () => void): () => void;
}

// Login supplies only a passive document-local snapshot. Catalog activation
// still requires the approved verified UID and remote permission checks.
export const catalogSessionSource: CatalogSessionSource = authSessionSource;

export const catalogReader = createCatalogReader(catalogReadActivation, {
  getSession: () => catalogSessionSource.getSession(),
});
