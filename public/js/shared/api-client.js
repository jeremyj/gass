// Centralized API client for GASS application
// Provides consistent error handling and request/response formatting

const API = {
  // Base fetch wrapper with error handling
  async request(url, options = {}) {
    try {
      const response = await fetch(url, options);

      // Handle 401 Unauthorized - redirect to login
      if (response.status === 401) {
        console.warn('Authentication required, redirecting to login...');
        window.location.href = '/login';
        throw new Error('Authentication required');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Request failed');
      }

      return result;
    } catch (error) {
      console.error(`API Error [${url}]:`, error);
      throw error;
    }
  },

  // GET request
  async get(url) {
    return this.request(url);
  },

  // POST request
  async post(url, data) {
    return this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  // PUT request
  async put(url, data) {
    return this.request(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  // DELETE request
  async delete(url) {
    return this.request(url, { method: 'DELETE' });
  },

  // === Consegna API ===
  async getStoricoDates() {
    return this.get('/api/storico');
  },

  async getConsegna(date) {
    return this.get(`/api/consegna/${date}`);
  },

  async saveConsegna(data) {
    return this.post('/api/consegna', data);
  },

  async deleteConsegna(id) {
    return this.delete(`/api/consegna/${id}`);
  },

  async closeConsegna(id) {
    return this.post(`/api/consegna/${id}/close`, {});
  },

  async reopenConsegna(id) {
    return this.post(`/api/consegna/${id}/reopen`, {});
  },

  // === Participants API ===
  async getParticipants(date = null) {
    const url = date ? `/api/participants?date=${date}` : '/api/participants';
    return this.get(url);
  },

  async addParticipant(nome) {
    return this.post('/api/participants', { nome });
  },

  async updateParticipant(id, saldo) {
    return this.put(`/api/participants/${id}`, { saldo });
  },

  async deleteParticipant(id) {
    return this.delete(`/api/participants/${id}`);
  },

  // === Storico API ===
  async getStorico() {
    return this.get('/api/storico');
  },

  async getStoricoDettaglio() {
    return this.get('/api/storico/dettaglio');
  },

  // === Logs API ===
  async getLogs(page = 1, limit = 50) {
    return this.get(`/api/logs?page=${page}&limit=${limit}`);
  }
};
