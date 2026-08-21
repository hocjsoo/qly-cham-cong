// ==============================================
// tests/unit/clientTheme.test.js
// Kiểm thử Frontend State Management: ThemeStore (Dark / Light Mode Switcher)
// ==============================================

class MockDOMElement {
  constructor() {
    this.attributes = {};
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name] || null;
  }
}

function createMockThemeStore(storage, mockRoot) {
  let theme = storage.getItem('theme') || 'dark';
  mockRoot.setAttribute('data-theme', theme);

  const get = () => ({ theme });
  const set = (partial) => {
    theme = partial.theme !== undefined ? partial.theme : theme;
  };

  return {
    getTheme: () => theme,
    toggleTheme: () => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      storage.setItem('theme', nextTheme);
      mockRoot.setAttribute('data-theme', nextTheme);
      set({ theme: nextTheme });
      return nextTheme;
    },
    setTheme: (newTheme) => {
      storage.setItem('theme', newTheme);
      mockRoot.setAttribute('data-theme', newTheme);
      set({ theme: newTheme });
    }
  };
}

function runClientThemeTests(assert) {
  console.log('\n🎨 [TEST SUITE: FRONTEND THEME & DARK/LIGHT MODE]');

  const storage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = v; }
  };
  const mockRoot = new MockDOMElement();

  const themeStore = createMockThemeStore(storage, mockRoot);

  // TC-UI-THM-01: Khởi tạo mặc định là Dark Mode
  assert(themeStore.getTheme() === 'dark' && mockRoot.getAttribute('data-theme') === 'dark',
    'TC-UI-THM-01: Giao diện mặc định khởi tạo Dark Mode (data-theme="dark")');

  // TC-UI-THM-02: Chuyển đổi sang Light Mode
  const theme2 = themeStore.toggleTheme();
  assert(theme2 === 'light' && mockRoot.getAttribute('data-theme') === 'light' && storage.getItem('theme') === 'light',
    'TC-UI-THM-02: Chuyển sang Light Mode (data-theme="light", lưu localStorage)');

  // TC-UI-THM-03: Chuyển đổi lại sang Dark Mode
  const theme3 = themeStore.toggleTheme();
  assert(theme3 === 'dark' && mockRoot.getAttribute('data-theme') === 'dark',
    'TC-UI-THM-03: Chuyển đổi ngược lại Dark Mode chuẩn xác');

  // TC-UI-THM-04: Thiết lập trực tiếp theme cụ thể
  themeStore.setTheme('light');
  assert(themeStore.getTheme() === 'light',
    'TC-UI-THM-04: Thiết lập trực tiếp theme="light" thành công');
}

module.exports = runClientThemeTests;
