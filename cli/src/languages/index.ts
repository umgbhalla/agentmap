// @agentmap:.
// Language registry for agentmap.
// Aggregates all language-specific implementations.

import type { Language, SyntaxNode, DefinitionType } from '../types.js'

import * as typescript from './typescript.js'
import * as javascript from './javascript.js'
import * as python from './python.js'
import * as rust from './rust.js'
import * as go from './go.js'
import * as zig from './zig.js'
import * as cpp from './cpp.js'

// Re-export language modules for direct access
export { typescript, javascript, python, rust, go, zig, cpp }

/**
 * All registered languages
 */
export const languages = {
  typescript,
  javascript,
  python,
  rust,
  go,
  zig,
  cpp,
} as const

/**
 * File extension to language mapping
 */
export const LANGUAGE_EXTENSIONS: Record<string, Language> = {
  ...Object.fromEntries(typescript.extensions.map(e => [e, 'typescript' as const])),
  ...Object.fromEntries(javascript.extensions.map(e => [e, 'javascript' as const])),
  ...Object.fromEntries(python.extensions.map(e => [e, 'python' as const])),
  ...Object.fromEntries(rust.extensions.map(e => [e, 'rust' as const])),
  ...Object.fromEntries(go.extensions.map(e => [e, 'go' as const])),
  ...Object.fromEntries(zig.extensions.map(e => [e, 'zig' as const])),
  ...Object.fromEntries(cpp.extensions.map(e => [e, 'cpp' as const])),
}

/**
 * Grammar paths per language
 */
export const GRAMMAR_PATHS: Record<Language, string> = {
  typescript: typescript.grammar,
  javascript: javascript.grammar,
  python: python.grammar,
  rust: rust.grammar,
  go: go.grammar,
  zig: zig.grammar,
  cpp: cpp.grammar,
}

/**
 * Node types that represent functions per language
 */
export const FUNCTION_TYPES: Record<Language, string[]> = {
  typescript: typescript.FUNCTION_TYPES,
  javascript: javascript.FUNCTION_TYPES,
  python: python.FUNCTION_TYPES,
  rust: rust.FUNCTION_TYPES,
  go: go.FUNCTION_TYPES,
  zig: zig.FUNCTION_TYPES,
  cpp: cpp.FUNCTION_TYPES,
}

/**
 * Node types that represent classes per language
 */
export const CLASS_TYPES: Record<Language, string[]> = {
  typescript: typescript.CLASS_TYPES,
  javascript: javascript.CLASS_TYPES,
  python: python.CLASS_TYPES,
  rust: rust.CLASS_TYPES,
  go: go.CLASS_TYPES,
  zig: zig.CLASS_TYPES,
  cpp: cpp.CLASS_TYPES,
}

/**
 * Node types that represent structs per language
 */
export const STRUCT_TYPES: Record<Language, string[]> = {
  typescript: typescript.STRUCT_TYPES,
  javascript: javascript.STRUCT_TYPES,
  python: python.STRUCT_TYPES,
  rust: rust.STRUCT_TYPES,
  go: go.STRUCT_TYPES,
  zig: zig.STRUCT_TYPES,
  cpp: cpp.STRUCT_TYPES,
}

/**
 * Node types that represent traits per language
 */
export const TRAIT_TYPES: Record<Language, string[]> = {
  typescript: typescript.TRAIT_TYPES,
  javascript: javascript.TRAIT_TYPES,
  python: python.TRAIT_TYPES,
  rust: rust.TRAIT_TYPES,
  go: go.TRAIT_TYPES,
  zig: zig.TRAIT_TYPES,
  cpp: cpp.TRAIT_TYPES,
}

/**
 * Node types that represent interfaces per language
 */
export const INTERFACE_TYPES: Record<Language, string[]> = {
  typescript: typescript.INTERFACE_TYPES,
  javascript: javascript.INTERFACE_TYPES,
  python: python.INTERFACE_TYPES,
  rust: rust.INTERFACE_TYPES,
  go: go.INTERFACE_TYPES,
  zig: zig.INTERFACE_TYPES,
  cpp: cpp.INTERFACE_TYPES,
}

/**
 * Node types that represent type aliases per language
 */
export const TYPE_TYPES: Record<Language, string[]> = {
  typescript: typescript.TYPE_TYPES,
  javascript: javascript.TYPE_TYPES,
  python: python.TYPE_TYPES,
  rust: rust.TYPE_TYPES,
  go: go.TYPE_TYPES,
  zig: zig.TYPE_TYPES,
  cpp: cpp.TYPE_TYPES,
}

/**
 * Node types that represent enums per language
 */
export const ENUM_TYPES: Record<Language, string[]> = {
  typescript: typescript.ENUM_TYPES,
  javascript: javascript.ENUM_TYPES,
  python: python.ENUM_TYPES,
  rust: rust.ENUM_TYPES,
  go: go.ENUM_TYPES,
  zig: zig.ENUM_TYPES,
  cpp: cpp.ENUM_TYPES,
}

/**
 * Node types that represent constants per language
 */
export const CONST_TYPES: Record<Language, string[]> = {
  typescript: typescript.CONST_TYPES,
  javascript: javascript.CONST_TYPES,
  python: python.CONST_TYPES,
  rust: rust.CONST_TYPES,
  go: go.CONST_TYPES,
  zig: zig.CONST_TYPES,
  cpp: cpp.CONST_TYPES,
}

/**
 * Extract name from a node using language-specific logic
 */
export function extractName(node: SyntaxNode, language: Language): string | null {
  // Try 'name' field first (common across languages)
  const nameNode = node.childForFieldName('name')
  if (nameNode) {
    return nameNode.text
  }

  return languages[language].extractName(node)
}

/**
 * Extract name from a const/let/var declaration
 */
export function extractConstName(node: SyntaxNode, language: Language): string | null {
  const lang = languages[language]
  if ('extractConstName' in lang && typeof lang.extractConstName === 'function') {
    return lang.extractConstName(node)
  }
  return extractName(node, language)
}

/**
 * Check if a node is exported (language-specific)
 */
export function isExported(node: SyntaxNode, language: Language, name?: string): boolean {
  const lang = languages[language]
  // Go uses name-based exports
  if (language === 'go') {
    return (lang as typeof go).isExported(node, name)
  }
  return lang.isExported(node)
}

/**
 * Unwrap export statement to get the actual declaration (TS/JS only)
 */
export function unwrapExport(node: SyntaxNode, language: Language): SyntaxNode {
  if (language === 'typescript' || language === 'javascript') {
    return typescript.unwrapExport(node)
  }
  return node
}

/**
 * Check if a node has extern modifier (Zig/C++ only)
 */
export function isExtern(node: SyntaxNode, language: Language): boolean {
  if (language === 'zig') {
    return zig.isExtern(node)
  }
  if (language === 'cpp') {
    return cpp.isExtern(node)
  }
  return false
}

/**
 * Zig-specific: check if variable_declaration uses 'const'
 */
export function isZigConst(node: SyntaxNode): boolean {
  return zig.isConst(node)
}

/**
 * Zig-specific: get type declaration (struct/enum/union) from variable_declaration
 */
export function getZigTypeDeclaration(node: SyntaxNode): DefinitionType | null {
  return zig.getTypeDeclaration(node)
}
