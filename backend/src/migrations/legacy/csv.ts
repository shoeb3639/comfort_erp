export function parseCsv(source: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') quoted = false
      else value += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      record.push(value)
      value = ''
    } else if (character === '\n') {
      record.push(value.replace(/\r$/, ''))
      records.push(record)
      record = []
      value = ''
    } else value += character
  }

  if (value || record.length) {
    record.push(value.replace(/\r$/, ''))
    records.push(record)
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field')
  return records
}

export function toCsv(
  rows: Array<Array<string | number | boolean | null | undefined>>,
) {
  return `${rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')}\n`
}

export function clean(value: string | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ')
}
