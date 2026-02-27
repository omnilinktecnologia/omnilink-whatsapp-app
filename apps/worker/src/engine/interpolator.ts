import { ExecutionContext } from '@omnilink/shared'

/**
 * Resolves {{path.to.value}} placeholders in a string using the execution context.
 * Supports nested paths: {{contact.name}}, {{variables.score}}, {{last_reply.body}}
 */
export function interpolate(template: string, ctx: ExecutionContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
    const path = rawPath.trim()
    const value = getPath(ctx as unknown as Record<string, unknown>, path)
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined
    return (current as Record<string, unknown>)[key]
  }, obj)
}

/**
 * Evaluates a condition expression like:
 *   "{{last_reply.body}} == '9'"
 *   "{{variables.score}} >= 7"
 *   "{{contact.name}} != ''"
 */
export function evaluateCondition(expression: string, ctx: ExecutionContext): boolean {
  const resolved = interpolate(expression, ctx)

  // Attempt comparison: LHS operator RHS
  const comparisonMatch = resolved.match(/^(.+?)\s*(==|!=|>=|<=|>|<|contains|starts_with)\s*(.+)$/)
  if (comparisonMatch) {
    const [, lhs, op, rhs] = comparisonMatch
    const l = lhs.trim().replace(/^['"]|['"]$/g, '')
    const r = rhs.trim().replace(/^['"]|['"]$/g, '')
    const lNum = parseFloat(l)
    const rNum = parseFloat(r)

    let result: boolean
    switch (op) {
      case '==': result = l === r || (!isNaN(lNum) && !isNaN(rNum) && lNum === rNum); break
      case '!=': result = l !== r; break
      case '>=': result = !isNaN(lNum) && !isNaN(rNum) ? lNum >= rNum : l >= r; break
      case '<=': result = !isNaN(lNum) && !isNaN(rNum) ? lNum <= rNum : l <= r; break
      case '>':  result = !isNaN(lNum) && !isNaN(rNum) ? lNum > rNum  : l > r; break
      case '<':  result = !isNaN(lNum) && !isNaN(rNum) ? lNum < rNum  : l < r; break
      case 'contains':    result = l.includes(r); break
      case 'starts_with': result = l.startsWith(r); break
      default: result = false
    }

    console.log(`[condition] "${expression}" → resolved="${resolved}" | l="${l}" ${op} r="${r}" → ${result}`)
    return result
  }

  // Truthy check fallback
  const truthyResult = resolved !== '' && resolved !== '0' && resolved.toLowerCase() !== 'false'
  console.log(`[condition] "${expression}" → resolved="${resolved}" → truthy=${truthyResult}`)
  return truthyResult
}
