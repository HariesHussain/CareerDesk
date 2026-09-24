/**
 * CareerDesk — Auth Module (Supabase Auth & Google OAuth)
 * ========================================================
 * Production Google OAuth Single Sign-On and session management.
 * Zero demo/test login harnesses.
 */

class AuthManager {
  constructor() {
    this.client = null;
    this.session = null;
    this.user = null;
    this.profile = null;
    this.listeners = [];
  }

  /**
   * Initialize Supabase client and restore session
   */
  async init() {
    this.isReady = false;
    localStorage.removeItem("opp_demo_session");

    if (!window.supabase) {
      this.isReady = true;
      return;
    }

    try {
      this.client = window.supabase.createClient(
        AppConfig.SUPABASE_URL,
        AppConfig.SUPABASE_ANON_KEY
      );

      // Check existing Supabase session
      const { data, error } = await this.client.auth.getSession();
      if (!error && data?.session) {
        this.session = data.session;
        this.user = data.session.user;
        await this.fetchBackendProfile();
      }

      // Listen for auth state changes
      this.client.auth.onAuthStateChange(async (event, session) => {
        if (session) {
          this.session = session;
          this.user = session.user;
          await this.fetchBackendProfile();
        } else {
          this.session = null;
          this.user = null;
          this.profile = null;
        }
        this.notifyListeners();
      });

    } catch (err) {
      // Graceful fallback for offline / disconnected states
    } finally {
      this.isReady = true;
    }
  }

  /**
   * Fetch user's synced profile from CareerDesk backend
   */
  async fetchBackendProfile() {
    if (!this.session?.access_token) return;

    try {
      const res = await fetch(`${AppConfig.API_BASE_URL}/api/auth/me`, {
        headers: {
          "Authorization": `Bearer ${this.session.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        this.profile = data.user;
      } else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.is_banned) {
          window.dispatchEvent(new CustomEvent("account_banned", { detail: data }));
          await this.signOut();
        }
      }
    } catch (_) {
      // Silent error handling for network hiccups
    }
  }

  /**
   * Trigger Google OAuth sign-in flow
   */
  async signInWithGoogle() {
    if (!this.client) {
      if (window.AppConfig && (!AppConfig.SUPABASE_URL || !AppConfig.SUPABASE_ANON_KEY)) {
        await window.AppConfig.load();
      }
      if (AppConfig.SUPABASE_URL && AppConfig.SUPABASE_ANON_KEY) {
        await this.init();
      }
    }

    if (!this.client) {
      alert("Authentication service is connecting. Please wait a moment and try again.");
      return;
    }

    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      alert("Authentication error: " + error.message);
    }
  }

  /**
   * Sign out and clear all cached sessions and tokens
   */
  async signOut() {
    localStorage.removeItem("opp_demo_session");
    localStorage.removeItem("careerdesk_auth_session");
    localStorage.removeItem("careerdesk_user_profile");
    localStorage.removeItem("careerdesk_bookmarks");
    try {
      sessionStorage.clear();
    } catch (_) {}

    if (window.ApiClient && typeof window.ApiClient.clearCache === "function") {
      window.ApiClient.clearCache();
    }

    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch (_) {}
    }
    this.session = null;
    this.user = null;
    this.profile = null;
    this.notifyListeners();
  }

  /**
   * Get JWT access token for backend authorization
   */
  getAccessToken() {
    return this.session?.access_token || null;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return !!this.session;
  }

  /**
   * Get display user object
   */
  getUserData() {
    if (this.profile) return this.profile;
    if (this.user) {
      const meta = this.user.user_metadata || {};
      return {
        id: this.user.id,
        email: this.user.email,
        full_name: meta.full_name || meta.name || "Student",
        avatar_url: meta.avatar_url || meta.picture || "",
        role: "student"
      };
    }
    return null;
  }

  onAuthChange(callback) {
    this.listeners.push(callback);
    callback(this.getUserData());
  }

  notifyListeners() {
    const user = this.getUserData();
    this.listeners.forEach(cb => cb(user));
  }
}

window.authManager = new AuthManager();
