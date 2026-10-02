import { describe, it, expect } from 'vitest';
import { FakeIdGenerator } from './FakeIdGenerator';

describe('FakeIdGenerator', () => {
  it('should generate sequential fake ids by default', () => {
    const generator = new FakeIdGenerator();

    expect(generator.generate()).toBe('fake-id-1');
    expect(generator.generate()).toBe('fake-id-2');
  });

  it('should return preset next id and then fallback to sequence', () => {
    const generator = new FakeIdGenerator();

    generator.setNextId('custom-id-1');

    expect(generator.generate()).toBe('custom-id-1');
    expect(generator.generate()).toBe('fake-id-1'); // Fallback sequence starts at 1
  });

  it('should return multiple preset next ids', () => {
    const generator = new FakeIdGenerator();

    generator.setNextIds(['custom-id-1', 'custom-id-2']);

    expect(generator.generate()).toBe('custom-id-1');
    expect(generator.generate()).toBe('custom-id-2');
    expect(generator.generate()).toBe('fake-id-1');
  });
});
