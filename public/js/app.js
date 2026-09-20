/**
 * OpportunityOS — Application Controller
 * =======================================
 * Manages view routing, live search/filtering, opportunity rendering,
 * optimistic bookmarks, Kanban pipeline, modals, and toasts.
 */

class OpportunityApp {
  constructor() {
    this.currentTab = "explore";
    this.opportunities = [];
    this.bookmarks = new Set();
    this.applications = [];
    this.currentFilters = {
      search: "",
      type: "all",
      mode: "all",
      sort: "deadline_asc",
      page: 1,
      limit: 30
    };
    this.searchDebounceTimer = null;
  }

  async init() {
    this.setupEventListeners();
    this.setupAuthSync();
    await this.loadExploreData();
    await this.updateHeroStats();
  }

  // ── Event Handlers & Routing ──────────────────────────────────────────────
  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        const targetTab = tab.dataset.tab;
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });

    // Category Filter Pills
    document.querySelectorAll(".pill-btn").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".pill-btn").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        this.currentFilters.type = pill.dataset.type || "all";
        this.loadExploreData();
      });
    });

    // Search Input with Debounce
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.currentFilters.search = e.target.value.trim();
          this.loadExploreData();
        }, 300);
      });
    }

    // Mode Filter
    const modeSelect = document.getElementById("modeSelect");
    if (modeSelect) {
      modeSelect.addEventListener("change", (e) => {
        this.currentFilters.mode = e.target.value;
        this.loadExploreData();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.currentFilters.sort = e.target.value;
        this.loadExploreData();
      });
    }

    // Auth Buttons
    const btnGoogleLogin = document.getElementById("btnGoogleLogin");
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener("click", () => {
        window.authManager.signInWithGoogle();
      });
    }

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        await window.authManager.signOut();
        this.showToast("Signed out successfully", "info");
      });
    }

    // User Menu Dropdown Toggle
    const userProfileMenu = document.getElementById("userProfileMenu");
    const userDropdown = document.getElementById("userDropdown");
    if (userProfileMenu && userDropdown) {
      userProfileMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle("show");
      });

      document.addEventListener("click", () => {
        userDropdown.classList.remove("show");
      });
    }

    // Forgot Password Link Trigger
    const btnForgotPassword = document.getElementById("btnForgotPassword");
    if (btnForgotPassword) {
      btnForgotPassword.addEventListener("click", (e) => {
        e.preventDefault();
        this.openModal("forgotPasswordModal");
      });
    }

    // Modal Close Buttons
    document.querySelectorAll(".modal-close-btn, .btn-modal-close").forEach(btn => {
      btn.addEventListener("click", () => {
        this.closeAllModals();
      });
    });

    // Close on Backdrop Click & ESC Key
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeAllModals();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeAllModals();
    });

    // Community Submission Form
    const submitForm = document.getElementById("opportunitySubmitForm");
    if (submitForm) {
      submitForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleOpportunitySubmission(new FormData(submitForm));
      });
    }
  }

  setupAuthSync() {
    window.authManager.onAuthChange((user) => {
      const loginBtn = document.getElementById("btnGoogleLogin");
      const userMenu = document.getElementById("userProfileMenu");
      const adminTab = document.getElementById("adminNavTab");

      if (user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (userMenu) {
          userMenu.style.display = "flex";
          const nameEl = document.getElementById("navUserName");
          const avatarEl = document.getElementById("navUserAvatar");
          const roleEl = document.getElementById("navUserRole");
          if (nameEl) nameEl.textContent = user.full_name || "Student";
          if (avatarEl) avatarEl.src = user.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";
          if (roleEl) roleEl.textContent = user.role || "student";
        }
        if (adminTab) {
          adminTab.style.display = (user.role === "admin") ? "flex" : "none";
        }
        this.loadBookmarks();
        this.loadApplications();
      } else {
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (userMenu) userMenu.style.display = "none";
        if (adminTab) adminTab.style.display = "none";
        this.bookmarks.clear();
        this.applications = [];
      }
    });
  }

  // ── Tab Navigation ────────────────────────────────────────────────────────
  switchTab(tabId) {
    this.currentTab = tabId;

    // Update Nav Tab UI
    document.querySelectorAll(".nav-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });

    // Show/Hide View Panels
    document.querySelectorAll(".view-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `${tabId}View`);
    });

    // Show or hide search controls (only needed for explore)
    const controls = document.getElementById("controlsSection");
    if (controls) {
      controls.style.display = (tabId === "explore") ? "block" : "none";
    }

    // Refresh tab-specific data
    if (tabId === "explore") this.loadExploreData();
    if (tabId === "pipeline") this.loadApplications();
    if (tabId === "bookmarks") this.renderBookmarks();
    if (tabId === "admin") this.loadAdminSubmissions();
  }

  // ── Explore View ──────────────────────────────────────────────────────────
  async loadExploreData() {
    const grid = document.getElementById("opportunitiesGrid");
    if (!grid) return;

    grid.innerHTML = this.renderSkeletons(6);

    try {
      const data = await window.ApiClient.getOpportunities(this.currentFilters);
      this.opportunities = data.opportunities || [];
      this.renderOpportunities(this.opportunities);
    } catch (err) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">Failed to load opportunities</div>
          <p class="empty-desc">Could not connect to the backend server. Please check your connection or retry.</p>
          <button class="btn-apply-primary" style="margin-top: 16px;" onclick="window.app.loadExploreData()">Retry</button>
        </div>
      `;
    }
  }

  renderOpportunities(list) {
    const grid = document.getElementById("opportunitiesGrid");
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <div class="empty-title">No opportunities found</div>
          <p class="empty-desc">Try clearing your filters or searching for different keywords.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(opp => this.renderOpportunityCard(opp)).join("");
  }

  renderOpportunityCard(opp) {
    const isBookmarked = this.bookmarks.has(opp.id);
    const deadlineVal = opp.deadline_utc || opp.deadline;
    const deadlineCountdown = this.calculateCountdown(deadlineVal);
    const organizer = opp.organiser || opp.organizer || "Verified Organizer";
    const category = opp.category || opp.opportunity_type || "Event";
    const applyUrl = opp.official_url || opp.apply_url || "#";
    const mode = (opp.mode || "online").toLowerCase();
    
    let prizeFormatted = opp.prize_label || opp.prize_pool;
    if (!prizeFormatted && opp.prize_inr) {
      prizeFormatted = `₹${Number(opp.prize_inr).toLocaleString('en-IN')}`;
    }
    if (!prizeFormatted) {
      prizeFormatted = "Swag / Certificates";
    }

    const modeBadgeClass = mode === "online" ? "badge-hackathon" : mode === "in_person" || mode === "offline" ? "badge-contest" : "badge-internship";

    return `
      <div class="opportunity-card" data-id="${opp.id}">
        <div>
          <div class="card-top">
            <div class="card-badges">
              <span class="badge ${modeBadgeClass}">${this.escapeHtml(category)}</span>
              <span class="badge badge-mode">${this.escapeHtml(mode.toUpperCase())}</span>
              ${deadlineCountdown ? `<span class="badge badge-countdown ${deadlineCountdown.isUrgent ? 'urgent' : ''}">${deadlineCountdown.text}</span>` : ""}
            </div>
            <button class="btn-bookmark ${isBookmarked ? 'bookmarked' : ''}" 
                    title="${isBookmarked ? 'Remove Bookmark' : 'Bookmark Opportunity'}"
                    onclick="window.app.toggleBookmark(${opp.id}, this)">
              <svg viewBox="0 0 24 24">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>

          <h3 class="card-title">${this.escapeHtml(opp.title)}</h3>
          <div class="card-organizer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
            ${this.escapeHtml(organizer)}
          </div>
          <p class="card-desc">${this.escapeHtml(opp.description || "No description provided.")}</p>

          <div class="card-meta-row">
            <div class="meta-item">
              <span class="meta-label">Prize Pool</span>
              <span class="meta-val prize">${this.escapeHtml(prizeFormatted)}</span>
            </div>
            <div class="meta-item" style="text-align: right;">
              <span class="meta-label">Deadline</span>
              <span class="meta-val">${this.formatDate(deadlineVal)}</span>
            </div>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn-apply-primary" onclick="window.app.applyToOpportunity(${opp.id}, '${this.escapeHtml(applyUrl)}')">
            Apply Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </button>
          <button class="btn-detail-secondary" onclick="window.app.showOpportunityDetails(${opp.id})">
            Details
          </button>
        </div>
      </div>
    `;
  }

  // ── Bookmarking ───────────────────────────────────────────────────────────
  async loadBookmarks() {
    if (!window.authManager.isAuthenticated()) return;

    try {
      const data = await window.ApiClient.getBookmarks();
      this.bookmarks = new Set((data.bookmarks || []).map(b => b.opportunity_id));
      const badge = document.getElementById("savedCountBadge");
      if (badge) badge.textContent = this.bookmarks.size;
    } catch (err) {
      console.warn("Could not load bookmarks:", err);
    }
  }

  async toggleBookmark(oppId, btnEl) {
    if (!window.authManager.isAuthenticated()) {
      this.showToast("Please sign in with Google to save bookmarks", "info");
      window.authManager.signInWithGoogle();
      return;
    }

    const isCurrentlyBookmarked = this.bookmarks.has(oppId);

    // Optimistic UI update
    if (isCurrentlyBookmarked) {
      this.bookmarks.delete(oppId);
      btnEl.classList.remove("bookmarked");
      this.showToast("Removed from bookmarks", "info");
    } else {
      this.bookmarks.add(oppId);
      btnEl.classList.add("bookmarked");
      this.showToast("Saved to bookmarks!", "success");
    }

    const badge = document.getElementById("savedCountBadge");
    if (badge) badge.textContent = this.bookmarks.size;

    try {
      if (isCurrentlyBookmarked) {
        await window.ApiClient.removeBookmark(oppId);
      } else {
        await window.ApiClient.addBookmark(oppId);
      }
    } catch (err) {
      // Rollback on error
      if (isCurrentlyBookmarked) {
        this.bookmarks.add(oppId);
        btnEl.classList.add("bookmarked");
      } else {
        this.bookmarks.delete(oppId);
        btnEl.classList.remove("bookmarked");
      }
      this.showToast("Failed to update bookmark. Please try again.", "error");
    }
  }

  async renderBookmarks() {
    const grid = document.getElementById("bookmarksGrid");
    if (!grid) return;

    if (!window.authManager.isAuthenticated()) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">Sign In Required</div>
          <p class="empty-desc">Sign in with Google to view and sync your saved bookmarks across devices.</p>
          <button class="btn-google-login" style="margin-top: 16px;" onclick="window.authManager.signInWithGoogle()">
            Sign in with Google
          </button>
        </div>
      `;
      return;
    }

    try {
      const data = await window.ApiClient.getBookmarks();
      const bookmarkedOpps = (data.bookmarks || []).map(b => b.opp_opportunities).filter(Boolean);

      if (bookmarkedOpps.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-title">No Bookmarks Saved Yet</div>
            <p class="empty-desc">Explore live hackathons and click the bookmark button to save them here.</p>
            <button class="btn-apply-primary" style="margin-top: 16px;" onclick="window.app.switchTab('explore')">Explore Opportunities</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = bookmarkedOpps.map(opp => this.renderOpportunityCard(opp)).join("");
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><p class="empty-desc">Error loading bookmarks.</p></div>`;
    }
  }

  // ── Application Pipeline (Kanban) ─────────────────────────────────────────
  async loadApplications() {
    if (!window.authManager.isAuthenticated()) {
      const board = document.getElementById("kanbanBoard");
      if (board) {
        board.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-title">Career Pipeline Locked</div>
            <p class="empty-desc">Sign in with Google to track your hackathon and contest applications through every stage.</p>
            <button class="btn-google-login" style="margin-top: 16px;" onclick="window.authManager.signInWithGoogle()">
              Sign in with Google
            </button>
          </div>
        `;
      }
      return;
    }

    try {
      const data = await window.ApiClient.getApplications();
      this.applications = data.applications || [];
      this.renderKanban();
    } catch (err) {
      console.error("Could not load applications:", err);
    }
  }

  renderKanban() {
    const stages = ["saved", "applied", "in_review", "selected"];

    stages.forEach(stage => {
      const listEl = document.getElementById(`kanbanList_${stage}`);
      const countEl = document.getElementById(`kanbanCount_${stage}`);
      if (!listEl) return;

      const items = this.applications.filter(app => app.status === stage);
      if (countEl) countEl.textContent = items.length;

      if (items.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.8rem;">No opportunities here</div>`;
        return;
      }

      listEl.innerHTML = items.map(item => {
        const opp = item.opp_opportunities || {};
        return `
          <div class="kanban-card">
            <div class="kanban-card-title">${this.escapeHtml(opp.title || "Opportunity")}</div>
            <div class="kanban-card-org">${this.escapeHtml(opp.organizer || "")}</div>
            <div class="kanban-card-actions">
              <span style="font-size: 0.72rem; color: var(--text-muted);">Deadline: ${this.formatDate(opp.deadline)}</span>
              <select class="kanban-stage-select" onchange="window.app.changeApplicationStatus(${opp.id}, this.value)">
                <option value="saved" ${stage === 'saved' ? 'selected' : ''}>Saved</option>
                <option value="applied" ${stage === 'applied' ? 'selected' : ''}>Applied</option>
                <option value="in_review" ${stage === 'in_review' ? 'selected' : ''}>In Review</option>
                <option value="selected" ${stage === 'selected' ? 'selected' : ''}>Selected</option>
              </select>
            </div>
          </div>
        `;
      }).join("");
    });
  }

  async changeApplicationStatus(opportunityId, newStatus) {
    try {
      await window.ApiClient.updateApplication(opportunityId, newStatus);
      this.showToast(`Application moved to ${newStatus.replace('_', ' ')}`, "success");
      await this.loadApplications();
    } catch (err) {
      this.showToast("Failed to update status", "error");
    }
  }

  // ── Apply & Details ───────────────────────────────────────────────────────
  async applyToOpportunity(oppId, applyUrl) {
    // If logged in, automatically record into application pipeline as "applied"
    if (window.authManager.isAuthenticated()) {
      try {
        await window.ApiClient.updateApplication(oppId, "applied");
      } catch (e) {
        // Continue even if logging fails
      }
    }

    if (applyUrl && applyUrl.startsWith("http")) {
      window.open(applyUrl, "_blank", "noopener,noreferrer");
    } else {
      this.showToast("Application link not available", "error");
    }
  }

  async showOpportunityDetails(oppId) {
    const modal = document.getElementById("detailsModal");
    const content = document.getElementById("detailsModalContent");
    if (!modal || !content) return;

    content.innerHTML = `<div style="text-align:center; padding: 40px;"><p>Loading details...</p></div>`;
    this.openModal("detailsModal");

    try {
      const opp = await window.ApiClient.getOpportunity(oppId);
      content.innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          <span class="badge badge-hackathon">${this.escapeHtml(opp.opportunity_type || "Event")}</span>
          <span class="badge badge-mode">${this.escapeHtml(opp.mode || "Online")}</span>
          <span class="badge" style="background: rgba(16,185,129,0.15); color: #6EE7B7;">${this.escapeHtml(opp.status || "Open")}</span>
        </div>
        <h2 style="font-family: var(--font-display); font-size: 1.6rem; margin-bottom: 8px; color: #FFFFFF;">${this.escapeHtml(opp.title)}</h2>
        <div style="color: var(--accent-cyan); font-weight: 500; font-size: 0.95rem; margin-bottom: 20px;">Organized by ${this.escapeHtml(opp.organizer || "Verified Organizer")}</div>

        <div class="card-meta-row" style="margin-bottom: 20px;">
          <div class="meta-item">
            <span class="meta-label">Total Prize Pool</span>
            <span class="meta-val prize">${this.escapeHtml(opp.prize_pool || "Swag / Certificates")}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Registration Deadline</span>
            <span class="meta-val">${this.formatDate(opp.deadline)}</span>
          </div>
        </div>

        <h4 style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">About This Opportunity</h4>
        <div style="color: var(--text-secondary); line-height: 1.7; font-size: 0.95rem; margin-bottom: 24px; white-space: pre-line;">
          ${this.escapeHtml(opp.description || "No detailed description provided.")}
        </div>

        ${opp.eligibility ? `
          <h4 style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Eligibility</h4>
          <p style="color: var(--text-secondary); margin-bottom: 24px;">${this.escapeHtml(opp.eligibility)}</p>
        ` : ""}

        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button class="btn-apply-primary" style="flex: 1;" onclick="window.app.applyToOpportunity(${opp.id}, '${this.escapeHtml(opp.apply_url)}')">
            Go to Official Application Portal
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </button>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><p class="empty-desc">Error loading details.</p></div>`;
    }
  }

  // ── Community Submissions ─────────────────────────────────────────────────
  async handleOpportunitySubmission(formData) {
    const payload = {
      title: formData.get("title"),
      organizer: formData.get("organizer"),
      opportunity_type: formData.get("opportunity_type"),
      mode: formData.get("mode"),
      apply_url: formData.get("apply_url"),
      deadline: formData.get("deadline"),
      prize_pool: formData.get("prize_pool"),
      description: formData.get("description"),
      eligibility: formData.get("eligibility")
    };

    try {
      await window.ApiClient.submitOpportunity(payload);
      this.showToast("Opportunity submitted! It will appear once approved by admin.", "success");
      document.getElementById("opportunitySubmitForm")?.reset();
      this.switchTab("explore");
    } catch (err) {
      this.showToast(err.message || "Failed to submit opportunity", "error");
    }
  }

  // ── Admin Queue ───────────────────────────────────────────────────────────
  async loadAdminSubmissions() {
    const listEl = document.getElementById("adminSubmissionsList");
    if (!listEl) return;

    listEl.innerHTML = `<div style="text-align: center; padding: 30px;"><p>Loading submissions...</p></div>`;

    try {
      const data = await window.ApiClient.getAdminSubmissions("all");
      const subs = data.submissions || [];

      if (subs.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><p class="empty-desc">No community submissions waiting for review.</p></div>`;
        return;
      }

      listEl.innerHTML = subs.map(sub => `
        <div class="opportunity-card" style="margin-bottom: 16px;">
          <div class="card-top">
            <span class="badge badge-contest">${this.escapeHtml(sub.status)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${this.formatDate(sub.created_at)}</span>
          </div>
          <h3 class="card-title">${this.escapeHtml(sub.title)}</h3>
          <div class="card-organizer">${this.escapeHtml(sub.organizer)}</div>
          <p class="card-desc">${this.escapeHtml(sub.description)}</p>
          <div style="margin: 12px 0; font-size: 0.85rem;">
            <strong>Link:</strong> <a href="${this.escapeHtml(sub.apply_url)}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline;">${this.escapeHtml(sub.apply_url)}</a>
          </div>
          ${sub.status === 'pending' ? `
            <div style="display: flex; gap: 10px; margin-top: 14px;">
              <button class="btn-apply-primary" style="background: var(--accent-mint);" onclick="window.app.reviewAdminSubmission(${sub.id}, 'approve')">Approve & Publish</button>
              <button class="btn-detail-secondary" style="color: var(--accent-rose);" onclick="window.app.reviewAdminSubmission(${sub.id}, 'reject')">Reject</button>
            </div>
          ` : ""}
        </div>
      `).join("");
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state"><p class="empty-desc">Admin access required or request failed.</p></div>`;
    }
  }

  async reviewAdminSubmission(subId, action) {
    try {
      await window.ApiClient.reviewSubmission(subId, action);
      this.showToast(`Submission ${action}d successfully`, "success");
      await this.loadAdminSubmissions();
    } catch (err) {
      this.showToast("Review action failed: " + err.message, "error");
    }
  }

  // ── Hero Stats ────────────────────────────────────────────────────────────
  async updateHeroStats() {
    try {
      const data = await window.ApiClient.getOpportunities({ limit: 100 });
      const opps = data.opportunities || [];
      const totalCount = data.total || opps.length;

      const activeCountEl = document.getElementById("statActiveCount");
      if (activeCountEl) activeCountEl.textContent = totalCount;

      const deadlinesThisWeek = opps.filter(o => {
        const d = new Date(o.deadline);
        const now = new Date();
        const diff = (d - now) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      }).length;

      const urgentEl = document.getElementById("statUrgentCount");
      if (urgentEl) urgentEl.textContent = deadlinesThisWeek || "0";
    } catch (e) {
      // Graceful fallback
    }
  }

  // ── Modals & Toasts ───────────────────────────────────────────────────────
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add("open");
  }

  closeAllModals() {
    document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("open"));
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  calculateCountdown(deadlineStr) {
    if (!deadlineStr) return null;
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline - now;

    if (diffMs <= 0) return { text: "Closed", isUrgent: false };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days === 0) {
      return { text: `${hours}h left`, isUrgent: true };
    }
    if (days <= 3) {
      return { text: `${days}d ${hours}h left`, isUrgent: true };
    }
    return { text: `${days}d left`, isUrgent: false };
  }

  formatDate(dateStr) {
    if (!dateStr) return "Rolling";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  renderSkeletons(count = 6) {
    return Array.from({ length: count }).map(() => `
      <div class="opportunity-card" style="pointer-events: none;">
        <div>
          <div class="skeleton" style="height: 20px; width: 40%; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 24px; width: 85%; margin-bottom: 8px;"></div>
          <div class="skeleton" style="height: 16px; width: 50%; margin-bottom: 16px;"></div>
          <div class="skeleton" style="height: 48px; width: 100%; margin-bottom: 16px;"></div>
          <div class="skeleton" style="height: 44px; width: 100%; margin-bottom: 16px;"></div>
        </div>
        <div class="skeleton" style="height: 40px; width: 100%;"></div>
      </div>
    `).join("");
  }
}

// Instantiate on DOM ready
document.addEventListener("DOMContentLoaded", async () => {
  window.app = new OpportunityApp();
  if (window.AppConfig?.load) {
    await window.AppConfig.load();
  }
  if (window.authManager?.init) {
    await window.authManager.init();
  }
  window.app.init();
});
