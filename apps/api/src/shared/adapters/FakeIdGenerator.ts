import { IdGeneratorPort } from '../ports/IdGeneratorPort';

export class FakeIdGenerator implements IdGeneratorPort {
  private nextIds: string[] = [];
  private counter = 1;

  generate(): string {
    if (this.nextIds.length > 0) {
      return this.nextIds.shift()!;
    }
    return `fake-id-${this.counter++}`;
  }

  setNextId(id: string): void {
    this.nextIds.push(id);
  }

  setNextIds(ids: string[]): void {
    this.nextIds.push(...ids);
  }
}
