export class TowerConfigError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`Invalid tower config: ${problems.join('; ')}`)
    this.name = 'TowerConfigError'
    this.problems = problems
  }
}

export class GcodeInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GcodeInputError'
  }
}
