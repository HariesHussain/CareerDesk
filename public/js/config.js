/**
 * CareerDesk — Frontend Configuration
 * =======================================
 * Dynamically populated from backend server environment variables (/api/config).
 * Zero API keys or secrets hardcoded in frontend source files.
 */

const AppConfig = {
  // Relative path works seamlessly on both local development and Vercel production
  API_BASE_URL: window.location.origin,

  // Populated dynamically on application startup via load()
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  async load() {
    try {
      const res = await fetch(`${this.API_BASE_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        this.SUPABASE_URL = data.supabase_url || "";
        this.SUPABASE_ANON_KEY = data.supabase_anon_key || "";
      }
    } catch (err) {
      console.warn("Could not load /api/config:", err);
    }
  },

  // Opportunity categories
  OPPORTUNITY_TYPES: [
    { id: "all", label: "All Opportunities", icon: "🌐" },
    { id: "hackathon", label: "Hackathons", icon: "⚡" },
    { id: "contest", label: "Coding Contests", icon: "🏆" },
    { id: "internship", label: "Internships", icon: "💼" },
    { id: "grant", label: "Grants & Fellowships", icon: "🚀" }
  ],

  // Pipeline stages for Student Career OS
  PIPELINE_STAGES: [
    { id: "saved", label: "Saved", color: "saved" },
    { id: "applied", label: "Applied", color: "applied" },
    { id: "in_review", label: "In Review", color: "interview" },
    { id: "selected", label: "Selected", color: "selected" }
  ]
};

window.AppConfig = AppConfig;
