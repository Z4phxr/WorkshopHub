/**
 * api.js
 * Centralized API helper for the client application.
 * Exposes a thin wrapper around axios to keep request headers and base URL consistent.
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7271';

/**
 * Build headers for authenticated requests.
 * @returns {{Authorization?: string}} headers object
 */
export function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * GET wrapper
 * @param {string} path API path (relative)
 * @param {object} cfg axios config
 */
export function get(path, cfg = {}) {
  return axios.get(`${API_URL}${path.startsWith('/') ? '' : '/'}${path}`, cfg);
}

/**
 * POST wrapper
 * @param {string} path API path (relative)
 * @param {any} data request body
 * @param {object} cfg axios config
 */
export function post(path, data, cfg = {}) {
  return axios.post(`${API_URL}${path.startsWith('/') ? '' : '/'}${path}`, data, cfg);
}

/**
 * PUT wrapper
 * @param {string} path API path (relative)
 * @param {any} data request body
 * @param {object} cfg axios config
 */
export function put(path, data, cfg = {}) {
  return axios.put(`${API_URL}${path.startsWith('/') ? '' : '/'}${path}`, data, cfg);
}

/**
 * DELETE wrapper
 * @param {string} path API path (relative)
 * @param {object} cfg axios config
 */
export function del(path, cfg = {}) {
  return axios.delete(`${API_URL}${path.startsWith('/') ? '' : '/'}${path}`, cfg);
}

export default { get, post, put, del, authHeaders, API_URL };
