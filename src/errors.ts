import type { ErrorMap } from "./cli/foundation/error-map";

export const ONPE_STATUS_MAP: Record<number, string> = {
	403: "CDN_BLOCKED",
	404: "NOT_FOUND",
	429: "CDN_BLOCKED",
	502: "NETWORK",
	503: "NETWORK",
};

export const ONPE_ERRORS: ErrorMap = {
	CDN_BLOCKED: {
		name: "CdnBlocked",
		human: "ONPE's CDN returned HTML instead of JSON. The API may be blocking requests.",
		hint: "Run: onpe doctor -- to verify API status. Headers may need updating.",
	},
	TIMEOUT: {
		name: "Timeout",
		human: "Request timed out.",
		hint: "Retry with: onpe <command> --timeout 30000",
	},
	NOT_FOUND: {
		name: "NotFound",
		human: "Resource not found on ONPE API.",
		hint: "Verify the mesa code or acta ID is correct.",
	},
	NO_ELECTION: {
		name: "NoElection",
		human: "No active election found.",
		hint: "ONPE may not have an active electoral process right now.",
	},
	NETWORK: {
		name: "NetworkError",
		human: "Could not reach ONPE API.",
		hint: "Check your internet connection. Run: onpe doctor",
	},
};
