/**
 * Pure logic for managing App Name + App Logo profiles
 */

function validateAppProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return { valid: false, error: 'Profile data is required' };
  }
  const name = (profile.name || '').trim();
  const icon = (profile.icon || '').trim();
  if (!name) {
    return { valid: false, error: 'App Name is required' };
  }
  if (!icon) {
    return { valid: false, error: 'App Logo (file or URL) is required' };
  }
  return { valid: true, name, icon };
}

function findOrAddAppProfile(logos = [], { name, icon, id }) {
  const cleanName = (name || '').trim();
  const cleanIcon = (icon || '').trim();
  if (!cleanName || !cleanIcon) return { logos, added: false };

  const existingIndex = logos.findIndex(
    l => l.id === id || l.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (existingIndex >= 0) {
    // If it exists, update icon if needed and return
    logos[existingIndex].name = cleanName;
    if (cleanIcon) logos[existingIndex].icon = cleanIcon;
    return { logos, added: false, item: logos[existingIndex] };
  }

  const newItem = {
    id: id || 'app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: cleanName,
    icon: cleanIcon
  };
  logos.push(newItem);
  return { logos, added: true, item: newItem };
}

function updateAppProfile(logos = [], id, { name, icon }) {
  const index = logos.findIndex(l => l.id === id);
  if (index === -1) {
    return { success: false, error: 'App profile not found' };
  }
  if (name && name.trim()) {
    logos[index].name = name.trim();
  }
  if (icon && icon.trim()) {
    logos[index].icon = icon.trim();
  }
  return { success: true, item: logos[index], logos };
}

function removeAppProfile(logos = [], id) {
  const initialLength = logos.length;
  const filtered = logos.filter(l => l.id !== id);
  const removed = filtered.length < initialLength;
  return { success: removed, logos: filtered };
}

module.exports = {
  validateAppProfile,
  findOrAddAppProfile,
  updateAppProfile,
  removeAppProfile
};
