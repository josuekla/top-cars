import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate, PauseMenu } from './index';

describe('UI Systems: AuthGate & PauseMenu', () => {
  let mockStorage: Record<string, string> = {};
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStorage = {};

    const localStorageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    vi.stubGlobal('localStorage', localStorageMock);

    // Mock do DOM básico
    class MockElement {
      tagName = 'DIV';
      id = '';
      innerHTML = '';
      style: Record<string, string> = {};
      children: MockElement[] = [];
      parentElement: MockElement | null = null;
      value = '';
      classList = {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn().mockReturnValue(false),
      };
      onclick: ((e: any) => void) | null = null;
      onkeydown: ((e: any) => void) | null = null;
      onmouseenter: (() => void) | null = null;
      onmouseleave: (() => void) | null = null;
      focus = vi.fn();
      remove = vi.fn();
      appendChild(child: MockElement) {
        this.children.push(child);
        child.parentElement = this;
        return child;
      }
      querySelector(selector: string): any {
        if (selector === '#auth-pass-input') {
          return this._findChildById('auth-pass-input');
        }
        if (selector === '#btn-auth-unlock') {
          return this._findChildById('btn-auth-unlock');
        }
        if (selector === '#auth-error-msg') {
          return this._findChildById('auth-error-msg');
        }
        if (selector === '#btn-pause-resume') {
          return this._findChildById('btn-pause-resume');
        }
        if (selector === '#btn-pause-restart') {
          return this._findChildById('btn-pause-restart');
        }
        if (selector === '#btn-pause-main') {
          return this._findChildById('btn-pause-main');
        }
        return null;
      }
      private _findChildById(id: string): any {
        if (this.id === id) return this;
        for (const child of this.children) {
          const found = child._findChildById(id);
          if (found) return found;
        }
        return null;
      }
    }

    // Mock document
    const mockDocument = {
      createElement: (tag: string) => {
        const el = new MockElement();
        el.tagName = tag.toUpperCase();
        return el as unknown as HTMLElement;
      },
    };

    vi.stubGlobal('document', mockDocument);
    container = mockDocument.createElement('div') as unknown as HTMLDivElement;
  });

  describe('AuthGate (Gatekeeper Protegido)', () => {
    it('verifica estado de bloqueio via localStorage', () => {
      expect(AuthGate.isUnlocked()).toBe(false);

      mockStorage['topgear_auth_unlocked'] = 'true';
      expect(AuthGate.isUnlocked()).toBe(true);
    });

    it('limpa estado de desbloqueio ao chamar lock()', () => {
      mockStorage['topgear_auth_unlocked'] = 'true';
      vi.stubGlobal('window', { location: { reload: vi.fn() } });

      AuthGate.lock();
      expect(mockStorage['topgear_auth_unlocked']).toBeUndefined();
    });

    it('não exibe dicas ou senhas no corpo visual do modal', () => {
      const onUnlock = vi.fn();
      const gate = new AuthGate(container, onUnlock);

      const overlay = (gate as any).overlay;
      expect(overlay.innerHTML).not.toContain('Dica:');
      expect(overlay.innerHTML).not.toContain('A senha padrão');
      expect(overlay.innerHTML).not.toContain('topgear2026');
    });
  });

  describe('PauseMenu (Menu de Pausa & Retomada)', () => {
    it('inicializa com estado pausado desligado', () => {
      const onResume = vi.fn();
      const onRestart = vi.fn();
      const onMainMenu = vi.fn();
      const onPause = vi.fn();

      const pauseMenu = new PauseMenu(container, {
        onResume,
        onRestart,
        onMainMenu,
        onPause,
      });

      expect(pauseMenu.isPaused).toBe(false);
    });

    it('alterna o estado de pausa e notifica callbacks apropriados', () => {
      const onResume = vi.fn();
      const onRestart = vi.fn();
      const onMainMenu = vi.fn();
      const onPause = vi.fn();

      const pauseMenu = new PauseMenu(container, {
        onResume,
        onRestart,
        onMainMenu,
        onPause,
      });

      pauseMenu.show();
      expect(pauseMenu.isPaused).toBe(true);
      expect(onPause).toHaveBeenCalled();

      pauseMenu.resume();
      expect(pauseMenu.isPaused).toBe(false);
      expect(onResume).toHaveBeenCalled();

      pauseMenu.restart();
      expect(pauseMenu.isPaused).toBe(false);
      expect(onRestart).toHaveBeenCalled();

      pauseMenu.mainMenu();
      expect(pauseMenu.isPaused).toBe(false);
      expect(onMainMenu).toHaveBeenCalled();
    });

    it('controla a visibilidade do botão flutuante [⏸️ PAUSAR]', () => {
      const pauseMenu = new PauseMenu(container, {
        onResume: vi.fn(),
        onRestart: vi.fn(),
        onMainMenu: vi.fn(),
      });

      pauseMenu.showPauseButton();
      const btn = (pauseMenu as any).pauseButton;
      expect(btn.style.display).toBe('block');

      pauseMenu.hidePauseButton();
      expect(btn.style.display).toBe('none');
    });
  });
});
