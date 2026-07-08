/**
 * @freelayer/storage — policy-enforced storage with a write barrier (TECH-05).
 *
 * The core rule (docs/STORAGE_MODEL.md, ADR-0005):
 *
 *   No feature chooses its own persistence.
 *   Every storage write goes through StoragePolicy.
 *   Every storage operation requires a valid PolicyDecision.
 *   Storage defaults to deny.
 *
 * Approved providers: MemoryStorageProvider and NullStorageProvider only.
 * Encrypted persistence is a throwing placeholder until crypto review
 * (Gates C/F). Direct browser storage / filesystem APIs are forbidden
 * repo-wide and enforced by scripts/check-no-forbidden-storage.mjs.
 */

export {
  STORAGE_DATA_CLASSES,
  KEY_MATERIAL_CLASSES,
  CONTENT_CLASSES,
  CACHE_CLASSES,
  AI_CACHE_CLASSES,
  ENDPOINT_CLASSES,
  SETTINGS_CLASSES,
  type StorageDataClass,
} from "./dataClasses";

export {
  STORAGE_BACKEND_CAPABILITIES,
  type StorageBackendCapability,
  type StorageBackendKind,
} from "./backends";

export {
  PLAINTEXT_RESTRICTED_SENSITIVITIES,
  type StorageClearRequest,
  type StorageDeleteRequest,
  type StorageListRequest,
  type StorageOperationKind,
  type StorageReadRequest,
  type StorageSensitivity,
  type StorageWriteRequest,
} from "./operations";

export {
  resolveStoragePolicy,
  type DeviceRiskLevel,
  type ScreenShieldLevel,
  type StoragePolicy,
  type StoragePolicyInput,
} from "./policy";

export {
  assertStorageDeleteAllowed,
  assertStorageManagementAllowed,
  assertStorageReadAllowed,
  assertStorageWriteAllowed,
} from "./barrier";

export {
  ForbiddenCacheWriteError,
  ForbiddenDebugArtifactError,
  ForbiddenPersistentWriteError,
  StorageBackendNotImplementedError,
  StorageBypassAttemptError,
  StoragePolicyDeniedError,
} from "./errors";

export {
  EncryptedPersistentStorageProviderPlaceholder,
  MemoryStorageProvider,
  NullStorageProvider,
  type StorageProvider,
} from "./providers";
