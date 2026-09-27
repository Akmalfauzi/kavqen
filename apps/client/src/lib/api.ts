import axios from 'axios';
import CryptoJS from 'crypto-js';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || '/gateway';
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-hackathon-key';

export const getToken = () => typeof window === 'undefined' ? null : sessionStorage.getItem('token') || localStorage.getItem('token');
export const clearToken = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};
export const saveToken = (token: string, remember = false) => {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem('token', token);
};

export const hashPassword = async (password: string) => {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
};

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);
