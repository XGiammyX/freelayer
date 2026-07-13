/**
 * @freelayer/rooms — RoomOS privacy-safe local query model (TECH-19).
 *
 * A local-only, side-effect-free, policy-gated READ boundary that derives
 * privacy-safe views from an immutable RoomOS snapshot. NOT a UI, database,
 * remote API, or persistent search engine. No query history/cache/index, no
 * network/notification/AI, no endpoint-protection guarantee.
 */

export * from "./query-errors";
export * from "./query-types";
export * from "./query-requests";
export * from "./query-validation";
export * from "./query-cursor";
export * from "./query-policy";
export * from "./query-snapshot";
export * from "./query-redaction";
export * from "./query-views";
export * from "./query-search";
export * from "./query-executor";
