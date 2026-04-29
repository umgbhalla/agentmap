// @agentmap:.
// Extract project metadata from Cargo.toml files.
// Enables agentmap to understand Rust workspace and crate structure.

import { readFile } from 'fs/promises'
import { parse as parseTOML } from 'smol-toml'
import { join, dirname, basename } from 'path'

export interface CargoManifest {
  packageName?: string
  description?: string
  version?: string
  workspaceMembers?: string[]
  binTargets?: Array<{ name: string; path: string }>
  libPath?: string
  isWorkspace: boolean
  isPackage: boolean
  internalDeps?: Array<{ name: string; path: string }>
}

/**
 * Parse a Cargo.toml file and extract relevant metadata
 */
export async function parseCargoToml(filePath: string): Promise<CargoManifest> {
  const content = await readFile(filePath, 'utf8')
  const toml = parseTOML(content) as Record<string, any>

  const pkg = toml.package as Record<string, any> | undefined
  const workspace = toml.workspace as Record<string, any> | undefined

  const manifest: CargoManifest = {
    isWorkspace: !!workspace,
    isPackage: !!pkg,
  }

  if (pkg) {
    manifest.packageName = pkg.name
    manifest.description = pkg.description
    manifest.version = pkg.version
  }

  if (workspace?.members) {
    manifest.workspaceMembers = workspace.members as string[]
  }

  // Parse [[bin]] targets
  const bins = toml.bin as Array<Record<string, any>> | undefined
  if (bins && Array.isArray(bins)) {
    manifest.binTargets = bins
      .filter(b => b.name && b.path)
      .map(b => ({ name: b.name as string, path: b.path as string }))
  }

  // Parse [lib] path
  const lib = toml.lib as Record<string, any> | undefined
  if (lib?.path) {
    manifest.libPath = lib.path as string
  }

  // Extract internal (path) dependencies
  const internalDeps: Array<{ name: string; path: string }> = []
  for (const section of ['dependencies', 'dev-dependencies', 'build-dependencies']) {
    const deps = toml[section] as Record<string, any> | undefined
    if (!deps) continue
    for (const [name, value] of Object.entries(deps)) {
      if (typeof value === 'object' && value !== null && 'path' in value) {
        internalDeps.push({ name, path: value.path as string })
      }
    }
  }
  if (internalDeps.length > 0) {
    manifest.internalDeps = internalDeps
  }

  return manifest
}

/**
 * Generate a human-readable description for a Cargo.toml
 */
export function getCargoDescription(manifest: CargoManifest): string {
  const parts: string[] = []

  if (manifest.isWorkspace && manifest.workspaceMembers) {
    const members = manifest.workspaceMembers.join(', ')
    parts.push(`Cargo workspace: ${members}`)
  }

  if (manifest.isPackage && manifest.packageName) {
    let pkg = manifest.packageName
    if (manifest.version) pkg += ` v${manifest.version}`
    if (manifest.binTargets?.length) {
      const bins = manifest.binTargets.map(b => b.name).join(', ')
      pkg += ` (bin: ${bins})`
    }
    parts.push(pkg)
    if (manifest.description) {
      parts.push(manifest.description)
    }
  }

  if (manifest.internalDeps?.length) {
    const deps = manifest.internalDeps.map(d => d.name).join(', ')
    parts.push(`depends on: ${deps}`)
  }

  return parts.join('. ').replace(/\.\./g, '.')
}

/**
 * Get crate entry point files relative to the crate directory
 */
export function getCrateEntryPoints(manifest: CargoManifest): string[] {
  const entries: string[] = []

  if (manifest.binTargets?.length) {
    for (const bin of manifest.binTargets) {
      entries.push(bin.path)
    }
  } else if (manifest.isPackage) {
    // default binary entry point
    entries.push('src/main.rs')
  }

  if (manifest.libPath) {
    entries.push(manifest.libPath)
  } else if (manifest.isPackage) {
    entries.push('src/lib.rs')
  }

  return entries
}

/**
 * Check if a relative path is a Rust entry point (main.rs, lib.rs) or module file (mod.rs)
 */
export function isRustStructuralFile(relativePath: string): boolean {
  const name = basename(relativePath)
  return name === 'main.rs' || name === 'lib.rs' || name === 'mod.rs'
}
