/**
 * CareerDesk — API Client Service
 * ===================================
 * Handles requests to Flask backend endpoints with automatic Bearer JWT injection,
 * in-memory/sessionStorage query caching (5-min TTL), and request cancellation.
 */

const ApiClient = {
  // In-memory query cache & inflight request controllers
  _cache: new Map(),
  _activeAbortController: null,
  _CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes

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
        if (response.status === 403 && data.is_banned) {
          window.dispatchEvent(new CustomEvent("account_banned", { detail: data }));
        }
        throw new Error(data.error || `HTTP ${response.status}: Failed request`);
      }

      return data;
    } catch (err) {
      if (err.name === "AbortError") {
        // Request was intentionally cancelled for newer query
        return null;
      }
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // ── Public Opportunity Endpoints with Query Caching & Request Cancellation ─
  async getOpportunities(params = {}, bypassCache = false) {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search.trim());
    if (params.type && params.type !== "all") query.set("type", params.type);
    if (params.mode && params.mode !== "all") query.set("mode", params.mode);
    if (params.sort) query.set("sort", params.sort);
    if (params.page) query.set("page", params.page);
    if (params.limit) query.set("limit", params.limit);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const cacheKey = `cd_opps_${queryString}`;
    const now = Date.now();

    // 1. Check in-memory cache
    if (!bypassCache && this._cache.has(cacheKey)) {
      const cached = this._cache.get(cacheKey);
      if (now - cached.timestamp < this._CACHE_TTL_MS) {
        return cached.data;
      }
      this._cache.delete(cacheKey);
    }

    // 2. Check sessionStorage cache
    if (!bypassCache) {
      try {
        const stored = sessionStorage.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (now - parsed.timestamp < this._CACHE_TTL_MS) {
            this._cache.set(cacheKey, parsed);
            return parsed.data;
          }
          sessionStorage.removeItem(cacheKey);
        }
      } catch (e) {
        // Ignore storage quotas or restrictions
      }
    }

    // 3. Cancel previous inflight opportunity search request to avoid race conditions
    if (this._activeAbortController) {
      this._activeAbortController.abort();
    }
    this._activeAbortController = new AbortController();

    try {
      const data = await this.request(`/api/opportunities${queryString}`, {
        signal: this._activeAbortController.signal
      });

      if (!data) return null; // Was aborted

      // Cache the result
      const cacheEntry = { timestamp: now, data };
      this._cache.set(cacheKey, cacheEntry);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      } catch (e) {
        // Handle potential quota exceeded
      }

      return data;
    } finally {
      this._activeAbortController = null;
    }
  },

  clearCache() {
    this._cache.clear();
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith("cd_opps_")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}
  },

  async getOpportunity(id) {
    const cacheKey = `cd_opp_${id}`;
    const now = Date.now();

    if (this._cache.has(cacheKey)) {
      const cached = this._cache.get(cacheKey);
      if (now - cached.timestamp < this._CACHE_TTL_MS) {
        return cached.data;
      }
    }

    const data = await this.request(`/api/opportunities/${id}`);
    if (data) {
      this._cache.set(cacheKey, { timestamp: now, data });
    }
    return data;
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

  // ── Public Aggregate Stats ────────────────────────────────────────────────
  async getOpportunityStats() {
    return this.request(`/api/opportunities/stats`);
  },

  async getPublicAnnouncement() {
    return this.request(`/api/announcement`);
  },

  // ── Password Recovery Guidance ────────────────────────────────────────────
  async getForgotPasswordInfo(email = "") {
    return this.request(`/api/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email })
    });
  },

  // ── User Profile Management ──────────────────────────────────────────────
  async getProfile() {
    return this.request(`/api/auth/me`);
  },

  async updateProfile(profileData) {
    return this.request(`/api/auth/profile`, {
      method: "PUT",
      body: JSON.stringify(profileData)
    });
  },

  // ── Account Erasure (DPDP Act 2023 & GDPR Right to be Forgotten) ───────────
  async deleteAccount() {
    return this.request(`/api/auth/profile`, {
      method: "DELETE"
    });
  }
};

window.ApiClient = ApiClient;
