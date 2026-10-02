import { randomUUID } from 'node:crypto';
import { IdGeneratorPort } from '../ports/IdGeneratorPort';

export class UUIDGenerator implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
