import { ClockPort } from '../ports/ClockPort';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
