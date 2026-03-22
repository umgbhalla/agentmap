// @agentmap:.
// Scan directory for files with header comments/docstrings and recurse into submodules.

import { execSync } from 'child_process'
import { realpathSync } from 'fs'
import pLimit from 'p-limit'
import picomatch from 'picomatch'
import { readFile } from 'fs/promises'
import { join, normalize, dirname } from 'path'
import { extractMarkerFromCode, extractMarkdownDescription } from './extract/marker.js'
import { extractDefinitions } from './extract/definitions.js'
import { getAllDiffData, applyDiffToDefinitions } from './extract/git-status.js'
import { getSubmodules, getSubmodulePaths } from './extract/submodules.js'
import { parseCargoToml, getCargoDescription, isRustStructuralFile, type CargoManifest } from './extract/cargo.js'
import { createConsoleLogger } from './logger.js'
import { parseCode, detectLanguage, LANGUAGE_EXTENSIONS } from './parser/index.js'
import type { FileResult, GenerateOptions, FileDiff, FileDiffStats, SubmoduleInfo } from './types.js'
import type { Logger } from './logger.js'

/**
 * Maximum number of files to process (safety limit)
 * If exceeded, returns empty results to avoid scanning huge directories
 */
const MAX_FILES = 5_000_000

/**
 * Supported file extensions (from LANGUAGE_EXTENSIONS)
 */
const SUPPORTED_EXTENSIONS = new Set(Object.keys(LANGUAGE_EXTENSIONS))

/**
 * Check if a file has a supported extension
 */
function isSupportedFile(filepath: string): boolean {
  const ext = filepath.slice(filepath.lastIndexOf('.'))
  return SUPPORTED_EXTENSIONS.has(ext)
}

/**
 * Check if a file is a README file (case-insensitive, with or without .md extension)
 */
function isReadmeFile(filepath: string): boolean {
  const filename = filepath.split(/[/\\]/).pop()?.toLowerCase() ?? ''
  return filename === 'readme.md' || filename === 'readme'
}

/**
 * Get tracked files using git ls-files
 * Only returns files that are tracked by git (committed or staged)
 */
function getGitFiles(dir: string): string[] {
  const maxBuffer = 1024 * 10000000
  try {
    // Get only tracked files
    const stdout = execSync('git ls-files', {
      cwd: dir,
      maxBuffer,
      encoding: 'utf8',
    })

    return stdout
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(normalize)
  } catch {
    return []
  }
}



/**
 * Result of scanning a directory, including both file results and submodule info
 */
export interface ScanResult {
  files: FileResult[]
  submodules: SubmoduleInfo[]
}

interface CrateInfo {
  cargoPath: string
  manifest: CargoManifest
  sourcePrefix: string
  description: string
}

interface ScanRepoOptions {
  repoDir: string
  pathPrefix: string
  includeDiff: boolean
  includeSubmodules: boolean
  logger: Logger
  isIncluded?: (path: string) => boolean
  isIgnored?: (path: string) => boolean
  visitedRepoDirs: Set<string>
}

/**
 * Check if a file is a Cargo.toml
 */
function isCargoToml(filepath: string): boolean {
  return filepath === 'Cargo.toml' || filepath.endsWith('/Cargo.toml') || filepath.endsWith('\\Cargo.toml')
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function joinRelativePath(prefix: string, path: string): string {
  const normalizedPath = normalizeRelativePath(path)
  return prefix ? `${prefix}/${normalizedPath}` : normalizedPath
}

function getCanonicalRepoDir(dir: string): string {
  try {
    return realpathSync(dir)
  } catch {
    return dir
  }
}

/**
 * Build a map of source prefixes to their crate info from Cargo.toml files.
 * Only includes package crates (not workspace-only roots without a [package]).
 */
async function buildCrateMap(cargoFiles: string[], dir: string, pathPrefix: string): Promise<Map<string, CrateInfo>> {
  const crateMap = new Map<string, CrateInfo>()

  for (const cargoPath of cargoFiles) {
    try {
      const fullPath = join(dir, cargoPath)
      const manifest = await parseCargoToml(fullPath)

      if (!manifest.isPackage) continue

      const cargoDir = cargoPath === 'Cargo.toml' ? '' : dirname(cargoPath).replace(/\\/g, '/') + '/'
      const sourcePrefix = joinRelativePath(pathPrefix, cargoDir + 'src/')
      const prefixedCargoPath = joinRelativePath(pathPrefix, cargoPath)

      crateMap.set(sourcePrefix, {
        cargoPath: prefixedCargoPath,
        manifest,
        sourcePrefix,
        description: getCargoDescription(manifest),
      })
    } catch {
      // Skip unparseable Cargo.toml files
    }
  }

  return crateMap
}

/**
 * Find the crate that owns a given file path
 */
function findCrateForFile(relativePath: string, crateMap: Map<string, CrateInfo>): CrateInfo | null {
  const normalized = relativePath.replace(/\\/g, '/')
  for (const [prefix, info] of crateMap) {
    if (normalized.startsWith(prefix)) {
      return info
    }
  }
  return null
}

/**
 * Resolve submap path to absolute path from project root
 *
 * @param submap - Submap from marker (e.g., ".", "..", "src/common")
 * @param relativePath - File's path relative to project root
 * @returns Resolved submap path (e.g., "./" for root, "src/common/")
 */
function resolveSubmap(submap: string | undefined, relativePath: string): string {
  // No submap = root
  if (!submap) {
    return './'
  }

  // Get file's directory
  const fileDir = dirname(relativePath)

  // Relative submap (starts with .)
  if (submap.startsWith('.')) {
    // Resolve relative to file's directory
    const resolved = normalize(join(fileDir, submap))
    // Ensure it doesn't go above project root
    if (resolved.startsWith('..')) {
      return './'
    }
    // Normalize to ./ for root, otherwise add trailing slash
    return resolved === '.' ? './' : resolved + '/'
  }

  // Absolute submap (from project root)
  return submap.endsWith('/') ? submap : submap + '/'
}

function isPathIncluded(
  relativePath: string,
  isIncluded?: (path: string) => boolean,
  isIgnored?: (path: string) => boolean
): boolean {
  if (isIncluded && !isIncluded(relativePath)) {
    return false
  }

  if (isIgnored && isIgnored(relativePath)) {
    return false
  }

  return true
}

async function scanRepo(options: ScanRepoOptions): Promise<ScanResult> {
  const canonicalRepoDir = getCanonicalRepoDir(options.repoDir)
  if (options.visitedRepoDirs.has(canonicalRepoDir)) {
    return { files: [], submodules: [] }
  }
  options.visitedRepoDirs.add(canonicalRepoDir)

  let submodules: SubmoduleInfo[] = []
  const directSubmodules = options.includeSubmodules ? getSubmodules(options.repoDir) : []
  const directSubmodulePathSet = options.includeSubmodules
    ? new Set(directSubmodules.map(submodule => submodule.path))
    : getSubmodulePaths(options.repoDir)

  if (options.includeSubmodules) {
    submodules = directSubmodules.map(submodule => ({
      ...submodule,
      path: joinRelativePath(options.pathPrefix, submodule.path),
    }))
  }

  const normalizedSubmodulePaths = new Set<string>()
  for (const path of directSubmodulePathSet) {
    normalizedSubmodulePaths.add(normalize(path))
  }

  let files = getGitFiles(options.repoDir)
  files = files.filter(file => !normalizedSubmodulePaths.has(file))

  const cargoTomlFiles = files.filter(file => {
    const relativePath = joinRelativePath(options.pathPrefix, file)
    return isCargoToml(file) && isPathIncluded(relativePath, options.isIncluded, options.isIgnored)
  })

  files = files.filter(file => isSupportedFile(file) || isReadmeFile(file))
  files = files.filter(file => {
    const relativePath = joinRelativePath(options.pathPrefix, file)
    return isPathIncluded(relativePath, options.isIncluded, options.isIgnored)
  })

  if (files.length > MAX_FILES) {
    options.logger.warn(`Warning: Too many files (${files.length} > ${MAX_FILES}), skipping scan`)
    return { files: [], submodules }
  }

  const crateMap = await buildCrateMap(cargoTomlFiles, options.repoDir, options.pathPrefix)

  let fileStats: Map<string, FileDiffStats> | null = null
  let fileDiffs: Map<string, FileDiff> | null = null

  if (options.includeDiff) {
    try {
      const diffData = getAllDiffData(options.repoDir, directSubmodulePathSet, options.logger)
      fileStats = diffData.fileStats
      fileDiffs = diffData.fileDiffs
    } catch {
      fileStats = null
      fileDiffs = null
    }
  }

  const cargoResults: FileResult[] = []
  for (const cargoPath of cargoTomlFiles) {
    const prefixedCargoPath = joinRelativePath(options.pathPrefix, cargoPath)
    const crate = [...crateMap.values()].find(c => c.cargoPath === prefixedCargoPath)

    if (crate) {
      cargoResults.push({
        relativePath: prefixedCargoPath,
        description: crate.description,
        definitions: [],
        submap: resolveSubmap(undefined, prefixedCargoPath),
      })
    } else {
      try {
        const manifest = await parseCargoToml(join(options.repoDir, cargoPath))
        if (manifest.isWorkspace) {
          cargoResults.push({
            relativePath: prefixedCargoPath,
            description: getCargoDescription(manifest),
            definitions: [],
            submap: resolveSubmap(undefined, prefixedCargoPath),
          })
        }
      } catch {
        // Skip
      }
    }
  }

  const limit = pLimit(20)
  const resultPromises = files.map(relativePath => {
    const fullPath = join(options.repoDir, relativePath)
    const normalizedPath = normalizeRelativePath(relativePath)
    const prefixedRelativePath = joinRelativePath(options.pathPrefix, relativePath)
    const fileDiff = fileDiffs?.get(normalizedPath)
    const stats = fileStats?.get(normalizedPath)

    return limit(async () => {
      try {
        return await processFile(fullPath, prefixedRelativePath, fileDiff, stats, crateMap)
      } catch {
        return null
      }
    })
  })

  const nestedResults = options.includeSubmodules
    ? await Promise.all(directSubmodules.map(async submodule => {
      if (!submodule.initialized) {
        return { files: [], submodules: [] }
      }

      return scanRepo({
        ...options,
        repoDir: join(options.repoDir, submodule.path),
        pathPrefix: joinRelativePath(options.pathPrefix, submodule.path),
      })
    }))
    : []

  const results = await Promise.all(resultPromises)

  for (const nested of nestedResults) {
    submodules.push(...nested.submodules)
  }

  return {
    files: [
      ...cargoResults,
      ...results.filter((result): result is FileResult => result !== null),
      ...nestedResults.flatMap(result => result.files),
    ],
    submodules,
  }
}

/**
 * Scan directory and process files with header comments
 */
export async function scanDirectory(options: GenerateOptions = {}): Promise<ScanResult> {
  const dir = options.dir ?? process.cwd()
  const logger = options.logger ?? createConsoleLogger()
  // Filter out null/undefined/empty patterns (some CLI parsers can pass [null] when option is not used)
  const ignorePatterns = (options.ignore ?? []).filter((p): p is string => !!p)
  const filterPatterns = (options.filter ?? []).filter((p): p is string => !!p)
  return scanRepo({
    repoDir: dir,
    pathPrefix: '',
    includeDiff: options.diff ?? false,
    includeSubmodules: options.submodules !== false,
    logger,
    isIncluded: filterPatterns.length > 0 ? picomatch(filterPatterns) : undefined,
    isIgnored: ignorePatterns.length > 0 ? picomatch(ignorePatterns) : undefined,
    visitedRepoDirs: new Set(),
  })
}

/**
 * Process a single file - check for marker and extract definitions.
 * For .rs files in known Cargo crates, auto-includes even without header comments.
 */
async function processFile(
  fullPath: string,
  relativePath: string,
  fileDiff?: FileDiff,
  fileStats?: FileDiffStats,
  crateMap?: Map<string, CrateInfo>
): Promise<FileResult | null> {
  // Handle README.md files specially
  if (isReadmeFile(relativePath)) {
    const description = await extractMarkdownDescription(fullPath)
    if (!description) {
      return null
    }
    return {
      relativePath,
      description,
      definitions: [],
      submap: resolveSubmap(undefined, relativePath),
      diff: fileStats,
    }
  }

  // Detect language first
  const language = detectLanguage(relativePath)
  if (!language) {
    return null
  }

  // Read file once for both marker extraction and definition parsing
  const code = await readFile(fullPath, 'utf8')

  // Check for marker using the code we already read
  const marker = await extractMarkerFromCode(code, language)

  // If no marker found, check if this is a .rs file in a known crate
  if (!marker.found) {
    if (language !== 'rust' || !crateMap?.size) {
      return null
    }

    const crate = findCrateForFile(relativePath, crateMap)
    if (!crate) {
      return null
    }

    // Parse for definitions using the code we already read
    const tree = await parseCode(code, language)
    let definitions = extractDefinitions(tree.rootNode, language)

    if (fileDiff) {
      definitions = applyDiffToDefinitions(definitions, fileDiff)
    }

    // Auto-include: structural files always, others only if they have definitions
    const isStructural = isRustStructuralFile(relativePath)
    if (!isStructural && definitions.length === 0) {
      return null
    }

    // Use crate description for entry points, module name for mod.rs
    let description: string | undefined
    const basename = relativePath.split(/[/\\]/).pop()
    if (basename === 'main.rs' || basename === 'lib.rs') {
      const kind = basename === 'main.rs' ? 'Binary' : 'Library'
      description = `${kind} entry point for ${crate.manifest.packageName}`
    } else if (basename === 'mod.rs') {
      const parentDir = relativePath.split(/[/\\]/).slice(-2, -1)[0]
      if (parentDir) {
        description = `Module: ${parentDir}`
      }
    }

    return {
      relativePath,
      description,
      definitions,
      submap: resolveSubmap(undefined, relativePath),
      diff: fileStats,
    }
  }

  // Parse and extract definitions using the same code
  const tree = await parseCode(code, language)
  let definitions = extractDefinitions(tree.rootNode, language)

  // Apply diff info if available (for definition-level stats)
  if (fileDiff) {
    definitions = applyDiffToDefinitions(definitions, fileDiff)
  }

  // Resolve submap
  const submap = resolveSubmap(marker.submap, relativePath)

  return {
    relativePath,
    description: marker.description,
    definitions,
    submap,
    // Use pre-calculated file stats from --numstat (more reliable)
    diff: fileStats,
  }
}
