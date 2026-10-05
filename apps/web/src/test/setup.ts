import '@testing-library/jest-dom';
global.IDBTransaction = class {};


// Stub env vars globally
process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-key';

// Mock indexedDB for offline session
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn().mockResolvedValue([]),
} as any;

// Mock IDBRequest and IDBOpenDBRequest for idb library
global.IDBRequest = class {};
global.IDBOpenDBRequest = class extends global.IDBRequest {};
