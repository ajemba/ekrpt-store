/* ═══════════════════════════════════════════════════════════
   EKRPT — Role-Based Access Control (RBAC)
   Defines roles, permissions, and route guards.
   ═══════════════════════════════════════════════════════════ */

const ROLES = {
  super_admin: {
    label: 'Super Admin',
    color: '#d94040',
    home: '/super-admin/index.html',
    permissions: ['*'], // everything
  },
  admin: {
    label: 'Admin',
    color: '#1a8fc4',
    home: '/admin/index.html',
    permissions: ['orders.*', 'inventory.*', 'customers.*', 'analytics.view'],
  },
  marketing: {
    label: 'Marketing',
    color: '#9333ea',
    home: '/marketing/index.html',
    permissions: ['campaigns.*', 'promos.*', 'subscribers.*', 'emails.*', 'analytics.view'],
  },
  inventory: {
    label: 'Inventory Manager',
    color: '#16a34a',
    home: '/inventory/index.html',
    permissions: ['inventory.*', 'products.*', 'analytics.view'],
  },
  finance: {
    label: 'Finance',
    color: '#ca8a04',
    home: '/finance/index.html',
    permissions: ['billing.*', 'revenue.*', 'refunds.*', 'orders.view', 'analytics.view'],
  },
  maintenance: {
    label: 'Maintenance',
    color: '#0891b2',
    home: '/maintenance/index.html',
    permissions: ['system.*', 'logs.*', 'content.*'],
  },
  employee: {
    label: 'Employee',
    color: '#64748b',
    home: '/employee/index.html',
    permissions: ['orders.process', 'orders.view', 'inventory.view'],
  },
  customer: {
    label: 'Customer',
    color: '#475569',
    home: '/account/index.html',
    permissions: ['account.*', 'orders.own'],
  },
};

const RBAC = (() => {

  let _cachedUser = null;

  const getRole = async () => {
    const user = await Auth.getUser();
    _cachedUser = user;
    return user?.profile?.role || null;
  };

  const can = (role, permission) => {
    if (!role || !ROLES[role]) return false;
    const perms = ROLES[role].permissions;
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
    // wildcard match: 'orders.*' covers 'orders.view'
    const [resource] = permission.split('.');
    return perms.includes(resource + '.*');
  };

  // Guard a page — redirect if role lacks access
  const guard = async (requiredRoles) => {
    const role = await getRole();
    if (!role) {
      sessionStorage.setItem('ekrpt_redirect', location.href);
      location.href = '/login.html';
      return false;
    }
    const allowed = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    // super_admin can access everything
    if (role === 'super_admin' || allowed.includes(role)) return true;

    // Check suspended status
    if (_cachedUser?.profile?.suspended) {
      alert('Your account has been suspended. Contact the administrator.');
      await Auth.signOut();
      return false;
    }

    // Not allowed — redirect to their own home
    location.href = ROLES[role]?.home || '/index.html';
    return false;
  };

  // Super-admin only guard (for payment keys, admin management)
  const guardSuperAdmin = async () => {
    const role = await getRole();
    if (role !== 'super_admin') {
      location.href = role ? (ROLES[role]?.home || '/index.html') : '/login.html';
      return false;
    }
    return true;
  };

  const getUser = () => _cachedUser;

  return { ROLES, getRole, can, guard, guardSuperAdmin, getUser };
})();
