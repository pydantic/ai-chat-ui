import { z } from 'zod'

const runCodeInputSchema = z
  .object({
    code: z.unknown().transform((value) => (typeof value === 'string' ? value : '')),
    restart: z.unknown().transform((value) => value === true),
  })
  .catch({ code: '', restart: false })

const runCodeOutputSchema = z
  .looseObject({
    output: z.unknown().optional(),
    result: z.unknown().optional(),
  })
  .refine((value) => Object.hasOwn(value, 'output') || Object.hasOwn(value, 'result'))

export type RunCodeResult = z.infer<typeof runCodeOutputSchema>

export function parseRunCodeInput(input: unknown) {
  return runCodeInputSchema.parse(input)
}

export function isRunCodeOutput(output: unknown): output is RunCodeResult {
  return runCodeOutputSchema.safeParse(output).success
}
