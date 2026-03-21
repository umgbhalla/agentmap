// @agentmap:.
// Rust language support for agentmap.

import type { SyntaxNode } from '../types.js'

export const id = 'rust' as const
export const extensions = ['.rs']
export const grammar = 'tree-sitter-rust/tree-sitter-rust.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_item']
export const CLASS_TYPES: string[] = []  // Rust has structs/traits, not classes
export const STRUCT_TYPES = ['struct_item']
export const TRAIT_TYPES = ['trait_item']
export const INTERFACE_TYPES: string[] = []  // Rust traits handled in TRAIT_TYPES
export const TYPE_TYPES = ['type_item']
export const ENUM_TYPES = ['enum_item']
export const CONST_TYPES = ['const_item', 'static_item']

/**
 * Check if a Rust node has 'pub' visibility modifier
 */
export function isExported(node: SyntaxNode): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'visibility_modifier') {
      return child.text.startsWith('pub')
    }
    if (child?.type === 'identifier' || child?.type === 'type_identifier') break
  }
  return false
}

/**
 * Extract name from a Rust node
 */
export function extractName(node: SyntaxNode): string | null {
  if (node.type === 'impl_item') {
    const typeNode = node.childForFieldName('type')
    if (typeNode) {
      const ident = typeNode.type === 'type_identifier' 
        ? typeNode 
        : findChild(typeNode, 'type_identifier')
      return ident?.text ?? null
    }
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === 'identifier' || child?.type === 'type_identifier') {
      return child.text
    }
  }
  return null
}

/**
 * Extract name from const/static declaration
 */
export function extractConstName(node: SyntaxNode): string | null {
  return extractName(node)
}

function findChild(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === type) return child
  }
  return null
}

// Comment handling
export const commentPrefixes = ['//', '/*', '//!', '///']
