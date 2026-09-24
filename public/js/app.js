/**
 * CareerDesk — Application Controller
 * =======================================
 * Manages view routing, live search/filtering, Internshala-style opportunity cards,
 * optimistic bookmarks, Kanban pipeline, modals, and toasts.
 */

class OpportunityApp {
  constructor() {
    this.currentTab = "explore";
    this.opportunities = [];
    this.bookmarks = new Set();
    this.currentFilters = {
      search: "",
      type: "all",
      mode: "all",
      sort: "deadline_asc",
      page: 1,
      limit: 24
    };
    this.totalCount = 0;
    this.hasMore = false;
    this.isLoadingMore = false;
    this.searchDebounceTimer = null;
  }

  async init() {
    this.setupEventListeners();
    this.setupCookieConsent();
    this.setupAuthSync();
    this.setupScrollAnimations();
    this.initLandingScrollSpy();
    await this.loadBookmarks();
    
    if (window.adminConsole) {
      window.adminConsole.init();
    }
    await this.checkGlobalAnnouncement();

    // Lazy-load: only eagerly fetch opportunities if user is already authenticated into workspace
    if (window.authManager && window.authManager.isAuthenticated()) {
      await this.loadExploreData();
    }
    await this.updateHeroStats();
  }

  // ── Scroll Reveal Animations ──────────────────────────────────────────────
  setupScrollAnimations() {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal-on-scroll").forEach(el => observer.observe(el));
  }

  // ── Landing Page Header Sticky & Scrollspy ───────────────────────────────
  initLandingScrollSpy() {
    const siteHeader = document.querySelector(".site-header");
    const sections = ["overview", "how-it-works", "how-to-use", "for-whom"];
    const navLinks = document.querySelectorAll(".guest-nav-link, .mobile-landing-nav-link");

    const onScroll = () => {
      // 1. Elevated header shadow & backdrop blur enhancement when scrolled
      if (siteHeader) {
        if (window.scrollY > 20) {
          siteHeader.classList.add("is-scrolled");
        } else {
          siteHeader.classList.remove("is-scrolled");
        }
      }

      // 2. Active Section Spy for guest landing links
      let currentSectionId = "";
      const scrollPosition = window.scrollY + 120;

      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            currentSectionId = id;
            break;
          }
        }
      }

      if (currentSectionId) {
        navLinks.forEach(link => {
          const href = link.getAttribute("href");
          if (href === `#${currentSectionId}`) {
            link.classList.add("active");
          } else if (href && href.startsWith("#")) {
            link.classList.remove("active");
          }
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Trigger on initial load to set state
    onScroll();
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
    const googleLoginButtons = ["btnGoogleLogin", "btnHeroGoogle", "btnCtaGoogle"];
    googleLoginButtons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          window.authManager.signInWithGoogle();
        });
      }
    });

    // User Profile Modal Trigger (Header dropdown)
    const btnOpenProfileModal = document.getElementById("btnOpenProfileModal");
    if (btnOpenProfileModal) {
      btnOpenProfileModal.addEventListener("click", (e) => {
        e.preventDefault();
        const userDropdown = document.getElementById("userDropdown");
        if (userDropdown) userDropdown.classList.remove("show");
        this.openProfileModal();
      });
    }

    // Load More Opportunities Button
    const btnLoadMoreOpps = document.getElementById("btnLoadMoreOpps");
    if (btnLoadMoreOpps) {
      btnLoadMoreOpps.addEventListener("click", () => {
        this.loadMoreOpportunities();
      });
    }

    // Profile Form Handlers
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProfile();
      });
    }

    const closeProfileModalBtn = document.getElementById("closeProfileModalBtn");
    if (closeProfileModalBtn) {
      closeProfileModalBtn.addEventListener("click", () => this.closeAllModals());
    }

    const btnCancelProfile = document.getElementById("btnCancelProfile");
    if (btnCancelProfile) {
      btnCancelProfile.addEventListener("click", () => this.closeAllModals());
    }

    const btnProfileDeleteAccount = document.getElementById("btnProfileDeleteAccount");
    if (btnProfileDeleteAccount) {
      btnProfileDeleteAccount.addEventListener("click", () => {
        this.closeAllModals();
        const btnDeleteAccount = document.getElementById("btnDeleteAccount");
        if (btnDeleteAccount) btnDeleteAccount.click();
      });
    }

    // Role Switcher Tabs on Landing Page
    const roleTabCandidate = document.getElementById("roleTabCandidate");
    const roleTabOrganizer = document.getElementById("roleTabOrganizer");
    const rolePanelCandidate = document.getElementById("rolePanelCandidate");
    const rolePanelOrganizer = document.getElementById("rolePanelOrganizer");

    if (roleTabCandidate && roleTabOrganizer && rolePanelCandidate && rolePanelOrganizer) {
      roleTabCandidate.addEventListener("click", () => {
        roleTabCandidate.classList.add("active");
        roleTabCandidate.setAttribute("aria-selected", "true");
        roleTabOrganizer.classList.remove("active");
        roleTabOrganizer.setAttribute("aria-selected", "false");
        rolePanelCandidate.style.display = "grid";
        rolePanelOrganizer.style.display = "none";
      });

      roleTabOrganizer.addEventListener("click", () => {
        roleTabOrganizer.classList.add("active");
        roleTabOrganizer.setAttribute("aria-selected", "true");
        roleTabCandidate.classList.remove("active");
        roleTabCandidate.setAttribute("aria-selected", "false");
        rolePanelOrganizer.style.display = "grid";
        rolePanelCandidate.style.display = "none";
      });
    }

    // Hero Explore & Submit Buttons
    const btnHeroExplore = document.getElementById("btnHeroExplore");
    if (btnHeroExplore) {
      btnHeroExplore.addEventListener("click", () => {
        const overviewSec = document.getElementById("overview");
        if (overviewSec) {
          overviewSec.scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    const btnHeroSubmit = document.getElementById("btnHeroSubmit");
    if (btnHeroSubmit) {
      btnHeroSubmit.addEventListener("click", (e) => {
        if (window.authManager && window.authManager.isAuthenticated()) {
          this.switchTab("submit");
        } else {
          const howToUse = document.getElementById("how-to-use");
          if (howToUse) howToUse.scrollIntoView({ behavior: "smooth" });
          if (roleTabOrganizer) roleTabOrganizer.click();
        }
      });
    }

    // Product Guide Toggle in Workspace Subbar
    const btnToggleLandingGuide = document.getElementById("btnToggleLandingGuide");
    if (btnToggleLandingGuide) {
      btnToggleLandingGuide.addEventListener("click", () => {
        const landingView = document.getElementById("landingView");
        const appWorkspace = document.getElementById("appWorkspace");
        if (landingView && appWorkspace) {
          const isLandingVisible = landingView.style.display !== "none";
          if (isLandingVisible) {
            landingView.style.display = "none";
            appWorkspace.style.display = "block";
            btnToggleLandingGuide.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Product Guide
            `;
          } else {
            landingView.style.display = "block";
            landingView.scrollIntoView({ behavior: "smooth" });
            btnToggleLandingGuide.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Return to App Terminal
            `;
          }
        }
      });
    }

    // Desktop Sign Out (from User Dropdown)
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        await window.authManager.signOut();
        this.showToast("Signed out successfully", "info");
      });
    }

    // Mobile Header Profile Trigger (Jakob's Law Standard)
    const mobileHeaderProfileBtn = document.getElementById("mobileHeaderProfileBtn");
    if (mobileHeaderProfileBtn) {
      mobileHeaderProfileBtn.addEventListener("click", () => {
        this.openProfileDrawer();
      });
    }

    // Mobile Bottom Nav Profile Trigger
    const mobileNavProfileBtn = document.getElementById("mobileNavProfileBtn");
    if (mobileNavProfileBtn) {
      mobileNavProfileBtn.addEventListener("click", () => {
        this.openProfileDrawer();
      });
    }

    // Mobile Profile Drawer Controls
    const btnCloseProfileDrawer = document.getElementById("btnCloseProfileDrawer");
    if (btnCloseProfileDrawer) {
      btnCloseProfileDrawer.addEventListener("click", () => {
        this.closeProfileDrawer();
      });
    }

    const profileDrawerBackdrop = document.getElementById("profileDrawerBackdrop");
    if (profileDrawerBackdrop) {
      profileDrawerBackdrop.addEventListener("click", () => {
        this.closeProfileDrawer();
      });
    }

    // Mobile Profile Drawer Tab Links
    document.querySelectorAll("[data-drawer-tab]").forEach(item => {
      item.addEventListener("click", () => {
        const targetTab = item.dataset.drawerTab;
        this.closeProfileDrawer();
        if (targetTab) this.switchTab(targetTab);
      });
    });

    // Drawer Edit Profile Button
    const drawerBtnOpenProfile = document.getElementById("drawerBtnOpenProfile");
    if (drawerBtnOpenProfile) {
      drawerBtnOpenProfile.addEventListener("click", () => {
        this.closeProfileDrawer();
        this.openProfileModal();
      });
    }

    // Drawer Product Tour Button
    const drawerBtnTour = document.getElementById("drawerBtnTour");
    if (drawerBtnTour) {
      drawerBtnTour.addEventListener("click", () => {
        this.closeProfileDrawer();
        const landingView = document.getElementById("landingView");
        const appWorkspace = document.getElementById("appWorkspace");
        if (landingView && appWorkspace) {
          appWorkspace.style.display = "block";
          landingView.style.display = "block";
          landingView.scrollIntoView({ behavior: "smooth" });
        }
      });
    }

    // Drawer Sign Out Button (Prominent & Dedicated Mobile Logout)
    const btnDrawerLogout = document.getElementById("btnDrawerLogout");
    if (btnDrawerLogout) {
      btnDrawerLogout.addEventListener("click", async () => {
        this.closeProfileDrawer();
        await window.authManager.signOut();
        this.showToast("Signed out successfully", "info");
      });
    }

    // Close Drawer on Escape Key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeProfileDrawer();
      }
    });

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



    // Enterprise Admin Console Navigation Triggers
    const btnNavbarAdmin = document.getElementById("btnNavbarAdminConsole");
    if (btnNavbarAdmin) {
      btnNavbarAdmin.addEventListener("click", () => {
        if (window.adminConsole) {
          window.adminConsole.openConsole();
        }
      });
    }

    const btnDropdownAdmin = document.getElementById("btnDropdownAdminConsole");
    if (btnDropdownAdmin) {
      btnDropdownAdmin.addEventListener("click", (e) => {
        e.preventDefault();
        const userDropdown = document.getElementById("userDropdown");
        if (userDropdown) userDropdown.classList.remove("show");
        if (window.adminConsole) {
          window.adminConsole.openConsole();
        }
      });
    }

    // Global Account Suspension / Banned Alert Event
    window.addEventListener("account_banned", (e) => {
      const reason = e.detail?.error || "Your account has been suspended by an administrator.";
      alert(`⚠️ Account Suspended:\n\n${reason}\n\nYour session has been terminated and this email is restricted from logging in.`);
      if (window.authManager) {
        window.authManager.signOut();
      }
    });
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
      const guestNav = document.getElementById("guestNavLinks");
      const navTabs = document.getElementById("navTabs");
      const loginWrapper = document.getElementById("guestAuthWrapper");
      const userMenu = document.getElementById("userProfileMenu");
      const adminTab = document.getElementById("adminNavTab");
      const landingView = document.getElementById("landingView");
      const appWorkspace = document.getElementById("appWorkspace");

      if (user) {
        // Authenticated: Show App Workspace, Hide Public Landing
        document.body.classList.add("is-authenticated");
        document.body.classList.remove("is-guest");
        if (guestNav) guestNav.style.display = "none";
        if (navTabs) navTabs.style.display = "flex";
        if (loginWrapper) loginWrapper.style.display = "none";

        const defaultAvatarSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23008BDC'/%3E%3Cstop offset='100%25' stop-color='%23006BC7'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23FFFFFF' opacity='0.9'/%3E%3Cpath d='M20 85 C20 66 35 62 50 62 C65 62 80 66 80 85 Z' fill='%23FFFFFF' opacity='0.9'/%3E%3C/svg%3E";
        const avatarUrl = user.avatar_url || defaultAvatarSvg;
        const fullName = user.full_name || "Student Member";
        const email = user.email || "";

        if (userMenu) {
          userMenu.style.display = "flex";
          const nameEl = document.getElementById("navUserName");
          const avatarEl = document.getElementById("navUserAvatar");
          const roleEl = document.getElementById("navUserRole");
          if (nameEl) nameEl.textContent = fullName;
          if (avatarEl) avatarEl.src = avatarUrl;
          if (roleEl) roleEl.textContent = user.role || "student";
        }

        // Sync Mobile Header Avatar Trigger
        const mobileHeaderAvatarImg = document.getElementById("mobileHeaderAvatarImg");
        if (mobileHeaderAvatarImg) mobileHeaderAvatarImg.src = avatarUrl;

        // Sync Mobile Bottom Nav Avatar
        const mobileBottomNavAvatar = document.getElementById("mobileBottomNavAvatar");
        const mobileBottomNavAvatarDefault = document.getElementById("mobileBottomNavAvatarDefault");
        if (mobileBottomNavAvatar) {
          mobileBottomNavAvatar.src = avatarUrl;
          mobileBottomNavAvatar.style.display = "block";
        }
        if (mobileBottomNavAvatarDefault) {
          mobileBottomNavAvatarDefault.style.display = "none";
        }

        const isAdmin = user.role === "admin";
        if (adminTab) {
          adminTab.style.display = isAdmin ? "inline-flex" : "none";
        }
        const btnNavbarAdmin = document.getElementById("btnNavbarAdminConsole");
        if (btnNavbarAdmin) {
          btnNavbarAdmin.style.display = isAdmin ? "inline-flex" : "none";
        }
        const btnDropdownAdmin = document.getElementById("btnDropdownAdminConsole");
        if (btnDropdownAdmin) {
          btnDropdownAdmin.style.display = isAdmin ? "flex" : "none";
        }
        const adminEmailEl = document.getElementById("adminCurrentEmail");
        if (adminEmailEl) {
          adminEmailEl.textContent = email;
        }

        // Sync Profile Sidebar Drawer Details
        const drawerAvatar = document.getElementById("drawerUserAvatar");
        const drawerName = document.getElementById("drawerUserName");
        const drawerEmail = document.getElementById("drawerUserEmail");
        const drawerRoleBadge = document.getElementById("drawerUserRoleBadge");
        const drawerCollege = document.getElementById("drawerCollegeBadge");
        const drawerAdminItem = document.getElementById("drawerAdminItem");

        if (drawerAvatar) drawerAvatar.src = avatarUrl;
        if (drawerName) drawerName.textContent = fullName;
        if (drawerEmail) drawerEmail.textContent = email;
        if (drawerRoleBadge) {
          drawerRoleBadge.textContent = isAdmin ? "👑 Enterprise Admin" : "🎓 Verified Student";
          drawerRoleBadge.className = isAdmin ? "badge-role-tag badge-role-admin" : "badge-role-tag badge-role-student";
        }
        if (drawerCollege) {
          drawerCollege.textContent = user.college_name || "Engineering Scholar";
        }
        if (drawerAdminItem) {
          drawerAdminItem.style.display = isAdmin ? "flex" : "none";
        }

        if (landingView) landingView.style.display = "none";
        if (appWorkspace) appWorkspace.style.display = "block";

        this.loadBookmarks();
        this.switchTab("explore");
      } else {
        // Guest: Show Public Landing, Hide App Workspace
        document.body.classList.remove("is-authenticated");
        document.body.classList.add("is-guest");
        if (guestNav) guestNav.style.display = "flex";
        if (navTabs) navTabs.style.display = "none";
        if (loginWrapper) loginWrapper.style.display = "flex";
        if (userMenu) userMenu.style.display = "none";
        if (adminTab) adminTab.style.display = "none";
        const btnNavbarAdmin = document.getElementById("btnNavbarAdminConsole");
        if (btnNavbarAdmin) btnNavbarAdmin.style.display = "none";
        const btnDropdownAdmin = document.getElementById("btnDropdownAdminConsole");
        if (btnDropdownAdmin) btnDropdownAdmin.style.display = "none";

        const mobileBottomNavAvatar = document.getElementById("mobileBottomNavAvatar");
        const mobileBottomNavAvatarDefault = document.getElementById("mobileBottomNavAvatarDefault");
        if (mobileBottomNavAvatar) mobileBottomNavAvatar.style.display = "none";
        if (mobileBottomNavAvatarDefault) mobileBottomNavAvatarDefault.style.display = "block";

        const drawerName = document.getElementById("drawerUserName");
        const drawerEmail = document.getElementById("drawerUserEmail");
        const drawerRoleBadge = document.getElementById("drawerUserRoleBadge");
        const drawerCollege = document.getElementById("drawerCollegeBadge");
        const drawerAdminItem = document.getElementById("drawerAdminItem");
        if (drawerName) drawerName.textContent = "Guest Visitor";
        if (drawerEmail) drawerEmail.textContent = "Sign in with Google";
        if (drawerRoleBadge) {
          drawerRoleBadge.textContent = "Guest";
          drawerRoleBadge.className = "badge-role-tag";
        }
        if (drawerCollege) drawerCollege.textContent = "Visitor";
        if (drawerAdminItem) drawerAdminItem.style.display = "none";

        if (landingView) landingView.style.display = "block";
        if (appWorkspace) appWorkspace.style.display = "none";

        this.loadBookmarks();
      }
    });
  }

  // ── Tab Navigation ────────────────────────────────────────────────────────
  switchTab(tabId) {
    this.currentTab = tabId;

    // Ensure Workspace is active when switching tabs
    const landingView = document.getElementById("landingView");
    const appWorkspace = document.getElementById("appWorkspace");
    if (appWorkspace) appWorkspace.style.display = "block";
    if (landingView) landingView.style.display = "none";

    // Update Subbar Active Tab Label
    const activeLabel = document.getElementById("workspaceActiveTabLabel");
    if (activeLabel) {
      const labels = {
        explore: "Explore Opportunities",
        bookmarks: "Saved Bookmarks",
        admin: "👑 Enterprise Admin Console"
      };
      activeLabel.textContent = labels[tabId] || "Workspace Terminal";
    }

    // Reset Guide Button Text if toggled
    const btnToggleLandingGuide = document.getElementById("btnToggleLandingGuide");
    if (btnToggleLandingGuide) {
      btnToggleLandingGuide.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        Product Guide
      `;
    }

    // Synchronize Desktop Nav Tab UI
    document.querySelectorAll(".nav-tab-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });

    // Synchronize Mobile Bottom Nav UI
    document.querySelectorAll(".mobile-nav-item").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabId);
    });

    // Synchronize Profile Drawer Nav Items (Jakob's Law)
    document.querySelectorAll("[data-drawer-tab]").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.drawerTab === tabId);
    });

    // Show/Hide View Panels
    document.querySelectorAll(".view-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `${tabId}View`);
    });

    // Refresh tab-specific data
    if (tabId === "explore") this.loadExploreData();
    if (tabId === "bookmarks") this.renderBookmarks();
    if (tabId === "admin") {
      if (window.adminConsole) {
        window.adminConsole.openConsole();
      }
    }

    // Scroll to top of main content smoothly
    const mainEl = document.getElementById("mainContent");
    if (mainEl && window.scrollY > 300) {
      mainEl.scrollIntoView({ behavior: "smooth" });
    }
  }

  // ── Explore View & Pagination ─────────────────────────────────────────────
  async loadExploreData() {
    const grid = document.getElementById("opportunitiesGrid");
    if (!grid) return;

    this.currentFilters.page = 1;
    this.currentFilters.limit = 24;
    this.opportunities = [];
    grid.innerHTML = this.renderSkeletons(6);

    try {
      const data = await window.ApiClient.getOpportunities(this.currentFilters);
      if (!data) return; // Request was aborted due to rapid new search query; ignore
      this.opportunities = data.opportunities || [];
      this.totalCount = data.total || this.opportunities.length;
      this.hasMore = !!data.has_more;
      this.renderOpportunities(this.opportunities);
      this.updatePaginationUI();
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

  async loadMoreOpportunities() {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;

    const btn = document.getElementById("btnLoadMoreOpps");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="spinner" style="width: 16px; height: 16px; border: 2px solid var(--brand-primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px;"></div>
        <span>Loading more opportunities...</span>
      `;
    }

    try {
      const nextPage = (this.currentFilters.page || 1) + 1;
      this.currentFilters.page = nextPage;
      const data = await window.ApiClient.getOpportunities(this.currentFilters);
      if (data && data.opportunities) {
        this.opportunities = this.opportunities.concat(data.opportunities);
        this.totalCount = data.total || this.totalCount;
        this.hasMore = !!data.has_more;

        const grid = document.getElementById("opportunitiesGrid");
        if (grid) {
          const newCardsHtml = data.opportunities.map(opp => this.renderOpportunityCard(opp)).join("");
          grid.insertAdjacentHTML("beforeend", newCardsHtml);
        }
      }
    } catch (err) {
      console.error("Failed to load more opportunities:", err);
      this.showToast("Failed to load more opportunities. Please retry.", "error");
    } finally {
      this.isLoadingMore = false;
      this.updatePaginationUI();
    }
  }

  updatePaginationUI() {
    const loadedEl = document.getElementById("oppsLoadedCount");
    const totalEl = document.getElementById("oppsTotalCount");
    const btnLoadMore = document.getElementById("btnLoadMoreOpps");
    const allLoadedIndicator = document.getElementById("allLoadedIndicator");

    const loaded = this.opportunities ? this.opportunities.length : 0;
    const total = this.totalCount || loaded;

    if (loadedEl) loadedEl.textContent = loaded;
    if (totalEl) totalEl.textContent = total;

    if (btnLoadMore) {
      btnLoadMore.disabled = false;
      const remaining = Math.max(0, total - loaded);
      const nextBatch = Math.min(24, remaining);
      btnLoadMore.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        <span>Load More Opportunities (${nextBatch} more)</span>
      `;
      btnLoadMore.style.display = this.hasMore ? "inline-flex" : "none";
    }

    if (allLoadedIndicator) {
      allLoadedIndicator.style.display = (!this.hasMore && loaded > 0) ? "flex" : "none";
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
    const isBookmarked = this.bookmarks.has(Number(opp.id)) || this.bookmarks.has(String(opp.id));
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

  // ── Bookmarking (Local-first & Cloud-synchronized) ───────────────────────
  async loadBookmarks() {
    // 1. Immediately restore cached bookmarks from localStorage for instant render
    try {
      const cached = localStorage.getItem("cd_saved_bookmarks");
      if (cached) {
        const ids = JSON.parse(cached);
        if (Array.isArray(ids)) {
          this.bookmarks = new Set(ids.map(Number));
          this.updateBookmarkBadges();
        }
      }
    } catch (e) {
      console.warn("Could not read local bookmarks:", e);
    }

    if (!window.authManager.isAuthenticated()) return;

    // 2. Fetch and sync from backend API when authenticated
    try {
      const data = await window.ApiClient.getBookmarks();
      const serverIds = (data.bookmarks || [])
        .map(b => b.opportunity_id || b.opp_opportunities?.id)
        .filter(Boolean)
        .map(Number);

      const merged = new Set([...this.bookmarks, ...serverIds]);
      this.bookmarks = merged;
      try {
        localStorage.setItem("cd_saved_bookmarks", JSON.stringify(Array.from(this.bookmarks)));
      } catch (e) {}
      this.updateBookmarkBadges();

      // Sync local bookmarks to server if missing
      for (const id of this.bookmarks) {
        if (!serverIds.includes(id)) {
          window.ApiClient.addBookmark(id).catch(() => {});
        }
      }
    } catch (err) {
      console.warn("Could not sync bookmarks from server:", err);
    }
  }

  updateBookmarkBadges() {
    const count = this.bookmarks.size;
    const badge = document.getElementById("savedCountBadge");
    if (badge) badge.textContent = count;

    const mobileBadge = document.getElementById("mobileSavedBadge");
    if (mobileBadge) {
      mobileBadge.textContent = count;
      mobileBadge.style.display = count > 0 ? "flex" : "none";
    }

    const drawerBadge = document.getElementById("drawerBookmarksCount");
    if (drawerBadge) drawerBadge.textContent = count;

    const drawerStatSaved = document.getElementById("drawerStatSavedCount");
    if (drawerStatSaved) drawerStatSaved.textContent = count;
  }

  async toggleBookmark(oppId, btnEl) {
    oppId = Number(oppId);
    const isCurrentlyBookmarked = this.bookmarks.has(oppId);

    // 1. Instant optimistic UI update
    if (isCurrentlyBookmarked) {
      this.bookmarks.delete(oppId);
      if (btnEl) btnEl.classList.remove("bookmarked");
      this.showToast("Removed from bookmarks", "info");
    } else {
      this.bookmarks.add(oppId);
      if (btnEl) btnEl.classList.add("bookmarked");
      this.showToast("Saved to bookmarks!", "success");
    }

    // Persist immediately in localStorage
    try {
      localStorage.setItem("cd_saved_bookmarks", JSON.stringify(Array.from(this.bookmarks)));
    } catch (e) {}

    this.updateBookmarkBadges();

    // 2. If user is authenticated, sync to cloud API
    if (window.authManager.isAuthenticated()) {
      try {
        if (isCurrentlyBookmarked) {
          await window.ApiClient.removeBookmark(oppId);
        } else {
          await window.ApiClient.addBookmark(oppId);
        }
      } catch (err) {
        console.warn("Cloud sync error for bookmark:", err);
      }
    }
  }

  async renderBookmarks() {
    const grid = document.getElementById("bookmarksGrid");
    if (!grid) return;

    grid.innerHTML = `
      <div style="text-align: center; padding: 48px; grid-column: 1 / -1;">
        <p style="color: var(--text-muted);">Loading your saved opportunities...</p>
      </div>
    `;

    let bookmarkedOpps = [];

    // If authenticated, fetch from backend
    if (window.authManager.isAuthenticated()) {
      try {
        const data = await window.ApiClient.getBookmarks();
        bookmarkedOpps = (data.bookmarks || []).map(b => b.opp_opportunities).filter(Boolean);
        const serverIds = bookmarkedOpps.map(o => Number(o.id));
        this.bookmarks = new Set([...this.bookmarks, ...serverIds]);
        try {
          localStorage.setItem("cd_saved_bookmarks", JSON.stringify(Array.from(this.bookmarks)));
        } catch (e) {}
        this.updateBookmarkBadges();
      } catch (err) {
        console.warn("Error fetching bookmarks from server:", err);
      }
    }

    // Fallback: match from already-loaded opportunities
    if (bookmarkedOpps.length === 0 && this.bookmarks.size > 0) {
      bookmarkedOpps = this.opportunities.filter(opp => this.bookmarks.has(Number(opp.id)));
    }

    // If still empty but we have bookmark IDs and this.opportunities is empty, fetch opportunities
    if (bookmarkedOpps.length === 0 && this.bookmarks.size > 0 && this.opportunities.length === 0) {
      try {
        const data = await window.ApiClient.getOpportunities({ limit: 100 });
        if (data && data.opportunities) {
          this.opportunities = data.opportunities;
          bookmarkedOpps = this.opportunities.filter(opp => this.bookmarks.has(Number(opp.id)));
        }
      } catch (e) {}
    }

    if (bookmarkedOpps.length === 0) {
      grid.innerHTML = `
        <div style="text-align: center; padding: 48px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-lg); grid-column: 1 / -1;">
          <h3 style="font-size: 1.2rem; margin-bottom: 8px;">No Bookmarks Saved Yet</h3>
          <p style="color: var(--text-muted); margin-bottom: 16px;">Explore opportunities, contests &amp; hackathons and click the bookmark button to save them here.</p>
          <button class="btn-apply-action" onclick="window.app.switchTab('explore')">Explore Opportunities</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = bookmarkedOpps.map(opp => this.renderOpportunityCard(opp)).join("");
  }

  // ── Apply & Details ───────────────────────────────────────────────────────
  async applyToOpportunity(oppId, applyUrl) {
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

  // ── Profile Management ───────────────────────────────────────────────────
  addSkillToProfile(skill) {
    const input = document.getElementById("profileSkills");
    if (!input) return;
    const current = (input.value || "").trim();
    if (!current) {
      input.value = skill;
    } else {
      const skillsArray = current.split(",").map(s => s.trim().toLowerCase());
      if (!skillsArray.includes(skill.toLowerCase())) {
        input.value = `${current}, ${skill}`;
      }
    }
    input.focus();
  }

  openProfileModal() {
    if (!window.authManager || !window.authManager.isAuthenticated()) {
      window.authManager.signInWithGoogle();
      return;
    }

    const profile = window.authManager.getUserData() || {};

    const avatarEl = document.getElementById("profileModalAvatar");
    const nameEl = document.getElementById("profileModalTitle");
    const emailEl = document.getElementById("profileModalEmail");

    const defaultAvatarSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23008BDC'/%3E%3Cstop offset='100%25' stop-color='%23006BC7'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='50' cy='50' r='50' fill='url(%23g)'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23FFFFFF' opacity='0.9'/%3E%3Cpath d='M20 85 C20 66 35 62 50 62 C65 62 80 66 80 85 Z' fill='%23FFFFFF' opacity='0.9'/%3E%3C/svg%3E";
    if (avatarEl) {
      avatarEl.src = profile.avatar_url || defaultAvatarSvg;
    }
    if (nameEl) nameEl.textContent = profile.full_name || "Student Profile";
    if (emailEl) emailEl.textContent = profile.email || "";

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };

    setVal("profileFullName", profile.full_name);
    setVal("profileCollegeName", profile.college_name);
    setVal("profileDegree", profile.degree);
    setVal("profileGraduationYear", profile.graduation_year);

    this.openModal("profileModal");
  }

  async saveProfile() {
    const btn = document.getElementById("btnSaveProfile");
    const origHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="spinner" style="width: 14px; height: 14px; border: 2px solid #FFFFFF; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; vertical-align: middle; margin-right: 6px;"></div>
        Saving...
      `;
    }

    const payload = {
      full_name: (document.getElementById("profileFullName")?.value || "").trim(),
      college_name: (document.getElementById("profileCollegeName")?.value || "").trim(),
      degree: (document.getElementById("profileDegree")?.value || "").trim(),
      graduation_year: (document.getElementById("profileGraduationYear")?.value || "").trim(),
    };

    try {
      const res = await window.ApiClient.updateProfile(payload);
      if (res && res.user) {
        window.authManager.profile = res.user;
        window.authManager.notifyListeners();
        this.showToast("Profile updated successfully!", "success");
        this.closeAllModals();
      } else {
        throw new Error(res?.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Profile update error:", err);
      this.showToast(err.message || "Failed to save profile. Please verify your inputs.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  // ── Mobile Profile Sidebar Drawer (Jakob's Law Standard) ───────────────────
  openProfileDrawer() {
    const drawer = document.getElementById("profileDrawer");
    const backdrop = document.getElementById("profileDrawerBackdrop");
    if (drawer) drawer.classList.add("open");
    if (backdrop) {
      backdrop.style.display = "block";
      requestAnimationFrame(() => backdrop.classList.add("open"));
    }
    document.body.style.overflow = "hidden";
  }

  closeProfileDrawer() {
    const drawer = document.getElementById("profileDrawer");
    const backdrop = document.getElementById("profileDrawerBackdrop");
    if (drawer) drawer.classList.remove("open");
    if (backdrop) {
      backdrop.classList.remove("open");
      setTimeout(() => {
        if (!drawer || !drawer.classList.contains("open")) {
          if (backdrop) backdrop.style.display = "none";
        }
      }, 250);
    }
    document.body.style.overflow = "";
  }

  // ── Modals & Toasts ───────────────────────────────────────────────────────
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add("open");
  }

  closeAllModals() {
    this.closeProfileDrawer();
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

  async checkGlobalAnnouncement() {
    const banner = document.getElementById("globalAnnouncementBanner");
    if (!banner) return;

    try {
      const data = await window.ApiClient.getPublicAnnouncement();
      if (data && data.announcement && data.announcement.is_active && data.announcement.message) {
        const a = data.announcement;
        const typeClass = `banner-${a.badge_type || "info"}`;
        banner.className = `site-announcement-container ${typeClass}`;
        
        let actionBtnHtml = "";
        if (a.action_url && a.action_label) {
          actionBtnHtml = `<a href="${this.escapeHtml(a.action_url)}" target="_blank" rel="noopener noreferrer" class="announcement-action-btn">${this.escapeHtml(a.action_label)} &rarr;</a>`;
        }

        banner.innerHTML = `
          <div class="announcement-content-inner">
            <span class="announcement-badge-pill">${this.escapeHtml((a.badge_type || "UPDATE").toUpperCase())}</span>
            <span class="announcement-message-text">${this.escapeHtml(a.message)}</span>
            ${actionBtnHtml}
          </div>
          <button type="button" class="announcement-dismiss-btn" id="btnDismissAnnouncement" aria-label="Dismiss announcement">&times;</button>
        `;
        banner.style.display = "block";

        const btnDismiss = document.getElementById("btnDismissAnnouncement");
        if (btnDismiss) {
          btnDismiss.addEventListener("click", () => {
            banner.style.display = "none";
          });
        }
      } else {
        banner.style.display = "none";
      }
    } catch (err) {
      console.warn("Could not check global announcements:", err);
      banner.style.display = "none";
    }
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
