import { titleCaseOptional, toTitleCase } from './title-case'

describe('title-case normalization', () => {
  it('normalizes human-readable strings and whitespace', () => {
    expect(toTitleCase('  NEW   DELHI ')).toBe('New Delhi')
    expect(toTitleCase('gaurav chaddha')).toBe('Gaurav Chaddha')
    expect(toTitleCase("o'connor-road")).toBe("O'Connor-Road")
  })

  it('preserves null and undefined optional values', () => {
    expect(titleCaseOptional(null)).toBeNull()
    expect(titleCaseOptional(undefined)).toBeUndefined()
  })
})
