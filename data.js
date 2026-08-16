/* =========================================================
   AETHER RENDER LAB — SHARED DATA LAYER (Supabase edition)
   Used by BOTH the public site (index.html) and the admin
   panel (admin/index.html). Talks to a real Supabase project
   (Postgres database + Auth + Storage) instead of localStorage.
   ========================================================= */
(function (global) {
  const SUPABASE_URL = 'https://tdvkmtttbtusfapsnmol.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdmttdHR0YnR1c2ZhcHNubW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzk2NzEsImV4cCI6MjEwMDc1NTY3MX0.yO-kxPXr_hJYjjKSB71MUPYKnbY0ZmxE-dpl4iMgUi4';

  if (typeof supabase === 'undefined') {
    console.error('Supabase JS library not loaded — check the <script> tag order.');
    return;
  }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function throwIfError(label, error) {
    if (error) {
      console.error(label, error);
      throw error;
    }
  }

  /* =========================================================
     CONTENT — reads/writes real tables in Postgres
     ========================================================= */

  /* Fetches everything the site needs in parallel. RLS on the
     server automatically filters out drafts for non-admins. */
  async function loadContentDB() {
    const [projects, categories, services, skills, testimonials, news, settings] = await Promise.all([
      sb.from('projects').select('*').order('created_at', { ascending: false }),
      sb.from('categories').select('*').order('name'),
      sb.from('services').select('*'),
      sb.from('skills').select('*'),
      sb.from('testimonials').select('*'),
      sb.from('news').select('*').order('created_at', { ascending: false }),
      sb.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    [projects, categories, services, skills, testimonials, news].forEach(r => throwIfError('loadContentDB', r.error));
    if (settings.error) throwIfError('loadContentDB settings', settings.error);

    return {
      projects: projects.data || [],
      categories: categories.data || [],
      services: services.data || [],
      skills: skills.data || [],
      testimonials: testimonials.data || [],
      news: news.data || [],
      settings: settings.data || {},
    };
  }

  /* Admin-only extras (messages/activity are locked by RLS to admins) */
  async function loadMessages() {
    const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: false });
    throwIfError('loadMessages', error);
    return data || [];
  }
  async function loadActivity() {
    const { data, error } = await sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(60);
    throwIfError('loadActivity', error);
    return data || [];
  }
  async function logActivity(icon, text) {
    const { error } = await sb.from('activity_log').insert({ icon, text });
    if (error) console.error('logActivity', error); // non-fatal
  }

  /* ---------- PROJECTS ---------- */
  async function addProject(data) {
    const { error } = await sb.from('projects').insert(data);
    throwIfError('addProject', error);
  }
  async function updateProject(id, data) {
    const { error } = await sb.from('projects').update(data).eq('id', id);
    throwIfError('updateProject', error);
  }
  async function deleteProject(id) {
    const { error } = await sb.from('projects').delete().eq('id', id);
    throwIfError('deleteProject', error);
  }

  /* ---------- CATEGORIES ---------- */
  async function addCategory(name) {
    const { error } = await sb.from('categories').insert({ name });
    throwIfError('addCategory', error);
  }
  async function updateCategory(id, name) {
    const { error } = await sb.from('categories').update({ name }).eq('id', id);
    throwIfError('updateCategory', error);
  }
  async function deleteCategory(id) {
    const { error } = await sb.from('categories').delete().eq('id', id);
    throwIfError('deleteCategory', error);
  }

  /* ---------- SERVICES ---------- */
  async function addService(data) {
    const { error } = await sb.from('services').insert(data);
    throwIfError('addService', error);
  }
  async function updateService(id, data) {
    const { error } = await sb.from('services').update(data).eq('id', id);
    throwIfError('updateService', error);
  }
  async function deleteService(id) {
    const { error } = await sb.from('services').delete().eq('id', id);
    throwIfError('deleteService', error);
  }

  /* ---------- SKILLS ---------- */
  async function addSkill(name, pct) {
    const { error } = await sb.from('skills').insert({ name, pct });
    throwIfError('addSkill', error);
  }
  async function updateSkillPct(id, pct) {
    const { error } = await sb.from('skills').update({ pct }).eq('id', id);
    throwIfError('updateSkillPct', error);
  }
  async function deleteSkill(id) {
    const { error } = await sb.from('skills').delete().eq('id', id);
    throwIfError('deleteSkill', error);
  }

  /* ---------- TESTIMONIALS ---------- */
  async function addTestimonial(data) {
    const { error } = await sb.from('testimonials').insert(data);
    throwIfError('addTestimonial', error);
  }
  async function updateTestimonial(id, data) {
    const { error } = await sb.from('testimonials').update(data).eq('id', id);
    throwIfError('updateTestimonial', error);
  }
  async function deleteTestimonial(id) {
    const { error } = await sb.from('testimonials').delete().eq('id', id);
    throwIfError('deleteTestimonial', error);
  }

  /* ---------- NEWS ---------- */
  async function addNews(data) {
    const { error } = await sb.from('news').insert(data);
    throwIfError('addNews', error);
  }
  async function updateNews(id, data) {
    const { error } = await sb.from('news').update(data).eq('id', id);
    throwIfError('updateNews', error);
  }
  async function deleteNews(id) {
    const { error } = await sb.from('news').delete().eq('id', id);
    throwIfError('deleteNews', error);
  }
  /* Uploads a (already client-resized) image blob to Storage and
     returns its public URL for storing in news.image_url. */
  async function uploadNewsImage(file) {
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await sb.storage.from('news-images').upload(path, file, { contentType: 'image/jpeg' });
    throwIfError('uploadNewsImage', error);
    const { data } = sb.storage.from('news-images').getPublicUrl(path);
    return data.publicUrl;
  }

  /* Uploads a raw .glb file to the "3d-models" bucket and returns its
     public URL for storing in projects.model_url / site_settings.hero_model_url. */
  async function uploadModel(file) {
    const safeName = (file.name || 'model.glb').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const { error } = await sb.storage.from('3d-models').upload(path, file, { contentType: 'model/gltf-binary' });
    throwIfError('uploadModel', error);
    const { data } = sb.storage.from('3d-models').getPublicUrl(path);
    return data.publicUrl;
  }

  /* ---------- MESSAGES (contact form + inbox) ---------- */
  async function sendMessage({ name, email, subject, body }) {
    const { error } = await sb.from('messages').insert({ name, email, subject, body });
    throwIfError('sendMessage', error);
  }
  async function markMessageRead(id, read = true) {
    const { error } = await sb.from('messages').update({ read }).eq('id', id);
    throwIfError('markMessageRead', error);
  }
  async function deleteMessage(id) {
    const { error } = await sb.from('messages').delete().eq('id', id);
    throwIfError('deleteMessage', error);
  }

  /* ---------- SITE SETTINGS ---------- */
  async function updateSettings(data) {
    const { error } = await sb.from('site_settings').update(data).eq('id', 1);
    throwIfError('updateSettings', error);
  }

  /* =========================================================
     AUTH — real Supabase accounts, role stored in `profiles`
     ========================================================= */

  /* Public self sign-up. Always creates a role='user' account —
     only an existing admin can promote someone via the admin panel. */
  async function signUp({ name, email, password }) {
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { name } }, // read by the handle_new_user() DB trigger
    });
    throwIfError('signUp', error);
    return data;
  }
  async function signIn({ email, password }) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    throwIfError('signIn', error);
    return data;
  }
  async function signOut() {
    await sb.auth.signOut();
  }

  /* Returns { id, name, email, role, avatar_url } for the logged-in
     user, or null if nobody is logged in. */
  async function getCurrentAccount() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error) { console.error('getCurrentAccount', error); return null; }
    return data;
  }

  /* Admin-only: list every account (RLS only allows this for admins) */
  async function loadAccounts() {
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    throwIfError('loadAccounts', error);
    return data || [];
  }
  async function setAccountRole(id, role) {
    const { error } = await sb.from('profiles').update({ role }).eq('id', id);
    throwIfError('setAccountRole', error);
  }
  /* Revokes an account's access to this panel. Note: this removes their
     profile row (so they lose their role and can no longer be recognized
     as admin/user), but — since we only use the public anon key — it
     cannot delete the underlying Supabase Auth login itself. That would
     require a service_role key on a server, which this static site
     intentionally does not expose. */
  async function revokeAccount(id) {
    const { error } = await sb.from('profiles').delete().eq('id', id);
    throwIfError('revokeAccount', error);
  }
  async function updateProfile(id, data) {
    const { error } = await sb.from('profiles').update(data).eq('id', id);
    throwIfError('updateProfile', error);
  }
  async function uploadAvatar(file) {
    const path = `avatar_${Date.now()}.jpg`;
    const { error } = await sb.storage.from('news-images').upload(path, file, { contentType: 'image/jpeg' });
    throwIfError('uploadAvatar', error);
    const { data } = sb.storage.from('news-images').getPublicUrl(path);
    return data.publicUrl;
  }

  global.AetherData = {
    supabase: sb, uid,
    loadContentDB, loadMessages, loadActivity, logActivity,
    addProject, updateProject, deleteProject,
    addCategory, updateCategory, deleteCategory,
    addService, updateService, deleteService,
    addSkill, updateSkillPct, deleteSkill,
    addTestimonial, updateTestimonial, deleteTestimonial,
    addNews, updateNews, deleteNews, uploadNewsImage, uploadModel,
    sendMessage, markMessageRead, deleteMessage,
    updateSettings,
    signUp, signIn, signOut, getCurrentAccount,
    loadAccounts, setAccountRole, revokeAccount, updateProfile, uploadAvatar,
  };
})(window);
