import Archive from '../Archive/archive.js';

// Minimal Archive-Inspector implementation that follows the documented pipeline.
// It performs: eligibility, dedup, recipient resolution, variant selection, write to Archive.

export default class ArchiveInspector {
  constructor({ archive } = {}){
    this.archive = archive || new Archive();
  }

  // Simple eligibility heuristic — project-specific rules can be supplied by product fields
  _isEligible(product){
    if(!product) return false;
    if(product.shouldBroadcast === true) return true;
    if(typeof product.threshold === 'number' && typeof product.value === 'number'){
      return product.value >= product.threshold;
    }
    // fallback: if product.trigger === 'broadcast'
    if(product.trigger === 'broadcast') return true;
    return false;
  }

  _makeNotificationKey(product){
    // Prefer explicit key, else id:version or id:ts
    if(product.notificationKey) return product.notificationKey;
    const id = product.id || product.trainer_id || `p-${Date.now()}`;
    const ver = product.version || product.version_tag || Date.now();
    return `${String(id)}:${String(ver)}`;
  }

  _resolveRecipients(product){
    // product may contain recipients: { channel, members: [], leader }
    const recipients = product.recipients || {};
    return {
      channel: recipients.channel || process.env.DEFAULT_BROADCAST_CHANNEL || null,
      members: recipients.members || [],
      leader: recipients.leader || null
    };
  }

  _selectVariant(product){
    // basic variant selection: prefer explicit variant, else pick first available
    if(product.variant) return product.variant;
    if(product.variants && Array.isArray(product.variants) && product.variants.length) return product.variants[0];
    return { blueprint: 'default', messageTemplate: product.messageTemplate || null };
  }

  async inspect(product){
    try{
      if(!this._isEligible(product)) return { success: false, rejected: true, reason: 'NOT_ELIGIBLE' };

      const notificationKey = this._makeNotificationKey(product);

      // dedup: check if an archive record exists already for this key
      const existing = await this.archive.getByKey(notificationKey);
      if(existing && existing.success) return { success: false, rejected: true, reason: 'DUPLICATE' };

      const recipients = this._resolveRecipients(product);
      const variant = this._selectVariant(product);

      const record = {
        notificationKey,
        createdFrom: product.id || null,
        payload: product,
        deliveryPlan: {
          channel: recipients.channel,
          members: recipients.members,
          leader: recipients.leader
        },
        variant,
        metadata: {
          inspectedAt: new Date().toISOString()
        }
      };

      const ins = await this.archive.insert(record);
      return ins;
    }catch(err){
      return { success: false, error: 'INSPECTOR_FAILURE', message: err.message };
    }
  }
}
