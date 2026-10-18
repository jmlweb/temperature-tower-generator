export type BgcodeErrorCode =
  | 'too-short'
  | 'bad-magic'
  | 'unsupported-version'
  | 'unsupported-checksum'
  | 'unknown-block-type'
  | 'unknown-compression'
  | 'unknown-encoding'
  | 'truncated-block'
  | 'checksum-mismatch'
  | 'size-mismatch'
  | 'heatshrink-backref'
  | 'inflate'
  | 'line-too-long'

/** A `.bgcode` file that cannot be decoded; the code names the first failing check. */
export class BgcodeError extends Error {
  readonly code: BgcodeErrorCode

  constructor(code: BgcodeErrorCode, message: string) {
    super(message)
    this.name = 'BgcodeError'
    this.code = code
  }
}
