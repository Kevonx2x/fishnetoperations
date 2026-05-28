/**
 * Legacy path alias — some clients still call `check-inquiry-notifications`.
 * Listing expiry notifications use `check-listing-expiry-notifications`.
 */
export {
  GET,
  POST,
} from "@/app/api/agent/check-listing-expiry-notifications/route";
