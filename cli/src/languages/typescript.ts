// @agentmap:.
// TypeScript language support for agentmap.

import type { SyntaxNode } from '../types.js'

export const id = 'typescript' as const
export const extensions = ['.ts', '.tsx', '.mts', '.cts']
export const grammar = 'tree-sitter-typescript/tree-sitter-tsx.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_declaration', 'method_definition']
export const CLASS_TYPES = ['class_declaration', 'abstract_class_declaration']
export const STRUCT_TYPES: string[] = []
export const TRAIT_TYPES: string[] = []
export const INTERFACE_TYPES = ['interface_declaration']
export const TYPE_TYPES = ['type_alias_declaration']
export const ENUM_TYPES = ['enum_declaration']
export const CONST_TYPES = ['lexical_declaration']

/**
 * Check if a node is an export statement
 */
export function isExported(node: SyntaxNode): boolean {
  return node.type === 'export_statement'
}

/**
 * Unwrap export statement to get the actual declaration
 */
export function unwrapExport(node: SyntaxNode): SyntaxNode {
  if (node.type === 'export_statement') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (!child) continue
      if (child.type !== 'export' && !child.type.includes('comment') && child.type !== 'default') {
        return child
      }
    }
  }
  return node
}

/**
 * Extract name from a TypeScript/JavaScript node
 */
export function extractName(node: SyntaxNode): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child) continue
    if (child.type === 'identifier' || child.type === 'type_identifier') {
      return child.text
    }
    if (child.type === 'property_identifier') {
      return child.text
    }
  }
  return null
}

/**
 * Extract name from const/let declaration
 */
export function extractConstName(node: SyntaxNode): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'variable_declarator') {
      const nameNode = child.childForFieldName('name')
      return nameNode?.text ?? null
    }
  }
  return null
}

// Comment handling
export const commentPrefixes = ['//', '/*']
