import { vi } from 'vitest';

// Stub env vars globally
process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-key';

// Mock indexedDB for offline session
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn().mockResolvedValue([]),
} as any;
