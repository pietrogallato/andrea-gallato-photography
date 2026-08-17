import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom non implementa ResizeObserver, e senza non si monta piu nulla che
// guardi il proprio riquadro. Questo e un tappo inerte: non fa layout, quindi
// non scatterebbe comunque mai da solo. Chi vuole raccontare un riquadro che
// cambia misura se ne mette uno pilotabile con vi.stubGlobal.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
  draftMode: vi.fn(async () => ({ isEnabled: false, enable: vi.fn(), disable: vi.fn() })),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  usePathname: vi.fn(() => '/it'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}))
