import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'date-fns';
import slugify from '../utils/slugify.util.js';

type LocalUploadFile = Express.Multer.File & {
  storageKey?: string;
  location?: string;
};

type PreparedLocalUploadFile = Express.Multer.File & {
  filename: string;
  storageKey: string;
  location: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..', '..');

export const uploadsRoot = path.join(backendRoot, 'public', 'uploads');

function cleanOriginalName(originalName: string) {
  const extension = path
    .extname(originalName)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '');
  const baseName = path.basename(originalName, extension);
  const cleanBaseName =
    baseName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'image';

  return `${cleanBaseName}${extension}`;
}

export function createLocalUploadFilename(originalName: string) {
  const formattedDate = format(new Date(), 'yyyy-MM-dd_hh-mm-ss-a').toLowerCase();
  return `${formattedDate}_${randomUUID().slice(0, 8)}_${cleanOriginalName(originalName)}`;
}

function getSafeFolders(folders: string[]) {
  return folders.map((folder) => slugify(folder)).filter(Boolean);
}

function buildStorageKey(folders: string[], filename: string) {
  return [...getSafeFolders(folders), filename].join('/');
}

export function getLocalUploadDirectory(folders: string[]) {
  return path.join(uploadsRoot, ...getSafeFolders(folders));
}

export async function ensureLocalUploadDirectory(folders: string[]) {
  await fs.mkdir(getLocalUploadDirectory(folders), { recursive: true });
}

export function getLocalUploadUrlFromFilename(filename: string, folders: string[]) {
  return `/uploads/${buildStorageKey(folders, filename)}`;
}

export function ensureLocalUploadMetadata(file: Express.Multer.File, folders: string[]) {
  const uploadFile = file as LocalUploadFile;

  if (!uploadFile.filename) {
    uploadFile.filename = createLocalUploadFilename(file.originalname);
  }

  if (!uploadFile.storageKey) {
    uploadFile.storageKey = buildStorageKey(folders, uploadFile.filename);
  }

  if (!uploadFile.location) {
    uploadFile.location = `/uploads/${uploadFile.storageKey}`;
  }

  return uploadFile as PreparedLocalUploadFile;
}

export function getLocalUploadUrl(file: Express.Multer.File, folders: string[]) {
  return ensureLocalUploadMetadata(file, folders).location;
}

function decodeUrlPath(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export function getLocalUploadRelativePath(fileUrl: string | null | undefined) {
  if (!fileUrl) return null;

  let pathname = fileUrl.trim();

  try {
    pathname = new URL(pathname).pathname;
  } catch {
    // Relative upload paths are accepted below.
  }

  const normalizedPath = decodeUrlPath(pathname).replace(/^\/+/, '');

  if (!normalizedPath.startsWith('uploads/')) {
    return null;
  }

  const relativePath = path.posix.normalize(normalizedPath.slice('uploads/'.length));

  if (
    !relativePath ||
    relativePath === '.' ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return relativePath;
}

function isInsideUploadsRoot(filePath: string) {
  const resolvedPath = path.resolve(filePath);
  const relativePath = path.relative(uploadsRoot, resolvedPath);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

async function deleteLocalUploadPath(filePath: string | null | undefined) {
  if (!filePath || !isInsideUploadsRoot(filePath)) {
    return false;
  }

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') {
      console.error(`[LocalUpload] Error deleting file at ${filePath}:`, error);
    }

    return false;
  }
}

export async function deleteLocalUploadFile(file: Express.Multer.File) {
  return deleteLocalUploadPath((file as { path?: string }).path);
}

export async function deleteLocalUploadByUrl(fileUrl: string | null | undefined) {
  const relativePath = getLocalUploadRelativePath(fileUrl);
  if (!relativePath) return false;

  return deleteLocalUploadPath(path.join(uploadsRoot, relativePath));
}
