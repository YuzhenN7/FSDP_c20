// Talks to the server. Loaded on every page as the global `api`.
//
//   const belts = await api.get('/belts');
//   await api.post('/fees', { student_id: 1, description: 'Term 5', amount: 120 });
//
// It adds the login token automatically. If the token is missing/expired it sends you to the login page.

const api = {
  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      return null;
    }
  },

  saveSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  homePageFor(role) {
    return role === 'admin' ? '/admin/dashboard.html' : '/student/home.html';
  },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = api.getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch('/api' + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // response had no JSON body
    }

    // Logged out / token expired (but not on the login form itself)
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      api.clearSession();
      location.replace('/login.html');
      throw new Error('Please log in.');
    }

    if (!res.ok) {
      throw new Error((data && data.error) || 'Something went wrong.');
    }
    return data;
  },

  get: (path) => api.request('GET', path),
  post: (path, body) => api.request('POST', path, body || {}),
  put: (path, body) => api.request('PUT', path, body || {}),
  del: (path) => api.request('DELETE', path),
};
