import Archive from '../Archive/archive.js';
import path from 'node:path';

export default class Announcer {
  constructor({ archive } = {}){
    this.archive = archive || new Archive();
  }

  async _loadFabricator(){
    // Fabricator is CommonJS; dynamic import returns a namespace with default = module.exports
    const mod = await import('../../Workshop/Fabricator/fabricator.js');
    return (mod && (mod.default || mod)) ? (mod.default || mod)() : null;
  }

  async deliver(record){
    if(!record || !record.notificationKey) return { success: false, error: 'INVALID_RECORD' };
    const notifKey = record.notificationKey;
    const flags = (record.deliveryFlags = record.deliveryFlags || { channel_sent:0, dm_member_sent:0, dm_leader_sent:0 });

    const fabricator = await this._loadFabricator();

    // Channel post
    if(flags.channel_sent === 0){
      try{
        const embed = fabricator ? fabricator.renderEmbed(record.payload, { id: record.createdFrom, title: record.payload.title }, record.variant) : { placeholder: true };
        // Simulate posting to channel (real integration would use Discord client)
        console.log('Announcer: posting to channel', record.deliveryPlan.channel, embed);
        await this.archive.updateFlags(notifKey, { channel_sent: 1 });
        await this.archive.appendHistory(notifKey, { step: 'channel_post', result: 'ok' });
      }catch(err){
        await this.archive.appendHistory(notifKey, { step: 'channel_post', result: 'error', message: err.message });
        return { success: false, error: 'CHANNEL_POST_FAILED', message: err.message };
      }
    }

    // Member DMs
    if(flags.dm_member_sent === 0){
      const members = (record.deliveryPlan && record.deliveryPlan.members) || [];
      try{
        for(const m of members){
          // Simulate DM
          console.log('Announcer: sending DM to member', m, 'for', notifKey);
        }
        await this.archive.updateFlags(notifKey, { dm_member_sent: 1 });
        await this.archive.appendHistory(notifKey, { step: 'dm_members', result: 'ok', count: members.length });
      }catch(err){
        await this.archive.appendHistory(notifKey, { step: 'dm_members', result: 'error', message: err.message });
        return { success: false, error: 'DM_MEMBERS_FAILED', message: err.message };
      }
    }

    // Leader DM
    if(flags.dm_leader_sent === 0){
      const leader = (record.deliveryPlan && record.deliveryPlan.leader) || null;
      try{
        if(leader){
          console.log('Announcer: sending DM to leader', leader, 'for', notifKey);
        }
        await this.archive.updateFlags(notifKey, { dm_leader_sent: 1 });
        await this.archive.appendHistory(notifKey, { step: 'dm_leader', result: 'ok', leader: leader || null });
      }catch(err){
        await this.archive.appendHistory(notifKey, { step: 'dm_leader', result: 'error', message: err.message });
        return { success: false, error: 'DM_LEADER_FAILED', message: err.message };
      }
    }

    return { success: true };
  }
}
