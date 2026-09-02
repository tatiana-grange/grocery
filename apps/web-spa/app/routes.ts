import type { RouteConfig } from '@react-router/dev/routes'
import { index, layout, route } from '@react-router/dev/routes'

export default [
  index('features/home/home-redirect.tsx'),
  layout('features/dashboard/dashboard-page.tsx', [
    route('dashboard', 'features/examples/user-posts/user-posts-page.tsx'),
    route('dashboard/posts/new', 'features/examples/user-posts/user-post-create-page.tsx'),
    route(
      'dashboard/posts/:userPostId/edit',
      'features/examples/user-posts/user-post-edit-page.tsx',
    ),
    route('ai', 'features/examples/ai/ai-page.tsx'),
    route('components', 'features/components/components-page.tsx'),
    route('dashboard/profile', 'features/profile/profile-page.tsx'),
  ]),
  layout('features/auth/components/auth-layout.tsx', [
    route('login', 'features/auth/pages/auth-login-page.tsx'),
    route('register', 'features/auth/pages/auth-register-page.tsx'),
    route('verify-email', 'features/auth/pages/auth-verify-email-page.tsx'),
    route('forgot-password', 'features/auth/pages/auth-forgot-password-page.tsx'),
    route('reset-password', 'features/auth/pages/auth-reset-password-page.tsx'),
  ]),
  layout('features/common/components/member-area-layout.tsx', [
    route('account', 'features/account/components/account-page.tsx'),
  ]),
  layout('features/common/components/back-office-layout.tsx', [
    route('admin/members', 'features/admin-members/components/members-list-page.tsx'),
    route('admin/members/:memberId', 'features/admin-members/components/member-detail-page.tsx'),
    route('admin/catalog', 'features/catalog/components/catalog-page.tsx'),
    route('admin/catalog/products/new', 'features/catalog/components/product-form-page.tsx'),
    route(
      'admin/catalog/products/:productId/edit',
      'features/catalog/components/product-form-page.tsx',
      { id: 'product-edit' },
    ),
    route(
      'admin/catalog/products/:productId',
      'features/catalog/components/product-detail-page.tsx',
    ),
  ]),
] satisfies RouteConfig
