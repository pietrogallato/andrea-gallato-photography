import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

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
