// @agentmap:.
// Python language support for agentmap.

import type { SyntaxNode } from '../types.js'

export const id = 'python' as const
export const extensions = ['.py', '.pyi']
export const grammar = 'tree-sitter-python/tree-sitter-python.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_definition']
export const CLASS_TYPES = ['class_definition']
export const STRUCT_TYPES: string[] = []
export const TRAIT_TYPES: string[] = []
export const INTERFACE_TYPES: string[] = []
export const TYPE_TYPES: string[] = []
export const ENUM_TYPES: string[] = []
export const CONST_TYPES: string[] = []  // Python constants handled separately

/**
 * Python doesn't have explicit exports - everything is importable
 */
export function isExported(_node: SyntaxNode): boolean {
  return false
}

/**
 * Extract name from a Python node
 */
export function extractName(node: SyntaxNode): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'identifier') {
      return child.text
    }
  }
  return null
}

// Comment handling
export const commentPrefixes = ['#']
export const docstringType = 'string'  // Python uses docstrings
