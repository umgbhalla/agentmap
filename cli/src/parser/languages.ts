// @agentmap:.
// Language detection and grammar loading for tree-sitter.

import Parser from 'web-tree-sitter'
import type { Language } from '../types.js'
import { createRequire } from 'module'
import { LANGUAGE_EXTENSIONS, GRAMMAR_PATHS } from '../languages/index.js'

const require = createRequire(import.meta.url)

// Re-export for backwards compatibility
export { LANGUAGE_EXTENSIONS }

/**
 * Detect language from file path extension
 */
export function detectLanguage(filepath: string): Language | null {
  const ext = filepath.slice(filepath.lastIndexOf('.'))
  return LANGUAGE_EXTENSIONS[ext] ?? null
}

/**
 * Get the WASM grammar path for a language
 */
function getGrammarPath(language: Language): string {
  return require.resolve(GRAMMAR_PATHS[language])
}

/**
 * Cache for loaded grammars
 */
const grammarCache = new Map<Language, Parser.Language>()

/**
 * Ensure Parser is initialized before loading grammars
 */
let parserInitialized = false
async function ensureParserInit(): Promise<void> {
  if (!parserInitialized) {
    await Parser.init()
    parserInitialized = true
  }
}

/**
 * Load a tree-sitter grammar for the given language
 */
export async function loadGrammar(language: Language): Promise<Parser.Language> {
  await ensureParserInit()
  
  const cached = grammarCache.get(language)
  if (cached) return cached

  const path = getGrammarPath(language)
  const grammar = await Parser.Language.load(path)
  grammarCache.set(language, grammar)
  return grammar
}

/**
 * Clear grammar cache (for testing)
 */
export function clearGrammarCache(): void {
  grammarCache.clear()
}
