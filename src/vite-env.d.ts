/// <reference types="vite/client" />

interface Window {
  __fonsecaAuthReturn?: {
    origin: string;
    pathname: string;
    search: string;
    hash: string;
  };
}
