// @agentmap:.
// Zig language support for agentmap.

import type { SyntaxNode, DefinitionType } from '../types.js'

export const id = 'zig' as const
export const extensions = ['.zig']
export const grammar = '@tree-sitter-grammars/tree-sitter-zig/tree-sitter-zig.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_declaration', 'test_declaration']
export const CLASS_TYPES: string[] = []  // Zig has structs/unions, not classes
export const STRUCT_TYPES: string[] = []  // Handled via variable_declaration with struct value
export const TRAIT_TYPES: string[] = []
export const INTERFACE_TYPES: string[] = []
export const TYPE_TYPES: string[] = []
export const ENUM_TYPES: string[] = []  // Handled via variable_declaration with enum value
export const CONST_TYPES = ['variable_declaration']

/**
 * Check if a Zig node has 'pub' modifier
 */
export function isExported(node: SyntaxNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'pub') return true
    if (child?.type === 'identifier' || child?.type === 'block') break
  }
  return false
}

/**
 * Check if a Zig variable_declaration uses 'const' (not 'var')
 */
export function isConst(node: SyntaxNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'const') return true
    if (child?.type === 'var') return false
  }
  return false
}

/**
 * Check if a Zig variable_declaration contains a struct/enum/union declaration
 */
export function getTypeDeclaration(node: SyntaxNode): DefinitionType | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'struct_declaration') return 'struct'
    if (child?.type === 'union_declaration') return 'union'
    if (child?.type === 'enum_declaration') return 'enum'
  }
  return null
}

/**
 * Check if a Zig function has 'extern' modifier
 */
export function isExtern(node: SyntaxNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'extern') return true
    if (child?.type === 'block' || child?.type === 'fn') break
  }
  return false
}

/**
 * Extract name from a Zig node
 */
export function extractName(node: SyntaxNode): string | null {
  if (node.type === 'test_declaration') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'string') {
        const text = child.text
        if (text.startsWith('"') && text.endsWith('"')) {
          return text.slice(1, -1)
        }
        return text
      }
      if (child?.type === 'identifier') {
        return child.text
      }
    }
    return null
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'identifier') {
      return child.text
    }
  }
  return null
}

/**
 * Extract name from const/var declaration
 */
export function extractConstName(node: SyntaxNode): string | null {
  return extractName(node)
}

// Comment handling
export const commentPrefixes = ['//', '/*']
