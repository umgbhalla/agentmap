// @agentmap:.
// JavaScript language support for agentmap.
// Shares most implementation with TypeScript.

import type { SyntaxNode } from '../types.js'
import {
  extractName as tsExtractName,
  extractConstName as tsExtractConstName,
  isExported as tsIsExported,
  unwrapExport as tsUnwrapExport,
} from './typescript.js'

export const id = 'javascript' as const
export const extensions = ['.js', '.jsx', '.mjs', '.cjs']
export const grammar = 'tree-sitter-javascript/tree-sitter-javascript.wasm'

// AST node types
export const FUNCTION_TYPES = ['function_declaration', 'method_definition']
export const CLASS_TYPES = ['class_declaration']
export const STRUCT_TYPES: string[] = []
export const TRAIT_TYPES: string[] = []
export const INTERFACE_TYPES: string[] = []
export const TYPE_TYPES: string[] = []
export const ENUM_TYPES: string[] = []
export const CONST_TYPES = ['lexical_declaration']

// Reuse TypeScript implementations
export const isExported = tsIsExported
export const unwrapExport = tsUnwrapExport
export const extractName = tsExtractName
export const extractConstName = tsExtractConstName

// Comment handling
export const commentPrefixes = ['//', '/*']
