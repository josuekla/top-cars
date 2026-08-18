export type ScreenType = 'menu' | 'racing' | 'results';

export class ScreenManager {
  private currentScreen: ScreenType = 'menu';
  private listeners: Set<(screen: ScreenType) => void> = new Set();

  public get current(): ScreenType {
    return this.currentScreen;
  }

  public setScreen(screen: ScreenType): void {
    if (this.currentScreen === screen) return;
    this.currentScreen = screen;
    this.listeners.forEach((listener) => listener(screen));
  }

  public onScreenChange(callback: (screen: ScreenType) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}
