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
    // Clean up any legacy demo keys
    localStorage.removeItem("opp_demo_session");

    if (!window.supabase) {
      console.warn("Supabase SDK not loaded from CDN yet.");
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
      console.error("Failed to initialize Supabase Auth:", err);
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
      }
    } catch (err) {
      console.warn("Could not fetch backend profile:", err);
    }
  }

  /**
   * Trigger Google OAuth sign-in flow
   */
  async signInWithGoogle() {
    if (!this.client) {
      alert("Supabase is initializing. Please try again in a moment.");
      return;
    }

    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error("Google OAuth error:", error);
      alert("Authentication error: " + error.message);
    }
  }

  /**
   * Sign out and clear session
   */
  async signOut() {
    localStorage.removeItem("opp_demo_session");
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch (e) {
        console.warn("SignOut error:", e);
      }
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
