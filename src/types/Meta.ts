/** Build metadata embedded at bundle time. */
export type Meta = {
  /** Package version */
  version: string;
  /** Build date */
  date: string;
};

/** Default {@link Meta}, populated from build-time defines. */
export const Meta: Meta = {
  version: __APP_VERSION__,
  date: __BUILD_DATE__,
};
