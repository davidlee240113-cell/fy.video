import { create } from 'zustand';
import { api } from './api';

interface AuthState {
  user: { id: string; email: string; displayName: string | null; role: string; avatarUrl?: string | null } | null;
  isLoading: boolean;
  setUser: (user: AuthState['user']) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  login: async (email, password) => {
    const data = await api.login(email, password);
    const user = data.user as AuthState['user'];
    localStorage.setItem('fy_token', data.accessToken);
    localStorage.setItem('fy_user', JSON.stringify(user));
    api.setToken(data.accessToken);
    set({ user });
  },
  register: async (email, password, displayName, role) => {
    const data = await api.register(email, password, displayName, role);
    const user = data.user as AuthState['user'];
    localStorage.setItem('fy_token', data.accessToken);
    localStorage.setItem('fy_user', JSON.stringify(user));
    api.setToken(data.accessToken);
    set({ user });
  },
  logout: async () => {
    try { await api.logout(); } catch {}
    localStorage.removeItem('fy_token');
    localStorage.removeItem('fy_user');
    api.setToken(null);
    set({ user: null });
  },
  initialize: () => {
    const stored = localStorage.getItem('fy_user');
    const token = localStorage.getItem('fy_token');
    if (stored && token) {
      try {
        api.setToken(token);
        set({ user: JSON.parse(stored), isLoading: false });
        return;
      } catch {}
    }
    set({ isLoading: false });
  },
}));
