const { v4 } = require('uuid');
const { logger } = require('@librechat/data-schemas');
const { FileSources } = require('librechat-data-provider');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');

const FIREBASE_VARS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];
const GCP_REQUIRED_VARS = ['GCP_PROJECT_ID', 'GCP_BUCKET_NAME'];
const BANNER = '='.repeat(60);

let gcsStorage;
let warned = false;

function logWarning(title, backend, missing) {
  logger.warn(
    [
      '',
      BANNER,
      `⚠️  ${title}`,
      BANNER,
      `Storage backend: ${backend}`,
      '',
      'Missing configuration:',
      ...missing.map((name) => `- ${name}`),
      '',
      'The backend will continue running, but audio storage',
      'functionality may not be available.',
      '',
      'Please configure the required environment variables.',
      BANNER,
    ].join('\n'),
  );
}

/**
 * Picks the audio storage backend from the environment. Missing configuration is logged
 * (once) and never thrown.
 * @returns {{ backend: 'firebase-emulator' | 'gcs', ready: boolean }}
 */
function resolveAudioStorage() {
  const isEmulator = !!process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const missing = (names) => names.filter((name) => !process.env[name]);

  if (isEmulator) {
    const missingVars = missing(FIREBASE_VARS);
    if (missingVars.length > 0 && !warned) {
      warned = true;
      logWarning('FIREBASE STORAGE EMULATOR WARNING', 'Firebase Storage Emulator', missingVars);
    }
    return { backend: 'firebase-emulator', ready: missingVars.length === 0 };
  }

  const missingVars = missing(GCP_REQUIRED_VARS);
  if (missingVars.length > 0 && !warned) {
    warned = true;
    logWarning('STORAGE CONFIGURATION WARNING', 'Google Cloud Storage', missingVars);
  }
  return { backend: 'gcs', ready: missingVars.length === 0 };
}

function getGcsStorage() {
  if (!gcsStorage) {
    const { Storage } = require('@google-cloud/storage');
    gcsStorage = new Storage({ projectId: process.env.GCP_PROJECT_ID });
  }
  return gcsStorage;
}

async function saveToGcs({ userId, buffer, fileName, type }) {
  const prefix = (process.env.GCP_STORAGE_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  const storageClass = process.env.GCP_STORAGE_CLASS;
  const bucketName = process.env.GCP_BUCKET_NAME;
  const objectPath = [prefix, 'audio', userId, fileName].filter(Boolean).join('/');

  await getGcsStorage()
    .bucket(bucketName)
    .file(objectPath)
    .save(buffer, {
      resumable: false,
      contentType: type,
      ...(storageClass && { metadata: { storageClass } }),
    });

  return `gs://${bucketName}/${objectPath}`;
}

/**
 * Stores a voice recording in the configured backend.
 * @returns {Promise<string | undefined>} The stored location, or undefined when storage isn't configured.
 */
async function saveAudioBuffer({ userId, buffer, fileName, type }) {
  const { backend, ready } = resolveAudioStorage();
  if (!ready) {
    return undefined;
  }

  const uniqueName = `${v4()}__${fileName}`;
  if (backend === 'firebase-emulator') {
    const { saveBuffer } = getStrategyFunctions(FileSources.firebase);
    return saveBuffer({ userId, buffer, fileName: uniqueName, basePath: 'audio' });
  }
  return saveToGcs({ userId, buffer, fileName: uniqueName, type });
}

module.exports = { saveAudioBuffer, resolveAudioStorage };
