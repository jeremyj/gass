// Centralized API client for GASS application
// Throws on { success: false } with the server's error text as error.message;
// redirects to /login on 401.

const API = {
  async request(url, options = {}) {
    try {
      const response = await fetch(url, options);

      if (response.status === 401) {
        console.warn('Authentication required, redirecting to login...');
        window.location.href = '/login';
        throw new Error('Authentication required');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.message || 'Request failed');
      }

      return result;
    } catch (error) {
      console.error(`API Error [${url}]:`, error);
      throw error;
    }
  },

  async get(url) {
    return this.request(url);
  },

  async post(url, data) {
    return this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async put(url, data) {
    return this.request(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  async delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
};
