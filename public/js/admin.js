/**
 * CareerDesk — Admin Console Manager
 * ====================================
 * MNC-grade Governance, Platform Telemetry, User Identity Moderation,
 * Permanent Gmail Blacklist, Brabble Live Sync & Broadcast Announcements.
 */

class AdminConsoleManager {
  constructor() {
    this.activeTab = "overview";
    this.users = [];
    this.metrics = null;
    this.selectedUserId = null;
    this.selectedUserEmail = null;
    this.selectedUserName = null;
    this._searchDebounceTimer = null;
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Top exit button to return to student view
    const btnExit = document.getElementById("btnExitAdminConsole");
    if (btnExit) {
      btnExit.addEventListener("click", () => this.exitConsole());
    }

    // Top live sync trigger
    const btnTopSync = document.getElementById("btnAdminTriggerSyncTop");
    if (btnTopSync) {
      btnTopSync.addEventListener("click", () => this.triggerSync());
    }

    // Admin Tabs Navigation
    document.querySelectorAll(".admin-nav-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        const tabTarget = e.currentTarget.dataset.tab;
        if (tabTarget) this.switchTab(tabTarget);
      });
    });

    // Users Search & Filters
    const userSearchInput = document.getElementById("adminUserSearch");
    if (userSearchInput) {
      userSearchInput.addEventListener("input", (e) => {
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
          this.loadUsers();
        }, 300);
      });
    }

    const roleFilter = document.getElementById("adminUserRoleFilter");
    if (roleFilter) {
      roleFilter.addEventListener("change", () => this.loadUsers());
    }

    const statusFilter = document.getElementById("adminUserStatusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => this.loadUsers());
    }

    const btnRefreshUsers = document.getElementById("btnRefreshUsers");
    if (btnRefreshUsers) {
      btnRefreshUsers.addEventListener("click", () => this.loadUsers());
    }

    // Sync trigger button in sync panel
    const btnTriggerSync = document.getElementById("btnTriggerBrabbleSync");
    if (btnTriggerSync) {
      btnTriggerSync.addEventListener("click", () => this.triggerSync());
    }

    // Announcement form save
    const announcementForm = document.getElementById("adminAnnouncementForm");
    if (announcementForm) {
      announcementForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveAnnouncement();
      });
    }

    // Ban confirmation modal actions
    const btnConfirmBan = document.getElementById("btnConfirmBanUser");
    if (btnConfirmBan) {
      btnConfirmBan.addEventListener("click", () => this.executeBanUser());
    }
    const btnCancelBan = document.getElementById("btnCancelBanUser");
    if (btnCancelBan) {
      btnCancelBan.addEventListener("click", () => this.closeBanModal());
    }

    // Delete user confirmation modal actions
    const btnConfirmDelete = document.getElementById("btnConfirmDeleteUser");
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener("click", () => this.executeDeleteUser());
    }
    const btnCancelDelete = document.getElementById("btnCancelDeleteUser");
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener("click", () => this.closeDeleteModal());
    }
  }

  openConsole() {
    // Verify admin role
    const profile = window.authManager?.getUserData() || {};
    if (profile.role !== "admin") {
      window.app?.showToast("Access denied: Administrator privileges required.", "error");
      return;
    }

    // Hide other views and show admin view
    document.querySelectorAll(".view-panel").forEach(panel => {
      panel.style.display = "none";
      panel.classList.remove("active");
    });

    const adminView = document.getElementById("adminView");
    if (adminView) {
      adminView.style.display = "block";
      adminView.classList.add("active");
    }

    // Update workspace tab indicator
    const activeLabel = document.getElementById("workspaceActiveTabLabel");
    if (activeLabel) {
      activeLabel.textContent = "👑 Enterprise Admin Console";
      activeLabel.style.color = "#7C3AED";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    this.switchTab(this.activeTab || "overview");
  }

  exitConsole() {
    const adminView = document.getElementById("adminView");
    if (adminView) {
      adminView.style.display = "none";
      adminView.classList.remove("active");
    }

    if (window.app && typeof window.app.switchTab === "function") {
      window.app.switchTab("explore");
    } else {
      const exploreView = document.getElementById("exploreView");
      if (exploreView) {
        exploreView.style.display = "block";
        exploreView.classList.add("active");
      }
      const activeLabel = document.getElementById("workspaceActiveTabLabel");
      if (activeLabel) {
        activeLabel.textContent = "Explore Opportunities";
        activeLabel.style.color = "var(--brand-primary)";
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update active tab buttons
    document.querySelectorAll(".admin-nav-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    // Update active panels
    document.querySelectorAll(".admin-tab-panel").forEach(panel => {
      panel.style.display = "none";
    });

    const targetPanel = document.getElementById(`adminPanel_${tabName}`);
    if (targetPanel) {
      targetPanel.style.display = "block";
    }

    // Load data for active tab
    if (tabName === "overview") this.loadMetrics();
    else if (tabName === "users") this.loadUsers();
    else if (tabName === "blacklist") this.loadBannedEmails();
    else if (tabName === "submissions") this.loadSubmissions();
    else if (tabName === "sync") this.loadSyncInfo();
    else if (tabName === "announcement") this.loadAnnouncement();
    else if (tabName === "audit") this.loadAuditLogs();
  }

  // ── 1. Overview & Metrics ──────────────────────────────────────────────────
  async loadMetrics() {
    try {
      const res = await window.ApiClient.getAdminMetrics();
      if (res && res.metrics) {
        this.metrics = res.metrics;
        this.renderMetrics(res.metrics);
      }
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
      window.app?.showToast("Failed to fetch live admin metrics.", "error");
    }
  }

  renderMetrics(m) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val !== undefined && val !== null ? val : "0";
    };

    setVal("kpiTotalUsers", m.total_users);
    setVal("kpiActive24h", `${m.active_users_24h} active in 24h`);
    setVal("kpiStudentsCount", m.students_count);
    setVal("kpiAdminsCount", m.admins_count);
    setVal("kpiUniqueColleges", m.unique_colleges);
    setVal("kpiTotalOpps", m.total_opportunities);
    setVal("kpiTotalApps", m.total_applications);
    setVal("kpiTotalBookmarks", m.total_bookmarks);
    setVal("kpiBannedUsers", m.banned_count);
    setVal("kpiBannedEmails", m.total_banned_emails);
    setVal("kpiPendingSubmissions", m.pending_submissions);

    // Sync status badge
    const syncStatusEl = document.getElementById("kpiLastSyncStatus");
    const syncTimeEl = document.getElementById("kpiLastSyncTime");
    if (m.last_sync) {
      if (syncStatusEl) {
        const isSuccess = m.last_sync.status === "success";
        syncStatusEl.textContent = isSuccess ? "Healthy / Up to Date" : "Sync Error";
        syncStatusEl.className = `admin-badge ${isSuccess ? "badge-success" : "badge-danger"}`;
      }
      if (syncTimeEl) {
        const d = new Date(m.last_sync.started_at);
        syncTimeEl.textContent = `Last run: ${d.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })} (${m.last_sync.records_inserted || 0} added)`;
      }
    } else {
      if (syncStatusEl) syncStatusEl.textContent = "Never Synced";
      if (syncTimeEl) syncTimeEl.textContent = "No log found";
    }
  }

  // ── 2. User Governance & Moderation ────────────────────────────────────────
  async loadUsers() {
    const tableBody = document.getElementById("adminUsersTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" class="admin-table-loading">Loading registered users...</td></tr>`;
    }

    const q = (document.getElementById("adminUserSearch")?.value || "").trim();
    const role = document.getElementById("adminUserRoleFilter")?.value || "all";
    const status = document.getElementById("adminUserStatusFilter")?.value || "all";

    try {
      const res = await window.ApiClient.getAdminUsers({ q, role, status });
      this.users = res?.users || [];
      this.renderUsers(this.users);
    } catch (err) {
      console.error("Failed to load users:", err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="admin-table-error">Failed to load user records.</td></tr>`;
      }
    }
  }

  renderUsers(users) {
    const tableBody = document.getElementById("adminUsersTableBody");
    const countEl = document.getElementById("adminUsersCountBadge");
    if (countEl) countEl.textContent = `${users.length} users`;

    if (!tableBody) return;

    if (!users.length) {
      tableBody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">No users match your search criteria.</td></tr>`;
      return;
    }

    const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23008BDC'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23FFFFFF'/%3E%3Cpath d='M20 85 C20 66 35 62 50 62 C65 62 80 66 80 85 Z' fill='%23FFFFFF'/%3E%3C/svg%3E";

    tableBody.innerHTML = users.map(u => {
      const isBanned = Boolean(u.is_banned);
      const isAdmin = u.role === "admin";
      const regDate = u.created_at ? new Date(u.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—";
      const lastActive = u.last_seen_at ? this.formatRelativeTime(u.last_seen_at) : "Never";

      const collegeInfo = [u.college_name, u.degree, u.graduation_year].filter(Boolean).join(" · ") || "Not specified";

      return `
        <tr class="${isBanned ? 'row-banned' : ''}">
          <td class="col-user">
            <div class="admin-user-cell">
              <img class="admin-user-avatar" src="${u.avatar_url || defaultAvatar}" alt="${this.escapeHtml(u.full_name || 'User')}" onerror="this.src='${defaultAvatar}'">
              <div class="admin-user-names">
                <span class="admin-user-fullname">${this.escapeHtml(u.full_name || "Anonymous")}</span>
                <span class="admin-user-email">${this.escapeHtml(u.email || "No email")}</span>
              </div>
            </div>
          </td>
          <td class="col-college">
            <span class="admin-college-text" title="${this.escapeHtml(collegeInfo)}">
              ${this.escapeHtml(collegeInfo)}
            </span>
          </td>
          <td class="col-date">${regDate}</td>
          <td class="col-date">${lastActive}</td>
          <td class="col-role">
            <span class="admin-badge ${isAdmin ? 'badge-role-admin' : 'badge-role-student'}">
              ${isAdmin ? '👑 Admin' : 'Student'}
            </span>
          </td>
          <td class="col-status">
            ${isBanned ? `
              <span class="admin-badge badge-danger" title="${this.escapeHtml(u.banned_reason || 'Banned by admin')}">
                🚫 Banned
              </span>
            ` : `
              <span class="admin-badge badge-success">
                ● Active
              </span>
            `}
          </td>
          <td class="col-actions">
            <div class="admin-action-buttons">
              ${!isBanned ? `
                <button class="btn-action-icon btn-ban" title="Ban user and block Gmail" onclick="window.adminConsole.openBanModal('${u.id}', '${this.escapeJs(u.full_name || '')}', '${this.escapeJs(u.email || '')}')">
                  🚫 Ban
                </button>
              ` : `
                <button class="btn-action-icon btn-unban" title="Reinstate user" onclick="window.adminConsole.unbanUser('${u.id}')">
                  ✅ Unban
                </button>
              `}
              
              <button class="btn-action-icon btn-role" title="${isAdmin ? 'Demote to Student' : 'Promote to Admin'}" onclick="window.adminConsole.toggleRole('${u.id}', '${u.role}')">
                ${isAdmin ? 'Demote' : 'Make Admin'}
              </button>

              <button class="btn-action-icon btn-delete" title="Hard delete account" onclick="window.adminConsole.openDeleteModal('${u.id}', '${this.escapeJs(u.full_name || '')}', '${this.escapeJs(u.email || '')}')">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ── Ban Modal Workflow ─────────────────────────────────────────────────────
  openBanModal(userId, name, email) {
    this.selectedUserId = userId;
    this.selectedUserName = name;
    this.selectedUserEmail = email;

    const modal = document.getElementById("adminBanModal");
    const nameEl = document.getElementById("banModalUserName");
    const emailEl = document.getElementById("banModalUserEmail");
    const reasonInput = document.getElementById("banModalReason");

    if (nameEl) nameEl.textContent = name || "User";
    if (emailEl) emailEl.textContent = email;
    if (reasonInput) reasonInput.value = "Violation of platform terms and guidelines.";

    if (modal) modal.classList.add("open");
  }

  closeBanModal() {
    const modal = document.getElementById("adminBanModal");
    if (modal) modal.classList.remove("open");
    this.selectedUserId = null;
  }

  async executeBanUser() {
    if (!this.selectedUserId) return;
    const reason = (document.getElementById("banModalReason")?.value || "").trim();

    try {
      const res = await window.ApiClient.banUser(this.selectedUserId, reason);
      window.app?.showToast(res.message || "User suspended and Gmail blacklisted.", "success");
      this.closeBanModal();
      this.loadUsers();
      this.loadMetrics();
    } catch (err) {
      console.error("Ban error:", err);
      window.app?.showToast(err.message || "Failed to ban user.", "error");
    }
  }

  async unbanUser(userId) {
    if (!confirm("Are you sure you want to unban and reinstate this user?")) return;

    try {
      const res = await window.ApiClient.unbanUser(userId);
      window.app?.showToast(res.message || "User reinstated successfully.", "success");
      this.loadUsers();
      this.loadMetrics();
    } catch (err) {
      console.error("Unban error:", err);
      window.app?.showToast(err.message || "Failed to unban user.", "error");
    }
  }

  // ── Delete User Modal Workflow ─────────────────────────────────────────────
  openDeleteModal(userId, name, email) {
    this.selectedUserId = userId;
    this.selectedUserName = name;
    this.selectedUserEmail = email;

    const modal = document.getElementById("adminDeleteUserModal");
    const nameEl = document.getElementById("deleteModalUserName");
    const emailEl = document.getElementById("deleteModalUserEmail");

    if (nameEl) nameEl.textContent = name || "User";
    if (emailEl) emailEl.textContent = email;

    const blacklistCheck = document.getElementById("deleteModalBlacklistCheck");
    if (blacklistCheck) blacklistCheck.checked = true;

    if (modal) modal.classList.add("open");
  }

  closeDeleteModal() {
    const modal = document.getElementById("adminDeleteUserModal");
    if (modal) modal.classList.remove("open");
    this.selectedUserId = null;
  }

  async executeDeleteUser() {
    if (!this.selectedUserId) return;
    const blacklist = document.getElementById("deleteModalBlacklistCheck")?.checked ?? true;

    try {
      const res = await window.ApiClient.deleteUserAccount(this.selectedUserId, blacklist);
      window.app?.showToast(res.message || "User permanently deleted.", "success");
      this.closeDeleteModal();
      this.loadUsers();
      this.loadMetrics();
    } catch (err) {
      console.error("Delete error:", err);
      window.app?.showToast(err.message || "Failed to delete user.", "error");
    }
  }

  async toggleRole(userId, currentRole) {
    const newRole = currentRole === "admin" ? "student" : "admin";
    const actionDesc = newRole === "admin" ? "promote this user to Administrator" : "demote this user to Student";
    if (!confirm(`Are you sure you want to ${actionDesc}?`)) return;

    try {
      const res = await window.ApiClient.updateUserRole(userId, newRole);
      window.app?.showToast(res.message || `Role updated to ${newRole}.`, "success");
      this.loadUsers();
      this.loadMetrics();
    } catch (err) {
      console.error("Role change error:", err);
      window.app?.showToast(err.message || "Failed to change user role.", "error");
    }
  }

  // ── 3. Banned Emails Blacklist ─────────────────────────────────────────────
  async loadBannedEmails() {
    const tableBody = document.getElementById("adminBlacklistTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" class="admin-table-loading">Loading blocked emails...</td></tr>`;
    }

    try {
      const res = await window.ApiClient.getBannedEmails();
      const list = res?.banned_emails || [];
      this.renderBannedEmails(list);
    } catch (err) {
      console.error("Failed to load banned emails:", err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="5" class="admin-table-error">Failed to fetch blacklisted emails.</td></tr>`;
      }
    }
  }

  renderBannedEmails(list) {
    const tableBody = document.getElementById("adminBlacklistTableBody");
    const countEl = document.getElementById("adminBlacklistCountBadge");
    if (countEl) countEl.textContent = `${list.length} blocked`;

    if (!tableBody) return;

    if (!list.length) {
      tableBody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">No emails currently blacklisted. All Google accounts in good standing.</td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
      return `
        <tr>
          <td><strong style="color: #EF4444;">${this.escapeHtml(item.email)}</strong></td>
          <td>${this.escapeHtml(item.reason || "Suspended by admin")}</td>
          <td>${this.escapeHtml(item.banned_by || "System")}</td>
          <td>${dateStr}</td>
          <td>
            <button class="btn-outline-subtle" style="color: #10B981; padding: 4px 10px; font-size: 0.8rem;" onclick="window.adminConsole.removeBannedEmail('${this.escapeJs(item.email)}')">
              Unblock Email
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  async removeBannedEmail(email) {
    if (!confirm(`Are you sure you want to unblock ${email}? They will be able to sign in via Google again.`)) return;

    try {
      const res = await window.ApiClient.removeBannedEmail(email);
      window.app?.showToast(res.message || "Email unblocked.", "success");
      this.loadBannedEmails();
      this.loadMetrics();
    } catch (err) {
      console.error("Unblock error:", err);
      window.app?.showToast(err.message || "Failed to unblock email.", "error");
    }
  }

  // ── 4. Community Event Moderation ──────────────────────────────────────────
  async loadSubmissions() {
    const listEl = document.getElementById("adminSubmissionsList");
    if (listEl) {
      listEl.innerHTML = `<div class="admin-table-loading">Loading pending event submissions...</div>`;
    }

    try {
      const res = await window.ApiClient.getAdminSubmissions("pending");
      const subs = res?.submissions || [];
      this.renderSubmissions(subs);
    } catch (err) {
      console.error("Failed to load submissions:", err);
      if (listEl) {
        listEl.innerHTML = `<div class="admin-table-error">Failed to load community submissions.</div>`;
      }
    }
  }

  renderSubmissions(subs) {
    const listEl = document.getElementById("adminSubmissionsList");
    const countBadge = document.getElementById("adminSubmissionsCountBadge");
    if (countBadge) countBadge.textContent = `${subs.length} pending`;

    if (!listEl) return;

    if (!subs.length) {
      listEl.innerHTML = `
        <div class="admin-empty-state">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🎉</div>
          <h4 style="font-weight: 700; margin-bottom: 4px;">Queue is clear!</h4>
          <p style="color: var(--text-muted); font-size: 0.88rem;">All student tech fest and hackathon submissions have been reviewed.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = subs.map(s => {
      const submitter = s.opp_profiles || {};
      const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "";

      return `
        <div class="admin-submission-card">
          <div class="admin-sub-header">
            <div>
              <span class="admin-badge badge-role-student">${this.escapeHtml(s.category.toUpperCase())}</span>
              <span class="admin-badge" style="background: #F3F4F6;">${this.escapeHtml(s.mode || 'ONLINE')}</span>
              <h3 class="admin-sub-title">${this.escapeHtml(s.title)}</h3>
              <div class="admin-sub-meta">
                <span>🏛️ Organiser: <strong>${this.escapeHtml(s.organiser || 'College Lead')}</strong></span>
                <span>📅 Deadline: ${s.deadline_utc ? new Date(s.deadline_utc).toLocaleDateString() : 'Rolling'}</span>
                <span>🏆 Prize: ${this.escapeHtml(s.prize_label || 'Trophy / Certificate')}</span>
                <span>👤 Submitted by: ${this.escapeHtml(submitter.full_name || submitter.email || 'Student')} (${dateStr})</span>
              </div>
            </div>
            <div class="admin-sub-actions">
              <a href="${this.escapeHtml(s.official_url)}" target="_blank" rel="noopener noreferrer" class="btn-outline-subtle" style="font-size: 0.8rem; padding: 6px 12px;">
                🔗 Visit Link
              </a>
              <button class="btn-apply-action" style="padding: 6px 14px; font-size: 0.82rem;" onclick="window.adminConsole.approveSubmission(${s.id})">
                ✅ Approve &amp; Publish
              </button>
              <button class="btn-profile-danger" style="padding: 6px 12px; font-size: 0.82rem;" onclick="window.adminConsole.rejectSubmission(${s.id})">
                ❌ Reject
              </button>
            </div>
          </div>
          <p class="admin-sub-desc">${this.escapeHtml(s.description || 'No description provided.')}</p>
        </div>
      `;
    }).join("");
  }

  async approveSubmission(id) {
    if (!confirm("Approve this event and instantly publish it live across India?")) return;

    try {
      const res = await window.ApiClient.approveSubmission(id);
      window.app?.showToast(res.message || "Event approved and published!", "success");
      this.loadSubmissions();
      this.loadMetrics();
    } catch (err) {
      console.error("Approve error:", err);
      window.app?.showToast(err.message || "Failed to approve submission.", "error");
    }
  }

  async rejectSubmission(id) {
    const reason = prompt("Enter a brief reason for rejecting this listing (optional):", "Incomplete details or invalid official registration URL");
    if (reason === null) return; // User cancelled prompt

    try {
      const res = await window.ApiClient.rejectSubmission(id, reason);
      window.app?.showToast(res.message || "Submission rejected.", "info");
      this.loadSubmissions();
      this.loadMetrics();
    } catch (err) {
      console.error("Reject error:", err);
      window.app?.showToast(err.message || "Failed to reject submission.", "error");
    }
  }

  // ── 5. Brabble Ingestion Sync Orchestration ─────────────────────────────────
  async loadSyncInfo() {
    const logsBody = document.getElementById("adminSyncLogsTableBody");
    if (logsBody) {
      logsBody.innerHTML = `<tr><td colspan="6" class="admin-table-loading">Loading recent sync executions...</td></tr>`;
    }

    try {
      const res = await window.ApiClient.getAdminSyncHistory();
      const logs = res?.logs || [];
      this.renderSyncLogs(logs);
    } catch (err) {
      console.error("Failed to load sync logs:", err);
      if (logsBody) {
        logsBody.innerHTML = `<tr><td colspan="6" class="admin-table-error">Failed to fetch sync logs.</td></tr>`;
      }
    }
  }

  renderSyncLogs(logs) {
    const logsBody = document.getElementById("adminSyncLogsTableBody");
    if (!logsBody) return;

    if (!logs.length) {
      logsBody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">No sync logs recorded yet.</td></tr>`;
      return;
    }

    logsBody.innerHTML = logs.map(l => {
      const isSuccess = l.status === "success";
      const start = l.started_at ? new Date(l.started_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" }) : "—";
      const end = l.finished_at ? new Date(l.finished_at) : null;
      const duration = end && l.started_at ? `${Math.round((end - new Date(l.started_at)) / 1000)}s` : "—";

      return `
        <tr>
          <td>${start}</td>
          <td>
            <span class="admin-badge ${isSuccess ? 'badge-success' : 'badge-danger'}">
              ${isSuccess ? 'Success' : (l.status || 'Failed')}
            </span>
          </td>
          <td><strong>${l.records_fetched || 0}</strong></td>
          <td><span style="color: #10B981; font-weight: 600;">+${l.records_inserted || 0}</span></td>
          <td><span style="color: #008BDC; font-weight: 600;">${l.records_updated || 0}</span></td>
          <td>${duration}</td>
        </tr>
      `;
    }).join("");
  }

  async triggerSync() {
    const btn = document.getElementById("btnTriggerBrabbleSync");
    const topBtn = document.getElementById("btnAdminTriggerSyncTop");

    const setBusy = (isBusy) => {
      [btn, topBtn].forEach(b => {
        if (b) {
          b.disabled = isBusy;
          if (isBusy) {
            b.dataset.origHtml = b.innerHTML;
            b.innerHTML = `
              <div class="spinner" style="width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; margin-right: 6px;"></div>
              Syncing Catalog...
            `;
          } else {
            b.innerHTML = b.dataset.origHtml || "Trigger Live Sync Now";
          }
        }
      });
    };

    setBusy(true);

    try {
      const res = await window.ApiClient.triggerAdminSync();
      const s = res?.summary || {};
      window.app?.showToast(`Sync complete! ${s.records_inserted || 0} new, ${s.records_updated || 0} updated.`, "success");
      this.loadMetrics();
      this.loadSyncInfo();
    } catch (err) {
      console.error("Live sync failed:", err);
      window.app?.showToast(err.message || "Sync execution failed. Check server logs.", "error");
    } finally {
      setBusy(false);
    }
  }

  // ── 6. Site-Wide Announcement Manager ──────────────────────────────────────
  async loadAnnouncement() {
    try {
      const res = await window.ApiClient.getAdminAnnouncement();
      const a = res?.announcement || {};

      const checkEl = document.getElementById("adminAnnouncementActive");
      const msgEl = document.getElementById("adminAnnouncementMsg");
      const typeEl = document.getElementById("adminAnnouncementType");
      const urlEl = document.getElementById("adminAnnouncementUrl");
      const labelEl = document.getElementById("adminAnnouncementLabel");

      if (checkEl) checkEl.checked = Boolean(a.is_active);
      if (msgEl) msgEl.value = a.message || "";
      if (typeEl) typeEl.value = a.badge_type || "info";
      if (urlEl) urlEl.value = a.action_url || "";
      if (labelEl) labelEl.value = a.action_label || "";

      this.updateAnnouncementPreview();
    } catch (err) {
      console.error("Failed to load announcement config:", err);
    }
  }

  updateAnnouncementPreview() {
    const previewBox = document.getElementById("adminAnnouncementPreviewBox");
    const isActive = document.getElementById("adminAnnouncementActive")?.checked;
    const msg = (document.getElementById("adminAnnouncementMsg")?.value || "").trim();
    const type = document.getElementById("adminAnnouncementType")?.value || "info";
    const label = (document.getElementById("adminAnnouncementLabel")?.value || "").trim();

    if (!previewBox) return;

    if (!isActive || !msg) {
      previewBox.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">Announcement is currently disabled / inactive.</span>`;
      return;
    }

    previewBox.innerHTML = `
      <div class="announcement-banner banner-${type}">
        <span class="announcement-pill">${type.toUpperCase()}</span>
        <span class="announcement-text">${this.escapeHtml(msg)}</span>
        ${label ? `<span class="announcement-action">${this.escapeHtml(label)} &rarr;</span>` : ''}
      </div>
    `;
  }

  async saveAnnouncement() {
    const btn = document.getElementById("btnSaveAnnouncement");
    const origHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "Saving...";
    }

    const payload = {
      is_active: document.getElementById("adminAnnouncementActive")?.checked ?? false,
      message: (document.getElementById("adminAnnouncementMsg")?.value || "").trim(),
      badge_type: document.getElementById("adminAnnouncementType")?.value || "info",
      action_url: (document.getElementById("adminAnnouncementUrl")?.value || "").trim(),
      action_label: (document.getElementById("adminAnnouncementLabel")?.value || "").trim(),
    };

    try {
      const res = await window.ApiClient.saveAdminAnnouncement(payload);
      window.app?.showToast("Global announcement banner updated successfully!", "success");
      this.updateAnnouncementPreview();
      // Reload banner for current user session
      if (window.app?.checkGlobalAnnouncement) {
        window.app.checkGlobalAnnouncement();
      }
    } catch (err) {
      console.error("Save announcement error:", err);
      window.app?.showToast(err.message || "Failed to update announcement.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  // ── 7. Compliance Audit Logs ───────────────────────────────────────────────
  async loadAuditLogs() {
    const tableBody = document.getElementById("adminAuditLogsTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" class="admin-table-loading">Loading security audit trails...</td></tr>`;
    }

    try {
      const res = await window.ApiClient.getAdminAuditLogs();
      const logs = res?.logs || [];
      this.renderAuditLogs(logs);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="5" class="admin-table-error">Failed to fetch audit records.</td></tr>`;
      }
    }
  }

  renderAuditLogs(logs) {
    const tableBody = document.getElementById("adminAuditLogsTableBody");
    if (!tableBody) return;

    if (!logs.length) {
      tableBody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">No administrative actions logged yet.</td></tr>`;
      return;
    }

    tableBody.innerHTML = logs.map(l => {
      const dateStr = l.created_at ? new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "medium" }) : "—";
      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${this.escapeHtml(l.admin_email)}</strong></td>
          <td><span class="admin-badge badge-role-admin">${this.escapeHtml(l.action)}</span></td>
          <td>${this.escapeHtml(l.target || "—")}</td>
          <td style="font-size: 0.82rem; color: var(--text-muted);">${this.escapeHtml(l.details || "—")}</td>
        </tr>
      `;
    }).join("");
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  formatRelativeTime(isoStr) {
    if (!isoStr) return "Never";
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
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

  escapeJs(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
}

window.adminConsole = new AdminConsoleManager();
