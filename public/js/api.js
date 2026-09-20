/**
 * OpportunityOS — API Client Service
 * ===================================
 * Handles requests to Flask backend endpoints with automatic Bearer JWT injection.
 */

const ApiClient = {
  async request(endpoint, options = {}) {
    const url = `${AppConfig.API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    // Inject Bearer token if user is signed in
    const token = window.authManager?.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed request`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // ── Public Opportunity Endpoints ──────────────────────────────────────────
  async getOpportunities(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.type && params.type !== "all") query.set("type", params.type);
    if (params.mode && params.mode !== "all") query.set("mode", params.mode);
    if (params.sort) query.set("sort", params.sort);
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    return this.request(`/api/opportunities${queryString}`);
  },

  async getOpportunity(id) {
    return this.request(`/api/opportunities/${id}`);
  },

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  async getBookmarks() {
    return this.request(`/api/bookmarks`);
  },

  async addBookmark(opportunityId) {
    return this.request(`/api/bookmarks`, {
      method: "POST",
      body: JSON.stringify({ opportunity_id: opportunityId })
    });
  },

  async removeBookmark(opportunityId) {
    return this.request(`/api/bookmarks/${opportunityId}`, {
      method: "DELETE"
    });
  },

  // ── Applications (Pipeline) ───────────────────────────────────────────────
  async getApplications() {
    return this.request(`/api/applications`);
  },

  async updateApplication(opportunityId, status, notes = "") {
    return this.request(`/api/applications`, {
      method: "POST",
      body: JSON.stringify({
        opportunity_id: opportunityId,
        status,
        notes
      })
    });
  },

  // ── Dashboard Aggregates ──────────────────────────────────────────────────
  async getDashboard() {
    return this.request(`/api/dashboard`);
  },

  // ── Submissions ───────────────────────────────────────────────────────────
  async submitOpportunity(payload) {
    return this.request(`/api/submissions`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // ── Admin Endpoints ───────────────────────────────────────────────────────
  async getAdminSubmissions(status = "all") {
    return this.request(`/api/admin/submissions?status=${status}`);
  },

  async reviewSubmission(id, action, rejectionReason = "") {
    return this.request(`/api/admin/submissions/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ action, rejection_reason: rejectionReason })
    });
  },

  // ── Password Recovery Guidance ────────────────────────────────────────────
  async getForgotPasswordInfo(email = "") {
    return this.request(`/api/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }
};

window.ApiClient = ApiClient;
