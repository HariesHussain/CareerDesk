/**
 * OpportunityOS — Application Controller
 * =======================================
 * Manages view routing, live search/filtering, Internshala-style opportunity cards,
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
    this.setupCookieConsent();
    this.setupAuthSync();
    await this.loadExploreData();
    await this.updateHeroStats();
  }

  // ── Event Handlers & Routing ──────────────────────────────────────────────
  setupEventListeners() {
    // Desktop Navigation Tabs & Mobile Bottom Nav Items
    document.querySelectorAll(".nav-tab-item, .mobile-nav-item").forEach(tab => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });

    // Category Filter Pills (Internshala Style)
    document.querySelectorAll(".filter-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
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

    // Auth Buttons (Header & Hero)
    const btnGoogleLogin = document.getElementById("btnGoogleLogin");
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener("click", () => {
        window.authManager.signInWithGoogle();
      });
    }

    const btnHeroGoogle = document.getElementById("btnHeroGoogle");
    if (btnHeroGoogle) {
      btnHeroGoogle.addEventListener("click", () => {
        window.authManager.signInWithGoogle();
      });
    }

    const btnHeroExplore = document.getElementById("btnHeroExplore");
    if (btnHeroExplore) {
      btnHeroExplore.addEventListener("click", () => {
        this.switchTab("explore");
        const controls = document.getElementById("controlsSection");
        if (controls) {
          controls.scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    const btnHeroSubmit = document.getElementById("btnHeroSubmit");
    if (btnHeroSubmit) {
      btnHeroSubmit.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchTab("submit");
      });
    }

    const mobileNavAccountBtn = document.getElementById("mobileNavAccountBtn");
    if (mobileNavAccountBtn) {
      mobileNavAccountBtn.addEventListener("click", () => {
        if (window.authManager && window.authManager.isAuthenticated()) {
          const userDropdown = document.getElementById("userDropdown");
          if (userDropdown) userDropdown.classList.toggle("show");
        } else {
          window.authManager.signInWithGoogle();
        }
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

    // Delete Account (Right to Erasure) Trigger
    const btnDeleteAccount = document.getElementById("btnDeleteAccount");
    if (btnDeleteAccount) {
      btnDeleteAccount.addEventListener("click", async (e) => {
        e.preventDefault();
        const confirmed = window.confirm(
          "Permanent Account Deletion (Right to Erasure):\n\nAre you sure you want to permanently delete your profile, saved bookmarks, and application tracking history?\n\nIn accordance with DPDP & GDPR guidelines, this action is irreversible."
        );
        if (!confirmed) return;

        try {
          await window.ApiClient.deleteAccount();
          this.showToast("Your account and data have been permanently erased.", "info");
          if (window.authManager) {
            await window.authManager.signOut();
          }
        } catch (err) {
          this.showToast("Failed to erase account: " + (err.message || "Unknown error"), "error");
        }
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

  // ── Cookie & Storage Notice ───────────────────────────────────────────────
  setupCookieConsent() {
    const banner = document.getElementById("cookieConsentBanner");
    const btnAccept = document.getElementById("btnAcceptCookies");
    if (!banner) return;

    const consent = localStorage.getItem("opp_cookie_consent");
    if (!consent) {
      banner.style.display = "block";
    }

    if (btnAccept) {
      btnAccept.addEventListener("click", () => {
        localStorage.setItem("opp_cookie_consent", "accepted");
        banner.style.display = "none";
      });
    }
  }

  setupAuthSync() {
    window.authManager.onAuthChange((user) => {
      const loginWrapper = document.getElementById("guestAuthWrapper");
      const userMenu = document.getElementById("userProfileMenu");
      const adminTab = document.getElementById("adminNavTab");

      if (user) {
        if (loginWrapper) loginWrapper.style.display = "none";
        if (userMenu) {
          userMenu.style.display = "flex";
          const nameEl = document.getElementById("navUserName");
          const avatarEl = document.getElementById("navUserAvatar");
          const roleEl = document.getElementById("navUserRole");
          const defaultAvatarSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23008BDC'/%3E%3Cstop offset='100%25' stop-color='%23006BC7'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23FFFFFF' opacity='0.9'/%3E%3Cpath d='M20 85 C20 66 35 62 50 62 C65 62 80 66 80 85 Z' fill='%23FFFFFF' opacity='0.9'/%3E%3C/svg%3E";
          if (nameEl) nameEl.textContent = user.full_name || "Student";
          if (avatarEl) avatarEl.src = user.avatar_url || defaultAvatarSvg;
          if (roleEl) roleEl.textContent = user.role || "student";
        }
        if (adminTab) {
          adminTab.style.display = (user.role === "admin") ? "inline-flex" : "none";
        }
        this.loadBookmarks();
        this.loadApplications();
      } else {
        if (loginWrapper) loginWrapper.style.display = "flex";
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

    // Synchronize Desktop Nav Tab UI
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });

    // Synchronize Mobile Bottom Nav UI
    document.querySelectorAll(".mobile-nav-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });

    // Show/Hide View Panels
    document.querySelectorAll(".view-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `${tabId}View`);
    });

    // Refresh tab-specific data
    if (tabId === "explore") this.loadExploreData();
    if (tabId === "pipeline") this.loadApplications();
    if (tabId === "bookmarks") this.renderBookmarks();
    if (tabId === "admin") this.loadAdminSubmissions();

    // Scroll to top of main content smoothly
    const mainEl = document.getElementById("mainContent");
    if (mainEl && window.scrollY > 300) {
      mainEl.scrollIntoView({ behavior: "smooth" });
    }
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
        <div style="text-align: center; padding: 48px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-lg); grid-column: 1 / -1;">
          <h3 style="font-size: 1.2rem; margin-bottom: 8px;">Failed to load opportunities</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Could not connect to the backend server. Please check your connection or retry.</p>
          <button class="btn-apply-action" onclick="window.app.loadExploreData()">Retry</button>
        </div>
      `;
    }
  }

  renderOpportunities(list) {
    const grid = document.getElementById("opportunitiesGrid");
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; padding: 48px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-lg); grid-column: 1 / -1;">
          <svg style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">No opportunities found</h3>
          <p style="color: var(--text-muted);">Try selecting a different category or clearing search keywords.</p>
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
      prizeFormatted = "Prizes & Certificates";
    }

    const modeDisplay = mode === "in_person" || mode === "offline" ? "In-Person" : mode === "hybrid" ? "Hybrid" : "Online / Remote";

    return `
      <div class="opportunity-card" data-id="${opp.id}">
        <div>
          <!-- Header Row: Category Badge & Urgency / Hiring tags + Bookmark -->
          <div class="card-header-row">
            <div class="card-tags-wrapper">
              <span class="badge-tag badge-type-blue">${this.escapeHtml(category.toUpperCase())}</span>
              <span class="badge-tag badge-mode">${this.escapeHtml(modeDisplay)}</span>
              ${deadlineCountdown && deadlineCountdown.isUrgent ? `
                <span class="badge-tag badge-urgent">
                  <span class="dot"></span>
                  ${deadlineCountdown.text}
                </span>
              ` : `
                <span class="badge-tag badge-actively-hiring">
                  <span class="dot"></span>
                  Active
                </span>
              `}
            </div>
            <button class="btn-bookmark ${isBookmarked ? 'bookmarked' : ''}" 
                    title="${isBookmarked ? 'Remove Bookmark' : 'Bookmark Opportunity'}"
                    aria-label="${isBookmarked ? 'Remove bookmark for ' + this.escapeHtml(opp.title) : 'Bookmark ' + this.escapeHtml(opp.title)}"
                    onclick="window.app.toggleBookmark(${opp.id}, this)">
              <svg viewBox="0 0 24 24">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
          </div>

          <h3 class="card-title">${this.escapeHtml(opp.title)}</h3>
          <div class="card-organizer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            ${this.escapeHtml(organizer)}
          </div>
          <p class="card-description">${this.escapeHtml(opp.description || "No description provided.")}</p>

          <!-- Metadata List with Icons (Internshala <ul> Style) -->
          <ul class="card-metadata-list">
            <li class="meta-item-row">
              <div class="meta-item-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <span>Prize / Stipend</span>
              </div>
              <span class="meta-item-val prize">${this.escapeHtml(prizeFormatted)}</span>
            </li>
            <li class="meta-item-row">
              <div class="meta-item-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Deadline</span>
              </div>
              <span class="meta-item-val">${this.formatDate(deadlineVal)}</span>
            </li>
          </ul>
        </div>

        <!-- Footer Actions Row -->
        <div class="card-actions-row">
          <button class="btn-card-details" 
                  aria-label="View details for ${this.escapeHtml(opp.title)}"
                  onclick="window.app.showOpportunityDetails(${opp.id})">
            View details
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button class="btn-apply-action" 
                  aria-label="Apply to ${this.escapeHtml(opp.title)} on official portal"
                  onclick="window.app.applyToOpportunity(${opp.id}, '${this.escapeHtml(applyUrl)}')">
            Apply Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
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
      this.updateBookmarkBadges();
    } catch (err) {
      console.warn("Could not load bookmarks:", err);
    }
  }

  updateBookmarkBadges() {
    const badge = document.getElementById("savedCountBadge");
    if (badge) badge.textContent = this.bookmarks.size;

    const mobileBadge = document.getElementById("mobileSavedBadge");
    if (mobileBadge) {
      mobileBadge.textContent = this.bookmarks.size;
      mobileBadge.style.display = this.bookmarks.size > 0 ? "flex" : "none";
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

    this.updateBookmarkBadges();

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
      this.updateBookmarkBadges();
      this.showToast("Failed to update bookmark. Please try again.", "error");
    }
  }

  async renderBookmarks() {
    const grid = document.getElementById("bookmarksGrid");
    if (!grid) return;

    if (!window.authManager.isAuthenticated()) {
      grid.innerHTML = `
        <div style="text-align: center; padding: 48px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-lg); grid-column: 1 / -1;">
          <h3 style="font-size: 1.2rem; margin-bottom: 8px;">Sign In Required</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px;">Sign in with Google to view and sync your saved bookmarks across devices.</p>
          <button class="btn-signup-google" style="margin: 0 auto; border: 1px solid #D1D5DB;" onclick="window.authManager.signInWithGoogle()">
            Continue with Google
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
          <div style="text-align: center; padding: 48px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-lg); grid-column: 1 / -1;">
            <h3 style="font-size: 1.2rem; margin-bottom: 8px;">No Bookmarks Saved Yet</h3>
            <p style="color: var(--text-muted); margin-bottom: 16px;">Explore live hackathons and click the bookmark button to save them here.</p>
            <button class="btn-apply-action" onclick="window.app.switchTab('explore')">Explore Opportunities</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = bookmarkedOpps.map(opp => this.renderOpportunityCard(opp)).join("");
    } catch (err) {
      grid.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">Error loading bookmarks.</div>`;
    }
  }

  // ── Application Pipeline (Kanban) ─────────────────────────────────────────
  async loadApplications() {
    if (!window.authManager.isAuthenticated()) {
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
        listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.8rem;">No items in this stage</div>`;
        return;
      }

      listEl.innerHTML = items.map(item => {
        const opp = item.opp_opportunities || {};
        return `
          <div class="kanban-card">
            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">${this.escapeHtml(opp.title || "Opportunity")}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 10px;">${this.escapeHtml(opp.organizer || "")}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="font-size: 0.75rem; color: var(--text-secondary);">${this.formatDate(opp.deadline)}</span>
              <select style="font-size: 0.78rem; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: #FFFFFF;" onchange="window.app.changeApplicationStatus(${opp.id}, this.value)">
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
    if (window.authManager.isAuthenticated()) {
      try {
        await window.ApiClient.updateApplication(oppId, "applied");
      } catch (e) {
        // Continue even if recording fails
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

    content.innerHTML = `<div style="text-align:center; padding: 40px;"><p>Loading opportunity details...</p></div>`;
    this.openModal("detailsModal");

    try {
      const opp = await window.ApiClient.getOpportunity(oppId);
      content.innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
          <span class="badge-tag badge-type-blue">${this.escapeHtml((opp.opportunity_type || "Event").toUpperCase())}</span>
          <span class="badge-tag badge-mode">${this.escapeHtml(opp.mode || "Online")}</span>
          <span class="badge-tag badge-actively-hiring"><span class="dot"></span> ${this.escapeHtml(opp.status || "Open")}</span>
        </div>
        <h2 style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800; margin-bottom: 6px; color: var(--text-primary);">${this.escapeHtml(opp.title)}</h2>
        <div style="color: var(--brand-primary); font-weight: 600; font-size: 0.95rem; margin-bottom: 20px;">Organized by ${this.escapeHtml(opp.organizer || "Verified Organizer")}</div>

        <div class="card-metadata-list" style="margin-bottom: 20px;">
          <div class="meta-item-row" style="margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Total Prize Pool:</span>
            <span class="meta-item-val prize">${this.escapeHtml(opp.prize_pool || "Prizes / Certificates")}</span>
          </div>
          <div class="meta-item-row">
            <span style="color: var(--text-muted);">Registration Deadline:</span>
            <span class="meta-item-val">${this.formatDate(opp.deadline)}</span>
          </div>
        </div>

        <h4 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">About This Opportunity</h4>
        <div style="color: var(--text-secondary); line-height: 1.7; font-size: 0.92rem; margin-bottom: 20px; white-space: pre-line;">
          ${this.escapeHtml(opp.description || "No detailed description provided.")}
        </div>

        ${opp.eligibility ? `
          <h4 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;">Eligibility</h4>
          <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 24px;">${this.escapeHtml(opp.eligibility)}</p>
        ` : ""}

        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button class="btn-apply-action" style="flex: 1; justify-content: center; height: 46px;" onclick="window.app.applyToOpportunity(${opp.id}, '${this.escapeHtml(opp.apply_url)}')">
            Go to Official Registration Portal
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </button>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">Error loading details.</div>`;
    }
  }

  // ── Community Submissions ─────────────────────────────────────────────────
  async handleOpportunitySubmission(formData) {
    if (!formData.get("consent")) {
      this.showToast("Please certify event authenticity and accept the Terms & Privacy Policy.", "error");
      return;
    }

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

    listEl.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);"><p>Loading submissions...</p></div>`;

    try {
      const data = await window.ApiClient.getAdminSubmissions("all");
      const subs = data.submissions || [];

      if (subs.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);"><p>No community submissions waiting for review.</p></div>`;
        return;
      }

      listEl.innerHTML = subs.map(sub => `
        <div class="opportunity-card" style="margin-bottom: 16px;">
          <div class="card-header-row">
            <span class="badge-tag badge-type-blue">${this.escapeHtml(sub.status.toUpperCase())}</span>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${this.formatDate(sub.created_at)}</span>
          </div>
          <h3 class="card-title">${this.escapeHtml(sub.title)}</h3>
          <div class="card-organizer">${this.escapeHtml(sub.organizer)}</div>
          <p class="card-description">${this.escapeHtml(sub.description)}</p>
          <div style="margin: 12px 0; font-size: 0.88rem;">
            <strong>Link:</strong> <a href="${this.escapeHtml(sub.apply_url)}" target="_blank" style="color: var(--brand-primary); text-decoration: underline;">${this.escapeHtml(sub.apply_url)}</a>
          </div>
          ${sub.status === 'pending' ? `
            <div style="display: flex; gap: 10px; margin-top: 14px;">
              <button class="btn-apply-action" style="background: var(--accent-green);" onclick="window.app.reviewAdminSubmission(${sub.id}, 'approve')">Approve &amp; Publish</button>
              <button class="btn-card-details" style="color: #DC2626;" onclick="window.app.reviewAdminSubmission(${sub.id}, 'reject')">Reject</button>
            </div>
          ` : ""}
        </div>
      `).join("");
    } catch (err) {
      listEl.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);"><p>Admin access required or request failed.</p></div>`;
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
      if (activeCountEl) activeCountEl.textContent = `${totalCount}+`;

      const heroActive = document.getElementById("heroActiveBadge");
      if (heroActive) heroActive.textContent = `${totalCount}+ Verified`;

      const deadlinesThisWeek = opps.filter(o => {
        const d = new Date(o.deadline);
        const now = new Date();
        const diff = (d - now) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      }).length;

      const urgentEl = document.getElementById("statUrgentCount");
      if (urgentEl) urgentEl.textContent = deadlinesThisWeek || "0";

      // Dynamically calculate live aggregate prize pool from fetched opportunities
      let totalPrize = 0;
      opps.forEach(o => {
        if (o.prize_inr && !isNaN(o.prize_inr)) {
          totalPrize += Number(o.prize_inr);
        }
      });

      let prizeFormatted = "₹1.8 Cr+";
      if (totalPrize >= 10000000) {
        prizeFormatted = `₹${(totalPrize / 10000000).toFixed(1)} Cr+`;
      } else if (totalPrize >= 100000) {
        prizeFormatted = `₹${(totalPrize / 100000).toFixed(1)} Lakhs+`;
      }

      const prizeEl = document.getElementById("statPrizeCount");
      if (prizeEl && totalPrize > 0) {
        prizeEl.textContent = prizeFormatted;
      }

      const heroPrize = document.getElementById("heroPrizeBadge");
      if (heroPrize && totalPrize > 0) {
        heroPrize.textContent = prizeFormatted;
      }
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
      return { text: `${days}d left`, isUrgent: true };
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
