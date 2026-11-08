// FORK-ONLY harness shim for the local bundler: the fork's chain clock was warped past the APNTs
// timelock, so shift this process's wall clock by the same offset (TIME_SHIFT_MS). Never used live.
const shift = Number(process.env.TIME_SHIFT_MS || 0);
const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);
class ShiftedDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(realNow() + shift); else super(...args); }
  static now() { return realNow() + shift; }
}
globalThis.Date = ShiftedDate;
