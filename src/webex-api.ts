/**
 * Webex REST API client for Calling operations.
 * Docs: https://developer.webex.com/docs/api/v1
 */

const WEBEX_BASE_URL = "https://webexapis.com/v1";

/**
 * Extract the UUID from a base64-encoded Webex ID.
 * e.g. "Y2lz...L09SR0FOSVpBVElPTi9jM2I3OWE3ZC05ZjZlLTQ4YjUtYTA2My1hYzNjZWVjNDY3MmY"
 *   → "c3b79a7d-9f6e-48b5-a063-ac3ceec4672f"
 */
export function extractUuid(base64Id: string): string {
  const decoded = Buffer.from(base64Id, "base64").toString("utf-8");
  const parts = decoded.split("/");
  return parts[parts.length - 1];
}

/**
 * Convert an ID to UUID if it's a Hydra ID (base64-encoded), pass through if already a UUID.
 * Telephony config endpoints require UUID format.
 */
function toUuid(id: string): string {
  // Hydra IDs start with "Y2lz" (base64 for "cis")
  return id.startsWith("Y2lz") ? extractUuid(id) : id;
}

export class WebexApiClient {
  private tokenProvider: () => Promise<string>;

  /**
   * @param tokenProvider — async function returning a valid access token.
   */
  constructor(tokenProvider: () => Promise<string>) {
    this.tokenProvider = tokenProvider;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${WEBEX_BASE_URL}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const token = await this.tokenProvider();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Webex API error ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    // Some DELETE calls return 204 with no body
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // ────────────────────────── People ──────────────────────────

  async listPeople(params: {
    email?: string;
    displayName?: string;
    max?: number;
    orgId?: string;
    callingData?: boolean;
    locationId?: string;
  } = {}) {
    const q: Record<string, string> = {};
    if (params.email) q.email = params.email;
    if (params.displayName) q.displayName = params.displayName;
    q.max = String(params.max || 100);
    if (params.orgId) q.orgId = params.orgId;
    if (params.callingData) q.callingData = "true";
    if (params.locationId) q.locationId = params.locationId;
    return this.request("GET", "/people", undefined, q);
  }

  async getPerson(personId: string, callingData = true) {
    const q: Record<string, string> = {};
    if (callingData) q.callingData = "true";
    return this.request("GET", `/people/${encodeURIComponent(personId)}`, undefined, q);
  }

  // ────────────────────────── Locations ──────────────────────────

  async listLocations(params: { name?: string; orgId?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.name) q.name = params.name;
    if (params.orgId) q.orgId = params.orgId;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/locations", undefined, q);
  }

  async getLocation(locationId: string) {
    return this.request("GET", `/locations/${encodeURIComponent(locationId)}`);
  }

  // ────────────────────────── Numbers ──────────────────────────

  async listNumbers(params: {
    location?: string;
    phoneNumber?: string;
    available?: boolean;
    owner?: { type: string; id: string };
    max?: number;
  } = {}) {
    const q: Record<string, string> = {};
    if (params.location) q.location = params.location;
    if (params.phoneNumber) q.phoneNumber = params.phoneNumber;
    if (params.available !== undefined) q.available = String(params.available);
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/telephony/config/numbers", undefined, q);
  }

  // ────────────────────────── Call Forwarding ──────────────────────────

  async getPersonCallForwarding(personId: string) {
    return this.request(
      "GET",
      `/people/${encodeURIComponent(personId)}/features/callForwarding`
    );
  }

  async updatePersonCallForwarding(personId: string, settings: unknown) {
    return this.request(
      "PUT",
      `/people/${encodeURIComponent(personId)}/features/callForwarding`,
      settings
    );
  }

  // ────────────────────────── Voicemail ──────────────────────────

  async getPersonVoicemail(personId: string) {
    return this.request(
      "GET",
      `/people/${encodeURIComponent(personId)}/features/voicemail`
    );
  }

  async updatePersonVoicemail(personId: string, settings: unknown) {
    return this.request(
      "PUT",
      `/people/${encodeURIComponent(personId)}/features/voicemail`,
      settings
    );
  }

  // ────────────────────────── Call Intercept ──────────────────────────

  async getPersonCallIntercept(personId: string) {
    return this.request(
      "GET",
      `/people/${encodeURIComponent(personId)}/features/intercept`
    );
  }

  async updatePersonCallIntercept(personId: string, settings: unknown) {
    return this.request(
      "PUT",
      `/people/${encodeURIComponent(personId)}/features/intercept`,
      settings
    );
  }

  // ────────────────────────── Hunt Groups ──────────────────────────

  async listHuntGroups(params: { locationId?: string; name?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.locationId) q.locationId = params.locationId;
    if (params.name) q.name = params.name;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/telephony/config/huntGroups", undefined, q);
  }

  async getHuntGroup(locationId: string, huntGroupId: string) {
    return this.request(
      "GET",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/huntGroups/${encodeURIComponent(toUuid(huntGroupId))}`
    );
  }

  async createHuntGroup(locationId: string, settings: {
    name: string;
    phoneNumber?: string;
    extension?: string;
    callPolicies?: {
      policy: "CIRCULAR" | "REGULAR" | "SIMULTANEOUS" | "UNIFORM" | "WEIGHTED";
      waitingEnabled?: boolean;
      noAnswer?: { nextAgentEnabled?: boolean; numberOfRings?: number; systemMaxNumberOfRings?: number; destination?: string; destinationVoicemailEnabled?: boolean };
      businessContinuation?: { enabled?: boolean; destination?: string; destinationVoicemailEnabled?: boolean };
    };
    agents?: Array<{ id: string; weight?: string }>;
    enabled?: boolean;
  }) {
    return this.request(
      "POST",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/huntGroups`,
      settings
    );
  }

  async updateHuntGroup(locationId: string, huntGroupId: string, settings: unknown) {
    return this.request(
      "PUT",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/huntGroups/${encodeURIComponent(toUuid(huntGroupId))}`,
      settings
    );
  }

  async deleteHuntGroup(locationId: string, huntGroupId: string) {
    return this.request(
      "DELETE",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/huntGroups/${encodeURIComponent(toUuid(huntGroupId))}`
    );
  }

  // ────────────────────────── Call Queues ──────────────────────────

  async listCallQueues(params: { locationId?: string; name?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.locationId) q.locationId = params.locationId;
    if (params.name) q.name = params.name;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/telephony/config/queues", undefined, q);
  }

  async getCallQueue(locationId: string, queueId: string) {
    return this.request(
      "GET",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/queues/${encodeURIComponent(toUuid(queueId))}`
    );
  }

  async createCallQueue(locationId: string, settings: {
    name: string;
    phoneNumber?: string;
    extension?: string;
    callPolicies?: {
      policy: "CIRCULAR" | "REGULAR" | "SIMULTANEOUS" | "UNIFORM" | "WEIGHTED" | "LONGEST_IDLE";
      callerIdPolicy?: string;
      callerIdName?: string;
    };
    queueSettings?: {
      queueSize?: number;
      callOfferToneEnabled?: boolean;
      overflowSettings?: unknown;
      waitMessage?: unknown;
      comfortMessage?: unknown;
    };
    agents?: Array<{ id: string; weight?: string }>;
    enabled?: boolean;
  }) {
    return this.request(
      "POST",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/queues`,
      settings
    );
  }

  async updateCallQueue(locationId: string, queueId: string, settings: unknown) {
    return this.request(
      "PUT",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/queues/${encodeURIComponent(toUuid(queueId))}`,
      settings
    );
  }

  async deleteCallQueue(locationId: string, queueId: string) {
    return this.request(
      "DELETE",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/queues/${encodeURIComponent(toUuid(queueId))}`
    );
  }

  // ────────────────────────── Auto Attendants ──────────────────────────

  async listAutoAttendants(params: { locationId?: string; name?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.locationId) q.locationId = params.locationId;
    if (params.name) q.name = params.name;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/telephony/config/autoAttendants", undefined, q);
  }

  async getAutoAttendant(locationId: string, autoAttendantId: string) {
    return this.request(
      "GET",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/autoAttendants/${encodeURIComponent(toUuid(autoAttendantId))}`
    );
  }

  // ────────────────────────── Call Detail Records ──────────────────────────

  async getCallDetailRecords(params: {
    startTime?: string;
    endTime?: string;
    locations?: string;
    max?: number;
  } = {}) {
    const q: Record<string, string> = {};
    if (params.startTime) q.startTime = params.startTime;
    if (params.endTime) q.endTime = params.endTime;
    if (params.locations) q.locations = params.locations;
    if (params.max) q.max = String(params.max);

    // CDR API uses a different base URL
    const url = new URL("https://analytics-calling.webexapis.com/v1/cdr_feed");
    for (const [key, value] of Object.entries(q)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    const token = await this.tokenProvider();
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Webex API error ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    return (await response.json()) as unknown;
  }

  // ────────────────────────── Schedules ──────────────────────────

  async listSchedules(locationId: string, params: { type?: string; name?: string } = {}) {
    const q: Record<string, string> = {};
    if (params.type) q.type = params.type;
    if (params.name) q.name = params.name;
    return this.request(
      "GET",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/schedules`,
      undefined,
      q
    );
  }

  async createSchedule(locationId: string, schedule: {
    name: string;
    type: "businessHours" | "holidays";
    events?: Array<{
      name: string;
      startDate?: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      allDayEnabled?: boolean;
      recurrence?: unknown;
    }>;
  }) {
    return this.request(
      "POST",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/schedules`,
      schedule
    );
  }

  async deleteSchedule(locationId: string, scheduleType: string, scheduleId: string) {
    return this.request(
      "DELETE",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/schedules/${encodeURIComponent(scheduleType)}/${encodeURIComponent(toUuid(scheduleId))}`
    );
  }

  // ────────────────────────── Caller ID ──────────────────────────

  async getPersonCallerId(personId: string) {
    return this.request(
      "GET",
      `/people/${encodeURIComponent(personId)}/features/callerId`
    );
  }

  async updatePersonCallerId(personId: string, settings: unknown) {
    return this.request(
      "PUT",
      `/people/${encodeURIComponent(personId)}/features/callerId`,
      settings
    );
  }

  // ────────────────────────── Do Not Disturb ──────────────────────────

  async getPersonDoNotDisturb(personId: string) {
    return this.request(
      "GET",
      `/people/${encodeURIComponent(personId)}/features/doNotDisturb`
    );
  }

  async updatePersonDoNotDisturb(personId: string, settings: { enabled: boolean; ringSplashEnabled?: boolean }) {
    return this.request(
      "PUT",
      `/people/${encodeURIComponent(personId)}/features/doNotDisturb`,
      settings
    );
  }

  // ────────────────────────── Devices ──────────────────────────

  async listDevices(params: { personId?: string; workspaceId?: string; displayName?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.personId) q.personId = params.personId;
    if (params.workspaceId) q.workspaceId = params.workspaceId;
    if (params.displayName) q.displayName = params.displayName;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/devices", undefined, q);
  }

  async getDevice(deviceId: string) {
    return this.request("GET", `/devices/${deviceId}`);
  }

  // ────────────────────────── Workspaces ──────────────────────────

  async listWorkspaces(params: { displayName?: string; locationId?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.displayName) q.displayName = params.displayName;
    if (params.locationId) q.locationId = params.locationId;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/workspaces", undefined, q);
  }

  // ────────────────────────── Call Pickup ──────────────────────────

  async listCallPickups(locationId: string) {
    return this.request(
      "GET",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/callPickups`
    );
  }

  // ────────────────────────── Call Park ──────────────────────────

  async listCallParks(locationId: string) {
    return this.request(
      "GET",
      `/telephony/config/locations/${encodeURIComponent(toUuid(locationId))}/callParks`
    );
  }

  // ────────────────────────── Paging Groups ──────────────────────────

  async listPagingGroups(params: { locationId?: string; name?: string; max?: number } = {}) {
    const q: Record<string, string> = {};
    if (params.locationId) q.locationId = params.locationId;
    if (params.name) q.name = params.name;
    if (params.max) q.max = String(params.max);
    return this.request("GET", "/telephony/config/pagingGroups", undefined, q);
  }

  // ────────────────────────── Groups ──────────────────────────

  async listGroups(params: {
    filter?: string;
    includeMembers?: boolean;
    count?: number;
    startIndex?: number;
  } = {}) {
    const q: Record<string, string> = {};
    if (params.filter) q.filter = params.filter;
    if (params.includeMembers) q.includeMembers = "true";
    if (params.count) q.count = String(params.count);
    if (params.startIndex) q.startIndex = String(params.startIndex);
    return this.request("GET", "/groups", undefined, q);
  }

  // ────────────────────────── Organization Contacts ──────────────────────────

  /**
   * The Contacts API uses org UUID format in the path, not the base64 orgId.
   * We need to resolve the orgId first via /people/me if not provided.
   */

  private orgUuid: string | null = null;

  async getOrgUuid(): Promise<string> {
    if (this.orgUuid) return this.orgUuid;
    const me = await this.request<{ orgId: string }>("GET", "/people/me");
    this.orgUuid = extractUuid(me.orgId);
    return this.orgUuid;
  }

  async listOrgContacts(params: { keyword?: string; source?: string; limit?: number } = {}) {
    const orgUuid = await this.getOrgUuid();
    const q: Record<string, string> = {};
    if (params.keyword !== undefined) q.keyword = params.keyword;
    if (params.source) q.source = params.source;
    q.limit = String(params.limit || 100);
    return this.request(
      "GET",
      `/contacts/organizations/${encodeURIComponent(orgUuid)}/contacts/search`,
      undefined,
      q
    );
  }

  async getOrgContact(contactId: string) {
    const orgUuid = await this.getOrgUuid();
    return this.request(
      "GET",
      `/contacts/organizations/${encodeURIComponent(orgUuid)}/contacts/${encodeURIComponent(contactId)}`
    );
  }

  async createOrgContact(contact: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    title?: string;
    address?: string;
    primaryContactMethod?: string;
    emails?: Array<{ value: string; type?: string; primary?: boolean }>;
    phoneNumbers?: Array<{ value: string; type?: string; primary?: boolean }>;
    sipAddresses?: Array<{ value: string; type?: string; primary?: boolean }>;
    groupIds?: string[];
  }) {
    const orgUuid = await this.getOrgUuid();
    return this.request(
      "POST",
      `/contacts/organizations/${encodeURIComponent(orgUuid)}/contacts`,
      {
        schemas: "urn:cisco:codev:identity:contact:core:1.0",
        source: "CH",
        ...contact,
      }
    );
  }

  async updateOrgContact(contactId: string, contact: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    title?: string;
    address?: string;
    primaryContactMethod?: string;
    emails?: Array<{ value: string; type?: string; primary?: boolean }>;
    phoneNumbers?: Array<{ value: string; type?: string; primary?: boolean }>;
    sipAddresses?: Array<{ value: string; type?: string; primary?: boolean }>;
    groupIds?: string[];
  }) {
    const orgUuid = await this.getOrgUuid();
    return this.request(
      "PATCH",
      `/contacts/organizations/${encodeURIComponent(orgUuid)}/contacts/${encodeURIComponent(contactId)}`,
      {
        schemas: "urn:cisco:codev:identity:contact:core:1.0",
        source: "CH",
        ...contact,
      }
    );
  }

  async deleteOrgContact(contactId: string) {
    const orgUuid = await this.getOrgUuid();
    return this.request(
      "DELETE",
      `/contacts/organizations/${encodeURIComponent(orgUuid)}/contacts/${encodeURIComponent(contactId)}`
    );
  }
}
