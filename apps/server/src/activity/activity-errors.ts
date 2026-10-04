export class ActivityError extends Error {
  constructor(
    readonly code:
      | "ACTIVITY_INVALID_EVENT"
      | "ACTIVITY_WRITE_FAILED"
      | "ACTIVITY_CAP_REACHED"
      | "ACTIVITY_CLOSED",
  ) {
    super(code);
  }
}
