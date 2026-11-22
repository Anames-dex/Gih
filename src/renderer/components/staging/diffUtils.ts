import type { DiffLine, DiffHunk } from '@/shared/types'

export interface WordDiffToken {
  text: string
  isChanged: boolean
}

/**
 * Tokenizes text into alphanumeric words, punctuation, and whitespace chunks.
 */
function tokenize(str: string): string[] {
  return str.match(/[\w]+|[^\w\s]+|\s+/g) || []
}

/**
 * Computes word-level/token-level differences between an old and new line of text using LCS.
 */
export function computeWordDiff(
  oldStr: string,
  newStr: string
): { oldTokens: WordDiffToken[]; newTokens: WordDiffToken[] } {
  const oldList = tokenize(oldStr)
  const newList = tokenize(newStr)

  const m = oldList.length
  const n = newList.length

  if (m === 0) {
    return {
      oldTokens: [],
      newTokens: newList.map((t) => ({ text: t, isChanged: true })),
    }
  }

  if (n === 0) {
    return {
      oldTokens: oldList.map((t) => ({ text: t, isChanged: true })),
      newTokens: [],
    }
  }

  // Guard against pathological line lengths (e.g. single-line minified files)
  if (m * n > 40000) {
    return {
      oldTokens: [{ text: oldStr, isChanged: true }],
      newTokens: [{ text: newStr, isChanged: true }],
    }
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldList[i] === newList[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const oldChanged = new Array(m).fill(false)
  const newChanged = new Array(n).fill(false)

  let i = m
  let j = n

  while (i > 0 && j > 0) {
    if (oldList[i - 1] === newList[j - 1]) {
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      oldChanged[i - 1] = true
      i--
    } else {
      newChanged[j - 1] = true
      j--
    }
  }

  while (i > 0) {
    oldChanged[i - 1] = true
    i--
  }

  while (j > 0) {
    newChanged[j - 1] = true
    j--
  }

  return {
    oldTokens: oldList.map((t, idx) => ({ text: t, isChanged: oldChanged[idx] })),
    newTokens: newList.map((t, idx) => ({ text: t, isChanged: newChanged[idx] })),
  }
}

export interface SplitDiffRow {
  left?: {
    line: DiffLine
    tokens?: WordDiffToken[]
  }
  right?: {
    line: DiffLine
    tokens?: WordDiffToken[]
  }
}

/**
 * Builds side-by-side (split) rows from hunk lines, pairing modifications across left & right columns.
 */
export function buildSplitRows(lines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.type === 'context') {
      rows.push({
        left: { line },
        right: { line },
      })
      i++
      continue
    }

    const deletes: DiffLine[] = []
    while (i < lines.length && lines[i].type === 'delete') {
      deletes.push(lines[i])
      i++
    }

    const adds: DiffLine[] = []
    while (i < lines.length && lines[i].type === 'add') {
      adds.push(lines[i])
      i++
    }

    const count = Math.max(deletes.length, adds.length)
    for (let k = 0; k < count; k++) {
      const delLine = deletes[k]
      const addLine = adds[k]

      let leftTokens: WordDiffToken[] | undefined
      let rightTokens: WordDiffToken[] | undefined

      if (delLine && addLine) {
        const wordDiff = computeWordDiff(delLine.content, addLine.content)
        leftTokens = wordDiff.oldTokens
        rightTokens = wordDiff.newTokens
      }

      rows.push({
        left: delLine ? { line: delLine, tokens: leftTokens } : undefined,
        right: addLine ? { line: addLine, tokens: rightTokens } : undefined,
      })
    }
  }

  return rows
}

export interface UnifiedLineWithTokens {
  line: DiffLine
  tokens?: WordDiffToken[]
}

/**
 * Pre-computes word tokens for unified view paired lines.
 */
export function buildUnifiedRows(lines: DiffLine[]): UnifiedLineWithTokens[] {
  const result: UnifiedLineWithTokens[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.type === 'context') {
      result.push({ line })
      i++
      continue
    }

    const deletes: DiffLine[] = []
    while (i < lines.length && lines[i].type === 'delete') {
      deletes.push(lines[i])
      i++
    }

    const adds: DiffLine[] = []
    while (i < lines.length && lines[i].type === 'add') {
      adds.push(lines[i])
      i++
    }

    // Pair up matching indices
    const minCount = Math.min(deletes.length, adds.length)

    for (let k = 0; k < deletes.length; k++) {
      const del = deletes[k]
      if (k < minCount) {
        const diff = computeWordDiff(del.content, adds[k].content)
        result.push({ line: del, tokens: diff.oldTokens })
      } else {
        result.push({ line: del })
      }
    }

    for (let k = 0; k < adds.length; k++) {
      const add = adds[k]
      if (k < minCount) {
        const diff = computeWordDiff(deletes[k].content, add.content)
        result.push({ line: add, tokens: diff.newTokens })
      } else {
        result.push({ line: add })
      }
    }
  }

  return result
}

/**
 * Constructs a valid patch text for a single hunk.
 */
export function buildHunkPatch(filePath: string, hunk: DiffHunk): string {
  const normPath = filePath.replace(/\\/g, '/')
  if (hunk.rawHunk) {
    return `diff --git a/${normPath} b/${normPath}\n--- a/${normPath}\n+++ b/${normPath}\n${hunk.rawHunk}`
  }
  const linesText = hunk.lines
    .map((l) => (l.type === 'add' ? `+${l.content}` : l.type === 'delete' ? `-${l.content}` : ` ${l.content}`))
    .join('\n')
  return `diff --git a/${normPath} b/${normPath}\n--- a/${normPath}\n+++ b/${normPath}\n${hunk.header}\n${linesText}\n`
}
