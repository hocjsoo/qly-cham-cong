// ==============================================
// tests/unit/clientAuthStore.test.js
// Kiểm thử Frontend State Management: AuthStore (Zustand) & Phân quyền UI
// ==============================================

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

function createMockAuthStore(storage) {
  let state = {
    user: JSON.parse(storage.getItem('user') || 'null'),
    token: storage.getItem('token') || null,
    isLoading: false,
    error: null,
  };

  const get = () => state;
  const set = (partial) => {
    state = { ...state, ...partial };
  };

  const store = {
    getState: () => state,
    setUser: (newUser) => {
      storage.setItem('user', JSON.stringify(newUser));
      set({ user: newUser });
    },
    setToken: (token) => {
      storage.setItem('token', token);
      set({ token });
    },
    logout: () => {
      storage.removeItem('token');
      storage.removeItem('user');
      set({ user: null, token: null });
    },
    isAuthenticated: () => !!get().token,
    isAdmin: () => get().user?.role === 'admin',
    isManager: () => ['admin', 'leader', 'manager'].includes(get().user?.role),
    isStaff: () => ['staff', 'employee'].includes(get().user?.role),
  };

  return store;
}

function runClientAuthStoreTests(assert) {
  console.log('\n🖥️ [TEST SUITE: FRONTEND AUTH STORE & ROLE STATE]');

  const storage = new MockLocalStorage();
  const authStore = createMockAuthStore(storage);

  // TC-UI-AUTH-01: Khởi tạo ban đầu khi chưa đăng nhập
  assert(authStore.isAuthenticated() === false && authStore.isAdmin() === false,
    'TC-UI-AUTH-01: Chưa đăng nhập -> isAuthenticated=false, isAdmin=false');

  // TC-UI-AUTH-02: Đăng nhập vai trò Admin
  authStore.setToken('mock_jwt_token_admin');
  authStore.setUser({ _id: 'u_admin', full_name: 'Admin', role: 'admin' });
  assert(authStore.isAuthenticated() === true && authStore.isAdmin() === true && authStore.isManager() === true,
    'TC-UI-AUTH-02: User Admin -> isAuthenticated=true, isAdmin=true, isManager=true');

  // TC-UI-AUTH-03: Đăng nhập vai trò Leader
  authStore.setUser({ _id: 'u_lead', full_name: 'Trưởng Phòng', role: 'leader' });
  assert(authStore.isAdmin() === false && authStore.isManager() === true && authStore.isStaff() === false,
    'TC-UI-AUTH-03: User Leader -> isAdmin=false, isManager=true');

  // TC-UI-AUTH-04: Đăng nhập vai trò Legacy Manager (Tương thích)
  authStore.setUser({ _id: 'u_mgr', full_name: 'Legacy Manager', role: 'manager' });
  assert(authStore.isManager() === true,
    'TC-UI-AUTH-04: Legacy Role "manager" -> isManager()=true (Tương thích giao diện)');

  // TC-UI-AUTH-05: Đăng nhập vai trò Employee
  authStore.setUser({ _id: 'u_emp', full_name: 'Nhân Viên', role: 'employee' });
  assert(authStore.isAdmin() === false && authStore.isManager() === false && authStore.isStaff() === true,
    'TC-UI-AUTH-05: User Employee -> isStaff()=true, isManager()=false');

  // TC-UI-AUTH-06: Đăng xuất (Logout) -> Xóa sạch LocalStorage và State
  authStore.logout();
  assert(authStore.isAuthenticated() === false && authStore.getState().user === null && storage.getItem('token') === null,
    'TC-UI-AUTH-06: Đăng xuất (logout) -> Xóa sạch Token và User khỏi LocalStorage');
}

module.exports = runClientAuthStoreTests;
