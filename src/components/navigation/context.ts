import { inject, type InjectionKey, type Ref } from 'vue'
export interface StackNavigation { push(path: string): Promise<void>; back(): Promise<void>; busy: Ref<boolean> }
export const navigationKey: InjectionKey<StackNavigation> = Symbol('navigation-stack')
export function useStackNavigation() {
  const navigation = inject(navigationKey)
  if (!navigation) throw new Error('Screen must be rendered inside NavigationStack')
  return navigation
}

