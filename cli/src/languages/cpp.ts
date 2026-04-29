// @agentmap:.
// C/C++ language support for agentmap.

import type { SyntaxNode } from '../types.js'

export const id = 'cpp' as const
export const extensions = ['.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx']
export const grammar = 'tree-sitter-cpp/tree-sitter-cpp.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_definition']
export const CLASS_TYPES = ['class_specifier']
export const STRUCT_TYPES = ['struct_specifier']
export const TRAIT_TYPES: string[] = []
export const INTERFACE_TYPES: string[] = []
export const TYPE_TYPES = ['type_definition', 'alias_declaration']
export const ENUM_TYPES = ['enum_specifier']
export const CONST_TYPES = ['declaration']

/**
 * C++ doesn't have module exports in the traditional sense
 */
export function isExported(_node: SyntaxNode): boolean {
  return false
}

/**
 * Check if a C++ node has extern storage class or is in linkage_specification
 */
export function isExtern(node: SyntaxNode): boolean {
  if (node.type === 'declaration' || node.type === 'function_definition') {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'storage_class_specifier' && child.text === 'extern') {
        return true
      }
    }
  }
  return false
}

/**
 * Extract name from a C++ node
 */
export function extractName(node: SyntaxNode): string | null {
  if (node.type === 'function_definition') {
    const declarator = node.childForFieldName('declarator')
    if (declarator) {
      const funcDecl = declarator.type === 'function_declarator' 
        ? declarator 
        : findChild(declarator, 'function_declarator')
      if (funcDecl) {
        const innerDecl = funcDecl.childForFieldName('declarator')
        if (innerDecl?.type === 'identifier') {
          return innerDecl.text
        }
        if (innerDecl?.type === 'qualified_identifier') {
          const name = innerDecl.childForFieldName('name')
          return name?.text ?? null
        }
      }
    }
  }

  if (node.type === 'struct_specifier' || node.type === 'class_specifier' || node.type === 'enum_specifier') {
    const nameNode = node.childForFieldName('name')
    if (nameNode) {
      return nameNode.text
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (child?.type === 'type_identifier') {
        return child.text
      }
    }
  }

  if (node.type === 'type_definition') {
    const declarator = node.childForFieldName('declarator')
    if (declarator?.type === 'type_identifier') {
      return declarator.text
    }
  }

  if (node.type === 'alias_declaration') {
    const nameNode = node.childForFieldName('name')
    return nameNode?.text ?? null
  }

  if (node.type === 'declaration') {
    const declarator = node.childForFieldName('declarator')
    if (declarator) {
      if (declarator.type === 'identifier') {
        return declarator.text
      }
      if (declarator.type === 'init_declarator') {
        const innerDecl = declarator.childForFieldName('declarator')
        if (innerDecl?.type === 'identifier') {
          return innerDecl.text
        }
      }
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
 * Extract name from const declaration
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
export const commentPrefixes = ['//', '/*']
