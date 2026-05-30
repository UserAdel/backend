import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  type ObjectCannedACL,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { format } from 'date-fns';
import slugify from '../utils/slugify.util.js';

type S3UploadFile = Express.Multer.File & {
  filename?: string;
  storageKey?: string;
  location?: string;
};

type PreparedS3UploadFile = Express.Multer.File & {
  filename: string;
  storageKey: string;
  location: string;
};

interface S3StorageConfig {
  bucketName: string;
  endpointUrl: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  forcePathStyle: boolean;
  objectAcl: ObjectCannedACL | undefined;
}

let s3Client: S3Client | null = null;
let s3ClientCacheKey = '';

function getEnvValue(...names: string[]) {
  return names.map((name) => process.env[name]?.trim()).find(Boolean);
}

function requireEnvValue(label: string, ...names: string[]) {
  const value = getEnvValue(...names);
  if (!value) {
    throw new Error(`${label} is required for S3 image uploads`);
  }

  return value;
}

function getForcePathStyle() {
  return getEnvValue('S3_FORCE_PATH_STYLE', 'AWS_S3_FORCE_PATH_STYLE') === 'true';
}

function getObjectAcl(): ObjectCannedACL | undefined {
  const acl = getEnvValue('S3_OBJECT_ACL', 'AWS_S3_OBJECT_ACL') ?? 'public-read';
  return acl === 'none' ? undefined : (acl as ObjectCannedACL);
}

function getBucketName() {
  return getEnvValue(
    'BUCKET_NAME',
    'AWS_BUCKET_NAME',
    'S3_BUCKET',
    'S3_BUCKET_NAME',
    'AWS_S3_BUCKET'
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getTigrisPublicBaseUrl(bucketName: string, endpointHost: string) {
  if (
    endpointHost === 't3.storage.dev' ||
    endpointHost === 'fly.storage.tigris.dev' ||
    endpointHost.endsWith('.storage.tigris.dev')
  ) {
    return `https://${bucketName}.t3.tigrisfiles.io`;
  }

  return null;
}

function derivePublicBaseUrl(bucketName: string, endpointUrl: string, forcePathStyle: boolean) {
  const configuredPublicBaseUrl = getEnvValue(
    'S3_PUBLIC_BASE_URL',
    'S3_PUBLIC_URL',
    'AWS_S3_PUBLIC_BASE_URL',
    'AWS_S3_PUBLIC_URL',
    'PUBLIC_S3_BASE_URL'
  );

  if (configuredPublicBaseUrl) {
    return trimTrailingSlash(configuredPublicBaseUrl);
  }

  const endpoint = new URL(endpointUrl);
  const tigrisPublicBaseUrl = getTigrisPublicBaseUrl(bucketName, endpoint.hostname);
  if (tigrisPublicBaseUrl) {
    return tigrisPublicBaseUrl;
  }

  if (forcePathStyle) {
    return `${trimTrailingSlash(endpoint.origin)}/${bucketName}`;
  }

  return `${endpoint.protocol}//${bucketName}.${endpoint.host}`;
}

function getS3Config(): S3StorageConfig {
  const bucketName = requireEnvValue(
    'S3 bucket name',
    'BUCKET_NAME',
    'AWS_BUCKET_NAME',
    'S3_BUCKET',
    'S3_BUCKET_NAME',
    'AWS_S3_BUCKET'
  );
  const endpointUrl = requireEnvValue('AWS_ENDPOINT_URL_S3', 'AWS_ENDPOINT_URL_S3');
  const region = getEnvValue('AWS_REGION', 'AWS_DEFAULT_REGION') ?? 'auto';
  const accessKeyId = requireEnvValue('AWS_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
  const secretAccessKey = requireEnvValue('AWS_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
  const forcePathStyle = getForcePathStyle();

  return {
    bucketName,
    endpointUrl,
    region,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: derivePublicBaseUrl(bucketName, endpointUrl, forcePathStyle),
    forcePathStyle,
    objectAcl: getObjectAcl(),
  };
}

function getS3Client() {
  const config = getS3Config();
  const cacheKey = [
    config.endpointUrl,
    config.region,
    config.accessKeyId,
    config.forcePathStyle,
  ].join('|');

  if (!s3Client || s3ClientCacheKey !== cacheKey) {
    s3Client = new S3Client({
      endpoint: config.endpointUrl,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    s3ClientCacheKey = cacheKey;
  }

  return { client: s3Client, config };
}

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

function createUploadFilename(originalName: string) {
  const formattedDate = format(new Date(), 'yyyy-MM-dd_hh-mm-ss-a').toLowerCase();
  return `${formattedDate}_${randomUUID().slice(0, 8)}_${cleanOriginalName(originalName)}`;
}

function buildStorageKey(folders: string[], filename: string) {
  const safeFolders = folders.map((folder) => slugify(folder)).filter(Boolean);
  return [...safeFolders, filename].join('/');
}

function getPublicObjectUrl(storageKey: string) {
  const { publicBaseUrl } = getS3Config();
  return `${publicBaseUrl}/${storageKey}`;
}

export function ensureS3UploadMetadata(file: Express.Multer.File, folders: string[]) {
  const uploadFile = file as S3UploadFile;

  if (!uploadFile.filename) {
    uploadFile.filename = createUploadFilename(file.originalname);
  }

  if (!uploadFile.storageKey) {
    uploadFile.storageKey = buildStorageKey(folders, uploadFile.filename);
  }

  if (!uploadFile.location) {
    uploadFile.location = getPublicObjectUrl(uploadFile.storageKey);
  }

  return uploadFile as PreparedS3UploadFile;
}

export function getS3UploadUrl(file: Express.Multer.File, folders: string[]) {
  return ensureS3UploadMetadata(file, folders).location;
}

export async function uploadFileToS3(file: Express.Multer.File, folders: string[]) {
  const uploadFile = ensureS3UploadMetadata(file, folders);
  const { client, config } = getS3Client();

  if (!file.buffer) {
    throw new Error('Uploaded image is missing its in-memory buffer');
  }

  const input: PutObjectCommandInput = {
    Bucket: config.bucketName,
    Key: uploadFile.storageKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    CacheControl: 'public, max-age=31536000, immutable',
  };

  if (config.objectAcl) {
    input.ACL = config.objectAcl;
  }

  await client.send(new PutObjectCommand(input));
  return uploadFile.location;
}

function getConfiguredPublicBaseUrl() {
  const bucketName = getBucketName();
  const endpointUrl = getEnvValue('AWS_ENDPOINT_URL_S3');

  if (!bucketName || !endpointUrl) {
    return null;
  }

  return derivePublicBaseUrl(bucketName, endpointUrl, getForcePathStyle());
}

function stripBasePath(urlPath: string, basePath: string) {
  if (!basePath || basePath === '/') {
    return urlPath.replace(/^\/+/, '');
  }

  const normalizedBasePath = basePath.replace(/\/+$/, '');
  if (!urlPath.startsWith(`${normalizedBasePath}/`)) {
    return null;
  }

  return urlPath.slice(normalizedBasePath.length).replace(/^\/+/, '');
}

function decodeObjectKey(key: string) {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export function getS3ObjectKeyFromUrl(fileUrl: string | null | undefined) {
  const bucketName = getBucketName();
  const endpointUrl = getEnvValue('AWS_ENDPOINT_URL_S3');

  if (!fileUrl || !bucketName || !endpointUrl) {
    return null;
  }

  try {
    const url = new URL(fileUrl);
    const endpoint = new URL(endpointUrl);
    const configuredPublicBaseUrl = getConfiguredPublicBaseUrl();

    if (configuredPublicBaseUrl) {
      const publicBaseUrl = new URL(configuredPublicBaseUrl);
      if (url.origin === publicBaseUrl.origin) {
        const objectKey = stripBasePath(url.pathname, publicBaseUrl.pathname);
        if (objectKey) {
          return decodeObjectKey(objectKey);
        }
      }
    }

    if (url.hostname === endpoint.hostname) {
      const [bucketSegment, ...keySegments] = url.pathname.replace(/^\/+/, '').split('/');
      if (bucketSegment === bucketName && keySegments.length > 0) {
        return decodeObjectKey(keySegments.join('/'));
      }
    }

    const bucketHostnames = new Set([
      `${bucketName}.${endpoint.hostname}`,
      `${bucketName}.fly.storage.tigris.dev`,
      `${bucketName}.t3.tigrisfiles.io`,
      `${bucketName}.t3.tigrisbucket.io`,
      `${bucketName}.t3.tigrisblob.io`,
    ]);

    if (bucketHostnames.has(url.hostname)) {
      return decodeObjectKey(url.pathname.replace(/^\/+/, ''));
    }
  } catch {
    const relativeKey = fileUrl.replace(/^\/+/, '');
    if (relativeKey.startsWith('activities/')) {
      return relativeKey;
    }
  }

  return null;
}

export async function deleteS3ObjectByUrl(fileUrl: string | null | undefined) {
  const key = getS3ObjectKeyFromUrl(fileUrl);
  if (!key) {
    return false;
  }

  const { client, config } = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );

  return true;
}
