export class FakeClock {
  private currentEpochMs: number;

  constructor(initialIsoString: string = '2026-11-04T12:00:00.000Z') {
    this.currentEpochMs = new Date(initialIsoString).getTime();
  }

  public now(): Date {
    return new Date(this.currentEpochMs);
  }

  public nowIso(): string {
    return this.now().toISOString();
  }

  public advanceByMs(ms: number): void {
    this.currentEpochMs += ms;
  }

  public advanceBySeconds(seconds: number): void {
    this.advanceByMs(seconds * 1000);
  }

  public setTime(isoString: string): void {
    this.currentEpochMs = new Date(isoString).getTime();
  }
}
