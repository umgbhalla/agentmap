// @agentmap:.
// Go language support for agentmap.

import type { SyntaxNode } from '../types.js'

export const id = 'go' as const
export const extensions = ['.go']
export const grammar = 'tree-sitter-go/tree-sitter-go.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_declaration', 'method_declaration']
export const CLASS_TYPES: string[] = []  // Go has structs, not classes
export const STRUCT_TYPES: string[] = []  // Go structs handled via type_declaration
export const TRAIT_TYPES: string[] = []
export const INTERFACE_TYPES: string[] = []  // Go interfaces handled via type_declaration
export const TYPE_TYPES = ['type_declaration']
export const ENUM_TYPES: string[] = []
export const CONST_TYPES = ['const_declaration', 'var_declaration']

/**
 * Check if a Go identifier is exported (starts with uppercase)
 */
export function isExported(_node: SyntaxNode, name?: string): boolean {
  if (!name || name.length === 0) return false
  const firstChar = name.charAt(0)
  return firstChar >= 'A' && firstChar <= 'Z'
}

/**
 * Extract name from a Go node
 */
export function extractName(node: SyntaxNode): string | null {
  if (node.type === 'type_declaration') {
    const spec = findChild(node, 'type_spec')
    if (spec) {
      const nameNode = spec.childForFieldName('name')
      return nameNode?.text ?? null
    }
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'identifier' || child?.type === 'field_identifier') {
      return child.text
    }
  }
  return null
}

/**
 * Extract name from const/var declaration
 */
export function extractConstName(node: SyntaxNode): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'const_spec' || child?.type === 'var_spec') {
      const nameNode = child.childForFieldName('name')
      return nameNode?.text ?? null
    }
  }
  return null
}

function findChild(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === type) return child
  }
  return null
}

// Comment handling
export const commentPrefixes = ['//', '/*']
