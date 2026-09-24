import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, request, store } from './api';

const CUSTOMER_TYPES = ['customer'];
const isCustomerType = (type) => CUSTOMER_TYPES.includes(type);
const isBrokerType = (type) => type === 'broker';
const isOwnerType = (type) => type === 'owner';

const AuthContext = createContext(null);
const OrgContext = createContext(null);

function useAuth() { return useContext(AuthContext); }
function useOrg() { return useContext(OrgContext); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(Boolean(store.token()));
  const navigate = useNavigate();

  useEffect(() => {
    if (!store.token()) { setLoading(false); return; }
    api.me().then((data) => {
      setUser(data.user);
      setOrganizations(data.organizations || []);
       navigate(isCustomerType(data.user.accountType) ? '/customer' : isOwnerType(data.user.accountType) ? '/owner' : isBrokerType(data.user.accountType) ? '/broker' : '/dashboard');
    }).catch(() => store.clear()).finally(() => setLoading(false));
  }, []);

  const finishAuth = (data) => {
    store.setToken(data.token);
    store.setRefresh(data.refreshToken);
    setUser(data.user);
    setOrganizations(data.organizations || []);
    if (isCustomerType(data.user.accountType)) navigate('/customer');
    else if (isOwnerType(data.user.accountType)) navigate('/owner');
    else if (isBrokerType(data.user.accountType)) navigate('/broker');
    else navigate('/dashboard');
  };

  const authenticate = async (promise) => {
    const tokens = await promise;
    // Store the token before requesting /me; /me requires Bearer authentication.
    store.setToken(tokens.token);
    store.setRefresh(tokens.refreshToken);
    const profile = await api.me();
    finishAuth({ ...tokens, ...profile });
  };
  const login = (email, password) => authenticate(api.login(email, password));
  const register = (payload) => authenticate(api.register(payload));
  const logout = async () => {
    try { await api.logout(); } catch (_error) { /* session may already be gone */ }
    store.clear(); setUser(null); setOrganizations([]); navigate('/login');
  };

  return <AuthContext.Provider value={{ user, setUser, organizations, setOrganizations, loading, login, register, logout }}>
    {children}
  </AuthContext.Provider>;
}

function OrgProvider({ children }) {
  const { user, organizations, setOrganizations } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState(store.org());

  useEffect(() => {
    if (!user || isCustomerType(user.accountType) || !orgId) {
      setOrganization(null); setMembers([]); return;
    }
    setLoading(true);
    Promise.all([api.getOrg(orgId), api.listMembers(orgId)])
      .then(([org, memberData]) => {
        setOrganization(org.data.organization);
        setMembers(memberData.data.members || []);
      })
      .finally(() => setLoading(false));
  }, [user, orgId]);

  const selectOrg = (id) => { store.setOrg(id); setOrgId(id); window.dispatchEvent(new Event('orgchange')); };
  const createOrg = async (payload) => {
    const created = await api.createOrg(payload);
    const data = await api.listOrgs();
    setOrganizations(data.data.organizations || []);
    selectOrg(created.data.organization._id);
    return created;
  };

  return <OrgContext.Provider value={{ organization, members, setMembers, organizations, loading, orgId, selectOrg, createOrg }}>
    {children}
  </OrgContext.Provider>;
}

function SocketBridge() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  useEffect(() => {
    if (!user || isCustomerType(user.accountType) || !orgId) return undefined;
    const socket = io(window.location.origin, { auth: { token: store.token() } });
    socket.on('connect', () => socket.emit('join_org', orgId));
    socket.on('task_created', () => window.dispatchEvent(new Event('workspace-refresh')));
    socket.on('task_updated', () => window.dispatchEvent(new Event('workspace-refresh')));
    socket.on('task_deleted', () => window.dispatchEvent(new Event('workspace-refresh')));
    return () => socket.disconnect();
  }, [user, orgId]);
  return null;
}

function Protected({ children, customer = false, owner = false, broker = false }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (customer && !isCustomerType(user.accountType)) return <Navigate to="/dashboard" replace />;
  if (owner && !isOwnerType(user.accountType)) return <Navigate to="/dashboard" replace />;
  if (broker && !isBrokerType(user.accountType)) return <Navigate to="/dashboard" replace />;
  if (!customer && isCustomerType(user.accountType)) return <Navigate to="/customer" replace />;
  return children;
}

function Loading() { return <div className="auth-wrap"><div className="auth-card"><p className="sub">Loading your account...</p></div></div>; }

function Brand({ dark = false }) { return <Link className="brand" to="/"><span className="brand-mark">⌂</span><span style={dark ? { color: '#fff' } : undefined}>RealState</span></Link>; }

function Button({ children, className = '', ...props }) { return <button className={`btn btn-primary ${className}`} {...props}>{children}</button>; }

function Message({ error, success }) {
  if (!error && !success) return null;
  return <div className={error ? 'error-text' : 'success-text'}>{error || success}</div>;
}

function Landing() {
  return <main className="landing react-page">
    <nav className="public-nav"><Brand /><div className="toolbar-actions"><Link className="btn btn-ghost" to="/login">Sign in</Link><Link className="btn btn-primary" to="/register">Join RealState</Link></div></nav>
    <section className="landing-hero">
      <p className="eyebrow">A clearer way to find your next address</p>
      <h1>Find a place that feels like yours.</h1>
      <p>Search with confidence, save the places you love, and connect with trusted property professionals in one calm workspace.</p>
    </section>
    <section className="landing-section"><p className="eyebrow">Built for both sides of the market</p><h2>One platform, two focused experiences.</h2><div className="card-grid"><article className="feature-card"><div className="listing-visual">🏠</div><h3>For customers</h3><p className="muted">Discover homes, compare listings, save favourites, and send enquiries without losing track.</p><Link className="btn btn-ghost" to="/register">Create a customer account</Link></article><article className="feature-card"><div className="listing-visual">🏢</div><h3>For property professionals</h3><p className="muted">Owners, brokers, and builders can manage listings, tasks, and incoming leads from one account.</p><Link className="btn btn-ghost" to="/register">Create a professional account</Link></article></div></section>
  </main>;
}

function AuthLayout({ title, subtitle, children, footer, showHome = false }) {
  return <div className="auth-wrap">{showHome && <Link className="btn btn-primary auth-home" to="/">Home</Link>}<div className="auth-card"><Brand /><h1>{title}</h1><p className="sub">{subtitle}</p>{children}<div className="auth-footer">{footer}</div></div></div>;
}

function authFieldError(name, value) {
  if (name === 'firstName' || name === 'lastName') return value.trim() ? '' : 'This field is required.';
  if (name === 'email') return /^\S+@\S+\.\S+$/.test(value.trim()) ? '' : 'Enter a valid email address.';
  if (name === 'password') {
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z\d]/.test(value)) return 'Use uppercase, lowercase, a number, and a special character.';
    return '';
  }
  if (name === 'phone') return value && !/^\d{10}$/.test(value) ? 'Phone number must contain exactly 10 digits.' : '';
  if (name === 'accountType') return value ? '' : 'Choose an account type.';
  if (name === 'termsAccepted') return value ? '' : 'You must accept the terms and privacy policy.';
  return '';
}

function AuthField({ label, name, error, children }) {
  return <label className={error ? 'field-error' : ''}>{label}{children}{error && <span className="error-text" role="alert">{error}</span>}</label>;
}

function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const validate = () => ({ email: authFieldError('email', form.email), password: form.password ? '' : 'Password is required.' });
  const update = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: '' }); setError(''); };
  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true); setError('');
    try { await login(form.email, form.password); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <AuthLayout title="Welcome back" subtitle="Sign in to continue to RealState." showHome footer={<>New here? <Link to="/register">Create an account</Link></>}>
    <Message error={error} /><form className="form-stack" noValidate onSubmit={submit}>
      <AuthField label="Email" name="email" error={errors.email}><input className={`form-control ${errors.email ? 'input-error' : ''}`} type="email" value={form.email} onChange={update('email')} onBlur={() => setErrors({ ...errors, email: authFieldError('email', form.email) })} aria-invalid={Boolean(errors.email)} /></AuthField>
      <AuthField label="Password" name="password" error={errors.password}><input className={`form-control ${errors.password ? 'input-error' : ''}`} type="password" value={form.password} onChange={update('password')} onBlur={() => setErrors({ ...errors, password: form.password ? '' : 'Password is required.' })} aria-invalid={Boolean(errors.password)} /></AuthField>
      <Button disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</Button><Link to="/forgot" className="muted">Forgot password?</Link>
    </form>
  </AuthLayout>;
}

function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', accountType: 'customer', customerType: 'buyer', termsAccepted: false });
  const [errors, setErrors] = useState({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const update = (key) => (event) => { setForm({ ...form, [key]: event.target.value }); setErrors({ ...errors, [key]: '' }); setError(''); };
  const validate = () => ({
    firstName: authFieldError('firstName', form.firstName), lastName: authFieldError('lastName', form.lastName),
    email: authFieldError('email', form.email), phone: authFieldError('phone', form.phone), password: authFieldError('password', form.password),
    confirmPassword: form.confirmPassword === form.password ? '' : 'Passwords do not match.', accountType: authFieldError('accountType', form.accountType), customerType: form.accountType === 'customer' && !form.customerType ? 'Choose a customer type.' : '',
    termsAccepted: form.termsAccepted ? '' : 'You must accept the terms and privacy policy.',
  });
  const submit = async (event) => {
    event.preventDefault(); const nextErrors = validate(); setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true); setError('');
    try { await register(form); } catch (err) { setError(err.data?.errors?.map((item) => item.msg).join('. ') || err.message); } finally { setBusy(false); }
  };
  const input = (key, props = {}) => <input className={`form-control ${errors[key] ? 'input-error' : ''}`} value={form[key]} onChange={update(key)} onBlur={() => setErrors({ ...errors, [key]: key === 'confirmPassword' ? (form.confirmPassword === form.password ? '' : 'Passwords do not match.') : authFieldError(key, form[key]) })} aria-invalid={Boolean(errors[key])} {...props} />;
  return <AuthLayout title="Create your account" subtitle="Choose your path. Your account type cannot be changed later." showHome footer={<>Already registered? <Link to="/login">Sign in</Link></>}>
    <Message error={error} /><form className="form-stack" noValidate onSubmit={submit}>
      <div className="form-row"><AuthField label="First name" error={errors.firstName}>{input('firstName')}</AuthField><AuthField label="Last name" error={errors.lastName}>{input('lastName')}</AuthField></div>
      <AuthField label="Email" error={errors.email}>{input('email', { type: 'email' })}</AuthField>
      <AuthField label="Password" error={errors.password}>{input('password', { type: 'password' })}</AuthField>
      <AuthField label="Confirm password" error={errors.confirmPassword}>{input('confirmPassword', { type: 'password' })}</AuthField>
      <AuthField label="Account type" error={errors.accountType}><select className={`form-control ${errors.accountType ? 'input-error' : ''}`} value={form.accountType} onChange={update('accountType')} onBlur={() => setErrors({ ...errors, accountType: authFieldError('accountType', form.accountType) })} aria-invalid={Boolean(errors.accountType)}><option value="customer">Customer</option><option value="broker">Broker</option><option value="owner">Owner</option><option value="builder">Builder</option></select></AuthField>
      {form.accountType === 'customer' && <AuthField label="Customer type" error={errors.customerType}><select className={`form-control ${errors.customerType ? 'input-error' : ''}`} value={form.customerType} onChange={update('customerType')} aria-invalid={Boolean(errors.customerType)}><option value="buyer">Buyer</option><option value="renter">Renter</option></select></AuthField>}
      <AuthField label="Phone (10 digits, optional)" error={errors.phone}>{input('phone', { type: 'tel', inputMode: 'numeric', maxLength: 15 })}</AuthField>
      <label className={errors.termsAccepted ? 'field-error' : ''}><input type="checkbox" checked={form.termsAccepted} onChange={(event) => { setForm({ ...form, termsAccepted: event.target.checked }); setErrors({ ...errors, termsAccepted: '' }); }} onBlur={() => setErrors({ ...errors, termsAccepted: form.termsAccepted ? '' : 'You must accept the terms and privacy policy.' })} /> I agree to the Terms of Service and Privacy Policy{errors.termsAccepted && <span className="error-text" role="alert">{errors.termsAccepted}</span>}</label>
       <small className="muted">This choice determines the tools in your account portal and is permanent.</small><Button disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</Button>
    </form>
  </AuthLayout>;
}

function Forgot() { const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); return <AuthLayout title="Reset password" subtitle="We will send a reset link if the account exists." footer={<Link to="/login">Back to sign in</Link>}><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); const data = await request('/api/auth/forgot-password', { method: 'POST', body: { email }, noOrg: true }); setMessage(data.message); }}><label>Email<input className="form-control" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><Button>Send reset link</Button><Message success={message} /></form></AuthLayout>; }

function CustomerNav() { const { user, logout } = useAuth(); return <nav className="public-nav"><Brand /><div className="toolbar-actions"><Link className="btn btn-ghost" to="/customer">Dashboard</Link><Link className="btn btn-ghost" to="/marketplace">Marketplace</Link><Link className="btn btn-ghost" to="/customer/favorites">Favorites</Link><Link className="btn btn-ghost" to="/customer/enquiries">Enquiries</Link><Link className="btn btn-ghost" to="/customer/support">Support</Link><Link className="btn btn-ghost" to="/customer/profile">{user.firstName}</Link><button className="btn btn-ghost" onClick={logout}>Logout</button></div></nav>; }

function CustomerHome() { const { user } = useAuth(); const [dashboard, setDashboard] = useState(null); useEffect(() => { api.customerDashboard().then(setDashboard); }, []); if (!dashboard) return <Loading />; return <main className="landing react-page"><CustomerNav /><section className="landing-section"><p className="eyebrow">{user.accountType} workspace</p><h1>Welcome, {user.firstName}.</h1><p className="muted">Keep your property search, enquiries, and support requests in one place.</p><div className="stats-grid"><div className="stat-card"><div className="label">Saved homes</div><div className="value">{dashboard.stats.favoriteCount}</div></div><div className="stat-card"><div className="label">Enquiries</div><div className="value">{dashboard.stats.enquiryCount}</div></div><div className="stat-card"><div className="label">Open support</div><div className="value">{dashboard.stats.openTicketCount}</div></div></div><div className="card-grid"><section className="panel"><div className="panel-head"><h3>Saved properties</h3><Link to="/customer/favorites">View all</Link></div>{dashboard.recentFavorites.length ? dashboard.recentFavorites.map((favorite) => <Link className="list-row" key={favorite._id} to={`/marketplace/${favorite.propertyId?._id}`}><strong>{favorite.propertyId?.title || 'Unavailable property'}</strong><span className="muted">{favorite.propertyId?.location?.city || ''}</span></Link>) : <div className="empty-state">Save properties from the marketplace to see them here.</div>}</section><section className="panel"><div className="panel-head"><h3>Recent enquiries</h3><Link to="/customer/enquiries">View all</Link></div>{dashboard.recentEnquiries.length ? dashboard.recentEnquiries.map((enquiry) => <Link className="list-row" key={enquiry._id} to={`/marketplace/${enquiry.propertyId?._id}`}><strong>{enquiry.propertyId?.title || 'Property enquiry'}</strong><span className="badge badge-blue">{enquiry.status}</span></Link>) : <div className="empty-state">Your submitted enquiries will appear here.</div>}</section></div></section></main>; }

function CustomerFavorites() { const [favorites, setFavorites] = useState(null); useEffect(() => { api.favorites().then((data) => setFavorites(data.favorites)); }, []); return <main className="landing react-page"><CustomerNav /><section className="landing-section"><p className="eyebrow">Your shortlist</p><h1>Saved properties</h1>{!favorites ? <Loading /> : favorites.length ? <div className="card-grid">{favorites.map((favorite) => favorite.propertyId && <Link className="listing-card" key={favorite._id} to={`/marketplace/${favorite.propertyId._id}`}><div className="listing-visual">♡</div><h3>{favorite.propertyId.title}</h3><p className="muted">{favorite.propertyId.location?.city}</p><strong>₹{Number(favorite.propertyId.price || 0).toLocaleString('en-IN')}</strong></Link>)}</div> : <div className="empty-state">You have not saved any properties yet.</div>}</section></main>; }

function CustomerEnquiries() { const [enquiries, setEnquiries] = useState(null); useEffect(() => { api.enquiries().then((data) => setEnquiries(data.enquiries)); }, []); return <main className="landing react-page"><CustomerNav /><section className="landing-section"><p className="eyebrow">Your conversations</p><h1>Enquiries</h1>{!enquiries ? <Loading /> : <section className="panel">{enquiries.length ? enquiries.map((enquiry) => <div className="list-row" key={enquiry._id}><div><strong>{enquiry.propertyId?.title || 'Property'}</strong><div className="muted">{enquiry.message}</div></div><span className="badge badge-blue">{enquiry.status}</span></div>) : <div className="empty-state">No enquiries yet. Find a property and contact the professional.</div>}</section>}</section></main>; }

function CustomerSupport() { const [tickets, setTickets] = useState([]); const [form, setForm] = useState({ subject: '', category: 'other', message: '' }); const [message, setMessage] = useState(''); const load = () => api.supportTickets().then((data) => setTickets(data.tickets || [])); useEffect(() => { load(); }, []); return <main className="landing react-page"><CustomerNav /><section className="landing-section"><p className="eyebrow">Help center</p><h1>Support</h1><div className="card-grid"><section className="panel"><h3>Contact support</h3><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); await api.createSupportTicket(form); setForm({ subject: '', category: 'other', message: '' }); setMessage('Support request submitted.'); load(); }}><input className="form-control" required placeholder="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /><select className="form-control" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="account">Account</option><option value="property">Property</option><option value="enquiry">Enquiry</option><option value="technical">Technical</option><option value="other">Other</option></select><textarea className="form-control" required placeholder="How can we help?" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /><Button>Submit request</Button><Message success={message} /></form></section><section className="panel"><h3>Your requests</h3>{tickets.length ? tickets.map((ticket) => <div className="list-row" key={ticket._id}><div><strong>{ticket.subject}</strong><div className="muted">{ticket.category}</div></div><span className="badge badge-blue">{ticket.status}</span></div>) : <div className="empty-state">No support requests.</div>}</section></div></section></main>; }

function CustomerProfile() { const { user, setUser } = useAuth(); const [form, setForm] = useState({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' }); const [message, setMessage] = useState(''); const [error, setError] = useState(''); return <main className="landing react-page"><CustomerNav /><section className="landing-section"><p className="eyebrow">Account</p><h1>Your profile</h1><section className="panel narrow"><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setError(''); try { const data = await api.updateCustomerProfile(form); setUser({ ...user, ...data.user }); setMessage('Profile updated successfully.'); } catch (err) { setError(err.message); } }}><div className="form-row"><input className="form-control" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="First name" /><input className="form-control" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Last name" /></div><input className="form-control" readOnly value={user.email} /><input className="form-control" inputMode="numeric" maxLength="10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone (10 digits)" /><Button>Save profile</Button><Message error={error} success={message} /></form><p className="muted">Account type: {user.accountType}. This cannot be changed.</p></section></section></main>; }

function BrokerHome() {
  const { user } = useAuth(); const [dashboard, setDashboard] = useState(null);
  useEffect(() => { api.brokerDashboard().then(setDashboard); }, []);
  if (!dashboard) return <Loading />;
  return <><div className="page-head"><div><p className="eyebrow">Broker portal</p><h1>Good morning, {user.firstName}.</h1><p className="muted">Manage assigned listings and convert enquiries into visits.</p></div><Link className="btn btn-primary" to="/properties/new">Add listing</Link></div><div className="stats-grid"><div className="stat-card"><div className="label">Managed listings</div><div className="value">{dashboard.stats.listingCount}</div></div><div className="stat-card"><div className="label">Active listings</div><div className="value">{dashboard.stats.activeListingCount}</div></div><div className="stat-card"><div className="label">New leads</div><div className="value">{dashboard.stats.newLeadCount}</div></div><div className="stat-card"><div className="label">Open leads</div><div className="value">{dashboard.stats.openLeadCount}</div></div></div><div className="content-grid"><section className="panel"><div className="panel-head"><h3>Assigned listings</h3><Link to="/properties">View all</Link></div>{dashboard.recentProperties.length ? dashboard.recentProperties.map((property) => <Link className="list-row" key={property._id} to={`/properties/${property._id}`}><div><strong>{property.title}</strong><div className="muted">{property.location?.city} · {property.status}</div></div><strong>₹{Number(property.price || 0).toLocaleString('en-IN')}</strong></Link>) : <div className="empty-state">No listings have been assigned yet.</div>}</section><section className="panel"><div className="panel-head"><h3>Latest leads</h3><Link to="/broker/leads">View all</Link></div>{dashboard.recentEnquiries.length ? dashboard.recentEnquiries.map((enquiry) => <Link className="list-row" key={enquiry._id} to="/broker/leads"><div><strong>{enquiry.userId?.firstName} {enquiry.userId?.lastName}</strong><div className="muted">{enquiry.propertyId?.title}</div></div><span className="badge badge-blue">{enquiry.status}</span></Link>) : <div className="empty-state">No leads yet.</div>}</section></div></>;
}

function BrokerLeads() { const [leads, setLeads] = useState(null); const [error, setError] = useState(''); useEffect(() => { api.brokerEnquiries().then((data) => setLeads(data.enquiries || [])).catch((err) => setError(err.message)); }, []); const updateStatus = async (id, status) => { try { const data = await api.updateBrokerEnquiry(id, { status }); setLeads((items) => items.map((item) => item._id === id ? data.enquiry : item)); } catch (err) { setError(err.message); } }; return <><div className="page-head"><div><p className="eyebrow">Lead pipeline</p><h1>Leads</h1><p className="muted">Track every customer conversation across your assigned listings.</p></div></div><Message error={error} />{!leads ? <Loading /> : leads.length ? <section className="panel">{leads.map((lead) => <div className="list-row owner-enquiry" key={lead._id}><div><strong>{lead.userId?.firstName} {lead.userId?.lastName}</strong><div className="muted">{lead.userId?.email} · {lead.userId?.phone || 'No phone provided'}</div><div className="muted">{lead.propertyId?.title} · {lead.message}</div></div><select className="form-control owner-status" value={lead.status} onChange={(event) => updateStatus(lead._id, event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="visit_scheduled">Visit scheduled</option><option value="closed">Closed</option></select></div>)}</section> : <div className="empty-state">Customer enquiries will appear here.</div>}</>; }

function BrokerProfile() { const { user, setUser } = useAuth(); const [form, setForm] = useState({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' }); const [message, setMessage] = useState(''); const [error, setError] = useState(''); return <><div className="page-head"><div><p className="eyebrow">Account</p><h1>Broker profile</h1></div></div><section className="panel narrow"><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setError(''); try { const data = await api.updateBrokerProfile(form); setUser({ ...user, ...data.user }); setMessage('Profile updated successfully.'); } catch (err) { setError(err.message); } }}><div className="form-row"><input className="form-control" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="First name" /><input className="form-control" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Last name" /></div><input className="form-control" readOnly value={user.email} /><input className="form-control" inputMode="numeric" maxLength="10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone (10 digits)" /><Button>Save profile</Button><Message error={error} success={message} /></form><p className="muted">Account type: Broker. Your account type cannot be changed.</p></section></>; }

function OwnerHome() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  useEffect(() => { api.ownerDashboard().then(setDashboard); }, []);
  if (!dashboard) return <Loading />;
  return <>
    <div className="page-head"><div><p className="eyebrow">Owner portal</p><h1>Welcome back, {user.firstName}.</h1><p className="muted">Keep your listings and buyer conversations moving.</p></div><Link className="btn btn-primary" to="/properties/new">List a property</Link></div>
    <div className="stats-grid"><div className="stat-card"><div className="label">My properties</div><div className="value">{dashboard.stats.propertyCount}</div></div><div className="stat-card"><div className="label">Active listings</div><div className="value">{dashboard.stats.activeListingCount}</div></div><div className="stat-card"><div className="label">Property views</div><div className="value">{dashboard.stats.totalViews}</div></div><div className="stat-card"><div className="label">Enquiries</div><div className="value">{dashboard.stats.enquiryCount}</div></div></div>
    <div className="content-grid"><section className="panel"><div className="panel-head"><h3>Recent properties</h3><Link to="/properties">View all</Link></div>{dashboard.recentProperties.length ? dashboard.recentProperties.map((property) => <Link className="list-row" key={property._id} to={`/properties/${property._id}`}><div><strong>{property.title}</strong><div className="muted">{property.location?.city} · {property.status}</div></div><strong>₹{Number(property.price || 0).toLocaleString('en-IN')}</strong></Link>) : <div className="empty-state">List your first property to start receiving enquiries.</div>}</section><section className="panel"><div className="panel-head"><h3>Latest enquiries</h3><Link to="/owner/enquiries">View all</Link></div>{dashboard.recentEnquiries.length ? dashboard.recentEnquiries.map((enquiry) => <Link className="list-row" key={enquiry._id} to="/owner/enquiries"><div><strong>{enquiry.userId?.firstName} {enquiry.userId?.lastName}</strong><div className="muted">{enquiry.propertyId?.title}</div></div><span className="badge badge-blue">{enquiry.status}</span></Link>) : <div className="empty-state">No enquiries yet.</div>}</section></div>
  </>;
}

function OwnerEnquiries() {
  const [enquiries, setEnquiries] = useState(null);
  const [error, setError] = useState('');
  const load = () => api.ownerEnquiries().then((data) => setEnquiries(data.enquiries || [])).catch((err) => setError(err.message));
  useEffect(load, []);
  const updateStatus = async (id, status) => { try { const data = await api.updateOwnerEnquiry(id, { status }); setEnquiries((items) => items.map((item) => item._id === id ? data.enquiry : item)); } catch (err) { setError(err.message); } };
  return <><div className="page-head"><div><p className="eyebrow">Conversations</p><h1>Enquiries</h1><p className="muted">Follow up with people interested in your properties.</p></div></div><Message error={error} />{!enquiries ? <Loading /> : enquiries.length ? <section className="panel">{enquiries.map((enquiry) => <div className="list-row owner-enquiry" key={enquiry._id}><div><strong>{enquiry.userId?.firstName} {enquiry.userId?.lastName}</strong><div className="muted">{enquiry.userId?.email} · {enquiry.userId?.phone || 'No phone provided'}</div><div className="muted">{enquiry.propertyId?.title} · {enquiry.message}</div></div><select className="form-control owner-status" value={enquiry.status} onChange={(event) => updateStatus(enquiry._id, event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="visit_scheduled">Visit scheduled</option><option value="closed">Closed</option></select></div>)}</section> : <div className="empty-state">Enquiries from your property listings will appear here.</div>}</>;
}

function OwnerProfile() { const { user, setUser } = useAuth(); const [form, setForm] = useState({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '' }); const [message, setMessage] = useState(''); const [error, setError] = useState(''); return <><div className="page-head"><div><p className="eyebrow">Account</p><h1>Owner profile</h1></div></div><section className="panel narrow"><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setError(''); try { const data = await api.updateOwnerProfile(form); setUser({ ...user, ...data.user }); setMessage('Profile updated successfully.'); } catch (err) { setError(err.message); } }}><div className="form-row"><input className="form-control" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} placeholder="First name" /><input className="form-control" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} placeholder="Last name" /></div><input className="form-control" readOnly value={user.email} /><input className="form-control" inputMode="numeric" maxLength="10" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone (10 digits)" /><Button>Save profile</Button><Message error={error} success={message} /></form><p className="muted">Account type: Owner. Your account type cannot be changed.</p></section></>; }

function OwnerBrokers() { const [properties, setProperties] = useState([]); const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const load = () => api.listProperties({ limit: 100 }).then((data) => setProperties(data.properties || [])).catch((err) => setError(err.message)); useEffect(load, []); const update = async (propertyId, action) => { try { await api.assignOwnerBroker(propertyId, { brokerEmail: email, action }); setMessage(action === 'assign' ? 'Broker assigned successfully.' : 'Broker removed successfully.'); setEmail(''); load(); } catch (err) { setError(err.message); } }; return <><div className="page-head"><div><p className="eyebrow">Listing access</p><h1>Broker access</h1><p className="muted">Authorize brokers to market your properties and manage their leads.</p></div></div><Message error={error} success={message} /><section className="panel"><h3>Assign a broker</h3><p className="muted">Enter an existing broker account email, then choose a property below.</p><input className="form-control" type="email" required placeholder="broker@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></section><section className="panel">{properties.length ? properties.map((property) => <div className="list-row" key={property._id}><div><strong>{property.title}</strong><div className="muted">{property.location?.city} · {property.brokerIds?.length || 0} broker(s) assigned</div></div><div className="toolbar-actions"><button className="btn btn-primary" disabled={!email} onClick={() => update(property._id, 'assign')}>Assign</button><button className="btn btn-ghost" disabled={!email} onClick={() => update(property._id, 'revoke')}>Remove</button></div></div>) : <div className="empty-state">Create a property before assigning a broker.</div>}</section></>; }

function Marketplace() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ q: params.get('q') || '', city: '', propertyType: '', listingType: '' });
  const [properties, setProperties] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = () => { setLoading(true); setError(''); api.publicProperties({ ...filters, limit: 24 }).then((data) => setProperties(data.properties || [])).catch((err) => setError(err.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  return <main className="landing react-page"><CustomerNav /><section className="landing-section"><p className="eyebrow">Marketplace</p><h1>Find your next place.</h1><form className="landing-search" onSubmit={(event) => { event.preventDefault(); load(); }}><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search by keyword" /><input value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })} placeholder="City" /><select value={filters.propertyType} onChange={(event) => setFilters({ ...filters, propertyType: event.target.value })}><option value="">All types</option><option value="apartment">Apartment</option><option value="house">House</option><option value="villa">Villa</option><option value="plot">Plot</option></select><Button type="submit">Search</Button></form><Message error={error} />{loading ? <Loading /> : properties.length ? <div className="card-grid">{properties.map((property) => <Link className="listing-card" key={property._id} to={`/marketplace/${property._id}`}><div className="listing-visual">🏠</div><span className="badge badge-blue">{property.listingType}</span><h3>{property.title}</h3><p className="muted">{property.location?.city}, {property.location?.state}</p><strong>₹{Number(property.price || 0).toLocaleString('en-IN')}</strong></Link>)}</div> : <div className="empty-state">No available properties match your search.</div>}</section></main>;
}

function MarketplaceDetailLegacy() { const { user, logout } = useAuth(); const { id } = useParams(); const [property, setProperty] = useState(null); const [error, setError] = useState(''); useEffect(() => { api.publicProperty(id).then((data) => setProperty(data.property)).catch((err) => setError(err.message)); }, [id]); if (error) return <main className="landing react-page"><section className="landing-section"><Message error={error} /><Link to="/marketplace">Back to marketplace</Link></section></main>; if (!property) return <Loading />; return <main className="landing react-page"><nav className="public-nav"><Brand /><div className="toolbar-actions"><span className="muted">Hi, {user.firstName}</span><button className="btn btn-ghost" onClick={logout}>Logout</button></div></nav><section className="landing-section"><Link to="/marketplace" className="muted">← Back to marketplace</Link><p className="eyebrow">{property.listingType} · {property.propertyType}</p><h1>{property.title}</h1><p className="muted">{property.location?.address}, {property.location?.city}, {property.location?.state}</p><section className="panel"><div className="stats-grid"><div><span className="muted">Price</span><h2>₹{Number(property.price || 0).toLocaleString('en-IN')}</h2></div><div><span className="muted">Area</span><h2>{property.area?.superArea || '—'} sqft</h2></div><div><span className="muted">Listed by</span><h2>{property.organizationId?.name || 'Property professional'}</h2></div></div><p>{property.description}</p><button className="btn btn-primary" type="button">Contact property professional</button></section></section></main>; }

function MarketplaceDetail() {
  const { id } = useParams(); const [property, setProperty] = useState(null); const [saved, setSaved] = useState(false); const [message, setMessage] = useState(''); const [enquiry, setEnquiry] = useState('');
  useEffect(() => { Promise.all([api.publicProperty(id), api.favorites()]).then(([propertyData, favorites]) => { setProperty(propertyData.property); setSaved(favorites.favorites.some((item) => item.propertyId?._id === id)); }); }, [id]);
  if (!property) return <Loading />;
  const toggleFavorite = async () => { if (saved) { await api.removeFavorite(id); setSaved(false); } else { await api.addFavorite(id); setSaved(true); } };
  return <main className="landing react-page"><CustomerNav /><section className="landing-section"><Link to="/marketplace" className="muted">← Back to marketplace</Link><p className="eyebrow">{property.listingType} · {property.propertyType}</p><h1>{property.title}</h1><p className="muted">{property.location?.address}, {property.location?.city}, {property.location?.state}</p><section className="panel"><div className="stats-grid"><div><span className="muted">Price</span><h2>₹{Number(property.price || 0).toLocaleString('en-IN')}</h2></div><div><span className="muted">Area</span><h2>{property.area?.superArea || '—'} sqft</h2></div><div><span className="muted">Listed by</span><h2>{property.organizationId?.name || 'Property professional'}</h2></div></div><p>{property.description}</p><div className="toolbar-actions"><button className="btn btn-ghost" onClick={toggleFavorite}>{saved ? 'Remove favorite' : 'Save favorite'}</button></div><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); const data = await api.createEnquiry({ propertyId: id, message: enquiry }); setMessage(data.message); setEnquiry(''); }}><textarea className="form-control" required placeholder="Ask about this property or request a viewing" value={enquiry} onChange={(event) => setEnquiry(event.target.value)} /><Button>Send enquiry</Button><Message success={message} /></form></section></section></main>;
}

function OrgSelect() { return <Navigate to="/dashboard" replace />; }

function BrokerNavbar() { const { user, logout } = useAuth(); const nav = [{ to: '/broker', label: 'Dashboard' }, { to: '/properties', label: 'My listings' }, { to: '/broker/leads', label: 'Leads' }, { to: '/tasks', label: 'Follow-ups' }, { to: '/broker/profile', label: 'Profile' }]; return <header className="broker-navbar"><Link className="broker-brand" to="/broker"><span className="brand-mark">⌂</span><span>RealState</span></Link><nav className="broker-nav-links">{nav.map((item) => <NavLink end={item.to === '/broker'} className="broker-nav-link" key={item.to} to={item.to}>{item.label}</NavLink>)}</nav><div className="broker-nav-account"><span className="broker-user">{user.firstName} {user.lastName}</span><button className="btn btn-ghost" onClick={logout}>Logout</button></div></header>; }

function BrokerPageFrame() { return <div className="broker-page-frame"><BrokerNavbar /><main className="broker-page-content"><Outlet /></main></div>; }

function OrganizationLayout() { const { user, logout } = useAuth(); if (isBrokerType(user.accountType)) return <BrokerPageFrame />; const nav = [{ to: '/dashboard', label: 'Dashboard', icon: '◈' }, { to: '/properties', label: 'Properties', icon: '⌂' }, { to: '/tasks', label: 'Tasks', icon: '✓' }]; return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><span className="logo-mark">⌂</span><span>RealState</span></div><nav className="sidebar-nav">{nav.map((item) => <NavLink className="nav-item" key={item.to} to={item.to}><span className="ico">{item.icon}</span>{item.label}</NavLink>)}</nav><div className="sidebar-user"><div className="avatar avatar-sm">{user.firstName?.[0]}</div><div className="info"><div className="name">{user.firstName} {user.lastName}</div><div className="org">{user.accountType} account</div></div><button className="logout-btn" onClick={logout}>⎋</button></div></aside><div className="main"><header className="topbar"><span className="muted">{user.accountType} account portal</span><div className="topbar-spacer" /><Link className="btn btn-ghost" to="/">Public site</Link></header><main className="content"><Outlet /></main></div></div>; }

function BrokerLayout() { return <BrokerPageFrame />; }

function OwnerLayout() { const { user, logout } = useAuth(); const nav = [{ to: '/owner', label: 'Dashboard', icon: '◈' }, { to: '/properties', label: 'My properties', icon: '⌂' }, { to: '/owner/enquiries', label: 'Enquiries', icon: '✉' }, { to: '/owner/brokers', label: 'Broker access', icon: '↗' }, { to: '/owner/profile', label: 'Profile', icon: '●' }]; return <div className="app-shell owner-shell"><aside className="sidebar"><div className="sidebar-brand"><span className="logo-mark">⌂</span><span>RealState</span></div><nav className="sidebar-nav">{nav.map((item) => <NavLink end={item.to === '/owner'} className="nav-item" key={item.to} to={item.to}><span className="ico">{item.icon}</span>{item.label}</NavLink>)}</nav><div className="sidebar-user"><div className="avatar avatar-sm">{user.firstName?.[0]}</div><div className="info"><div className="name">{user.firstName} {user.lastName}</div><div className="org">Owner account</div></div><button className="logout-btn" onClick={logout}>⎋</button></div></aside><div className="main"><header className="topbar"><span className="muted">Owner portal</span><div className="topbar-spacer" /><Link className="btn btn-ghost" to="/">Public site</Link></header><main className="content"><Outlet /></main></div></div>; }

function RequireOrg() { return <Outlet />; }

function Dashboard() { const { organization } = useOrg(); const [stats, setStats] = useState({}); const [properties, setProperties] = useState([]); const [tasks, setTasks] = useState([]); useEffect(() => { Promise.all([api.propertyStats(), api.listProperties({ limit: 5 }), api.listTasks({ limit: 5 })]).then(([statsData, propertyData, taskData]) => { setStats(statsData.stats || {}); setProperties(propertyData.properties || []); setTasks(taskData.tasks || []); }); }, []); return <><div className="page-head"><div><p className="eyebrow">{organization?.name || 'Workspace'}</p><h1>Good to see you.</h1><p className="muted">Your property operations at a glance.</p></div></div><div className="stats-grid"><div className="stat-card"><div className="label">Properties</div><div className="value">{stats.total || 0}</div></div><div className="stat-card"><div className="label">Total views</div><div className="value">{stats.totalViews || 0}</div></div><div className="stat-card"><div className="label">Open tasks</div><div className="value">{tasks.filter((task) => task.status !== 'completed').length}</div></div><div className="stat-card"><div className="label">Average price</div><div className="value">₹{Math.round(stats.avgPrice || 0).toLocaleString('en-IN')}</div></div></div><div className="content-grid"><section className="panel"><div className="panel-head"><h3>Recent properties</h3><Link to="/properties">View all</Link></div>{properties.length ? properties.map((property) => <Link className="list-row" key={property._id} to={`/properties/${property._id}`}><div><strong>{property.title}</strong><div className="muted">{property.location?.city} · {property.propertyType}</div></div><strong>₹{Number(property.price || 0).toLocaleString('en-IN')}</strong></Link>) : <div className="empty-state">No properties yet.</div>}</section><section className="panel"><div className="panel-head"><h3>Task queue</h3><Link to="/tasks">View all</Link></div>{tasks.length ? tasks.map((task) => <Link className="list-row" key={task._id} to={`/tasks/${task._id}`}><div><strong>{task.title}</strong><div className="muted">{task.priority} priority</div></div><span className="badge badge-blue">{task.status}</span></Link>) : <div className="empty-state">No tasks yet.</div>}</section></div></>; }

function Properties() { const [properties, setProperties] = useState([]); const [query, setQuery] = useState(''); const [busy, setBusy] = useState(true); const navigate = useNavigate(); const load = () => { setBusy(true); api.listProperties({ limit: 100, search: query }).then((data) => setProperties(data.properties || [])).finally(() => setBusy(false)); }; useEffect(load, []); return <><div className="page-head"><div><p className="eyebrow">Inventory</p><h1>Properties</h1></div><Link className="btn btn-primary" to="/properties/new">Add property</Link></div><div className="toolbar"><input className="form-control" style={{ maxWidth: 420 }} placeholder="Search properties" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} /><button className="btn btn-ghost" onClick={load}>Search</button></div>{busy ? <Loading /> : properties.length ? <div className="card-grid">{properties.map((property) => <article className="listing-card" key={property._id} onClick={() => navigate(`/properties/${property._id}`)}><div className="listing-visual">🏠</div><span className="badge badge-blue">{property.status}</span><h3>{property.title}</h3><p className="muted">{property.location?.city}, {property.location?.state}</p><strong>₹{Number(property.price || 0).toLocaleString('en-IN')}</strong></article>)}</div> : <div className="empty-state">No properties found.</div>}</>; }

function PropertyForm() { const navigate = useNavigate(); const [error, setError] = useState(''); const [form, setForm] = useState({ title: '', description: '', propertyType: 'apartment', listingType: 'sale', price: '', city: '', state: '', address: '', superArea: '', ownerName: '', ownerPhone: '' }); const update = (key) => (event) => setForm({ ...form, [key]: event.target.value }); return <section className="panel narrow"><div className="panel-head"><h2>Add property</h2><Link to="/properties">Cancel</Link></div><Message error={error} /><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); try { const payload = { title: form.title, description: form.description, propertyType: form.propertyType, listingType: form.listingType, price: Number(form.price), location: { address: form.address, city: form.city, state: form.state }, features: { superArea: Number(form.superArea) }, area: { superArea: Number(form.superArea) }, owner: { name: form.ownerName, phone: form.ownerPhone } }; const data = await api.createProperty(payload); navigate(`/properties/${data.property.id}`); } catch (err) { setError(err.message); } }}><input className="form-control" required minLength="5" placeholder="Property title" value={form.title} onChange={update('title')} /><textarea className="form-control" required placeholder="Description" value={form.description} onChange={update('description')} /><div className="form-row"><select className="form-control" value={form.propertyType} onChange={update('propertyType')}><option>apartment</option><option>house</option><option>villa</option><option>plot</option><option>commercial</option></select><select className="form-control" value={form.listingType} onChange={update('listingType')}><option>sale</option><option>rent</option><option>lease</option></select></div><div className="form-row"><input className="form-control" required type="number" placeholder="Price" value={form.price} onChange={update('price')} /><input className="form-control" required type="number" placeholder="Super area" value={form.superArea} onChange={update('superArea')} /></div><div className="form-row"><input className="form-control" required placeholder="City" value={form.city} onChange={update('city')} /><input className="form-control" required placeholder="State" value={form.state} onChange={update('state')} /></div><input className="form-control" required placeholder="Address" value={form.address} onChange={update('address')} /><div className="form-row"><input className="form-control" required placeholder="Owner name" value={form.ownerName} onChange={update('ownerName')} /><input className="form-control" required placeholder="Owner phone" value={form.ownerPhone} onChange={update('ownerPhone')} /></div><Button>Create property</Button></form></section>; }

function PropertyDetail() { const { id } = useParams(); const navigate = useNavigate(); const [property, setProperty] = useState(null); const [error, setError] = useState(''); useEffect(() => { api.getProperty(id).then((data) => setProperty(data.property)).catch((err) => setError(err.message)); }, [id]); if (error) return <Message error={error} />; if (!property) return <Loading />; return <><div className="page-head"><div><p className="eyebrow">Property detail</p><h1>{property.title}</h1><p className="muted">{property.location?.address}, {property.location?.city}</p></div><button className="btn btn-danger" onClick={async () => { await api.deleteProperty(id); navigate('/properties'); }}>Delete</button></div><section className="panel"><div className="stats-grid"><div><span className="muted">Price</span><h2>₹{Number(property.price || 0).toLocaleString('en-IN')}</h2></div><div><span className="muted">Status</span><h2>{property.status}</h2></div><div><span className="muted">Type</span><h2>{property.propertyType}</h2></div></div><p>{property.description}</p></section></>; }

function Tasks() { const [tasks, setTasks] = useState([]); const [busy, setBusy] = useState(true); const load = () => { setBusy(true); api.listTasks({ limit: 100 }).then((data) => setTasks(data.tasks || [])).finally(() => setBusy(false)); }; useEffect(load, []); return <><div className="page-head"><div><p className="eyebrow">Operations</p><h1>Tasks</h1></div><Link className="btn btn-primary" to="/tasks/new">New task</Link></div>{busy ? <Loading /> : <section className="panel">{tasks.length ? tasks.map((task) => <Link className="list-row" key={task._id} to={`/tasks/${task._id}`}><div><strong>{task.title}</strong><div className="muted">{task.taskType} · {task.priority}</div></div><span className="badge badge-blue">{task.status}</span></Link>) : <div className="empty-state">No tasks yet.</div>}</section>}</>; }

function TaskForm() { const navigate = useNavigate(); const [form, setForm] = useState({ title: '', taskType: 'follow_up', priority: 'medium', description: '' }); const [error, setError] = useState(''); const update = (key) => (event) => setForm({ ...form, [key]: event.target.value }); return <section className="panel narrow"><div className="panel-head"><h2>New task</h2><Link to="/tasks">Cancel</Link></div><Message error={error} /><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); try { const data = await api.createTask(form); navigate(`/tasks/${data.task._id}`); } catch (err) { setError(err.message); } }}><input className="form-control" required placeholder="Task title" value={form.title} onChange={update('title')} /><textarea className="form-control" placeholder="Description" value={form.description} onChange={update('description')} /><div className="form-row"><select className="form-control" value={form.taskType} onChange={update('taskType')}><option>follow_up</option><option>site_visit</option><option>negotiation</option><option>documentation</option><option>maintenance</option></select><select className="form-control" value={form.priority} onChange={update('priority')}><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></div><Button>Create task</Button></form></section>; }

function TaskDetail() { const { id } = useParams(); const [task, setTask] = useState(null); const [comment, setComment] = useState(''); useEffect(() => { api.getTask(id).then((data) => setTask(data.task)); }, [id]); if (!task) return <Loading />; return <><div className="page-head"><div><p className="eyebrow">Task detail</p><h1>{task.title}</h1><p className="muted">{task.priority} priority · {task.status}</p></div><button className="btn btn-primary" onClick={async () => { await api.updateTask(id, { status: 'completed' }); setTask({ ...task, status: 'completed' }); }}>Mark complete</button></div><section className="panel"><p>{task.description || 'No description.'}</p><h3>Comments</h3>{(task.comments || []).map((item) => <div className="list-row" key={item._id}><span>{item.content}</span><small className="muted">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</small></div>)}<form className="toolbar" onSubmit={async (event) => { event.preventDefault(); if (!comment.trim()) return; const data = await api.addComment(id, comment); setTask({ ...task, comments: data.comments }); setComment(''); }}><input className="form-control" placeholder="Add a comment" value={comment} onChange={(event) => setComment(event.target.value)} /><Button>Add comment</Button></form></section></>; }

function Members() { const { orgId, members, setMembers } = useOrg(); const [email, setEmail] = useState(''); const [error, setError] = useState(''); return <><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>Team</h1></div></div><section className="panel"><h3>Invite a teammate</h3><form className="toolbar" onSubmit={async (event) => { event.preventDefault(); try { await api.addMember(orgId, { email }); const data = await api.listMembers(orgId); setMembers(data.data.members); setEmail(''); setError(''); } catch (err) { setError(err.message); } }}><input className="form-control" required type="email" placeholder="teammate@company.com" value={email} onChange={(event) => setEmail(event.target.value)} /><Button>Invite</Button></form><Message error={error} /></section><section className="panel">{members.map((member) => <div className="list-row" key={member._id}><div><strong>{member.userId?.firstName} {member.userId?.lastName}</strong><div className="muted">{member.userId?.email}</div></div></div>)}</section></>; }

function Settings() { const { organization, orgId } = useOrg(); const [name, setName] = useState(organization?.name || ''); const [description, setDescription] = useState(organization?.description || ''); const [message, setMessage] = useState(''); useEffect(() => { setName(organization?.name || ''); setDescription(organization?.description || ''); }, [organization]); if (!organization) return <Loading />; return <section className="panel narrow"><div className="panel-head"><h2>Organization settings</h2></div><form className="form-stack" onSubmit={async (event) => { event.preventDefault(); await api.updateOrg(orgId, { name, description }); setMessage('Settings saved.'); }}><label>Name<input className="form-control" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Description<textarea className="form-control" value={description} onChange={(event) => setDescription(event.target.value)} /></label><Button>Save changes</Button><Message success={message} /></form></section>; }

function App() { return <AuthProvider><OrgProvider><SocketBridge /><Routes><Route path="/" element={<Landing />} /><Route path="/marketplace" element={<Protected customer><Marketplace /></Protected>} /><Route path="/marketplace/:id" element={<Protected customer><MarketplaceDetail /></Protected>} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot" element={<Forgot />} /><Route element={<Protected broker><BrokerLayout /></Protected>}><Route path="/broker" element={<BrokerHome />} /><Route path="/broker/leads" element={<BrokerLeads />} /><Route path="/broker/profile" element={<BrokerProfile />} /></Route><Route path="/customer" element={<Protected customer><CustomerHome /></Protected>} /><Route path="/customer/favorites" element={<Protected customer><CustomerFavorites /></Protected>} /><Route path="/customer/enquiries" element={<Protected customer><CustomerEnquiries /></Protected>} /><Route path="/customer/support" element={<Protected customer><CustomerSupport /></Protected>} /><Route path="/customer/profile" element={<Protected customer><CustomerProfile /></Protected>} /><Route element={<Protected owner><OwnerLayout /></Protected>}><Route path="/owner" element={<OwnerHome />} /><Route path="/owner/enquiries" element={<OwnerEnquiries />} /><Route path="/owner/brokers" element={<OwnerBrokers />} /><Route path="/owner/profile" element={<OwnerProfile />} /></Route><Route path="/org" element={<Navigate to="/dashboard" replace />} /><Route element={<Protected><OrganizationLayout /></Protected>}><Route path="/dashboard" element={<Dashboard />} /><Route path="/properties" element={<Properties />} /><Route path="/properties/new" element={<PropertyForm />} /><Route path="/properties/:id" element={<PropertyDetail />} /><Route path="/tasks" element={<Tasks />} /><Route path="/tasks/new" element={<TaskForm />} /><Route path="/tasks/:id" element={<TaskDetail />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></OrgProvider></AuthProvider>; }

export default App;
