import Archive from '../Archive/archive.js';
import path from 'node:path';

export default class Announcer {
  constructor({ archive, client } = {}){
    this.archive = archive || new Archive();
    this.client = client || null; // reuse the bot's existing Discord client when available
  }

  async _loadFabricator(){
    // Fabricator is CommonJS; dynamic import wraps module.exports as mod.default (createFabricator fn)
    const mod = await import('../../Workshop/Fabricator/fabricator.js');
    const factory = (mod && mod.default) ? mod.default : (typeof mod === 'function' ? mod : null);
    return factory ? factory() : null;
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

          // Prefer the injected live client (no extra login); fall back to spawning a fresh one.
          const channelId = record.deliveryPlan && record.deliveryPlan.channel;
          if(this.client){
            if(channelId){
              try{
                const ch = await this.client.channels.fetch(channelId);
                if(ch && typeof ch.send === 'function'){
                  await ch.send({ embeds: [embed] });
                } else {
                  console.warn('Announcer: channel missing or not sendable for', channelId);
                }
              }catch(e){
                console.warn('Announcer: channel send failed', e.message);
              }
            }
          } else if(process.env.DISCORD_TOKEN){
            // Fallback: spawn a temporary client (no live client injected)
            try{
              const dj = await import('discord.js');
              const TmpClient = dj.Client || dj.default?.Client;
              if(TmpClient){
                const tmp = new TmpClient({ intents: [] });
                await tmp.login(process.env.DISCORD_TOKEN);
                if(channelId){
                  try{
                    const ch = await tmp.channels.fetch(channelId);
                    if(ch && typeof ch.send === 'function') await ch.send({ embeds: [embed] });
                    else console.warn('Announcer: channel not sendable', channelId);
                  }catch(e){ console.warn('Announcer: tmp client send failed', e.message); }
                }
                await tmp.destroy();
              }
            }catch(e){
              console.warn('Announcer: discord fallback unavailable', e.message);
            }
          } else {
            console.log('Announcer [sim]: channel', channelId, embed);
          }

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
