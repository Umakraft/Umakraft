// Archive-Transporter: fetches full record from Archive and hands it to Announcer
import Archive from '../Archive/archive.js';

export default class ArchiveTransporter {
  constructor({ archive, announcer } = {}){
    this.archive = archive || new Archive();
    this.announcer = announcer || null;
  }

  async transport(notificationKey){
    if(!notificationKey) return { success: false, error: 'NO_KEY' };
    const got = await this.archive.getByKey(notificationKey);
    if(!got || !got.success) return { success: false, error: 'ARCHIVE_NOT_FOUND', details: got };
    const record = got.record;
    // basic validation
    if(!record.payload || !record.deliveryPlan) return { success: false, error: 'INVALID_RECORD' };

    if(this.announcer && typeof this.announcer.deliver === 'function'){
      try{
        const res = await this.announcer.deliver(record);
        return { success: true, result: res };
      }catch(err){
        return { success: false, error: 'ANNOUNCER_ERROR', message: err.message };
      }
    }

    // If no announcer attached, return the fetched record for external handling
    return { success: true, record };
  }
}
