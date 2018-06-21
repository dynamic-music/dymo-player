import { Schedulo, Time, Playback } from 'schedulo';
import { uris, GlobalVars } from 'dymo-core';
import { DymoScheduler } from './scheduler';
import { ScheduloScheduledObject } from './wrapper';

export class ScheduloScheduler extends DymoScheduler {

  private schedulo: Schedulo;

  constructor() {
    super();
    this.schedulo = new Schedulo({
      connectToGraph: {countIn: GlobalVars.SCHEDULE_AHEAD_TIME, countOut: 1},
      loadBuffer: {countIn: GlobalVars.SCHEDULE_AHEAD_TIME+2, countOut: 5}
    });
    this.schedulo.start();
  }

  setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ) {
    //TODO SET ON SCHEDULO!!!
  }

  getAudioBank(): any {
    return this.schedulo.getAudioBank();
  }

  async schedule(dymoUri: string, previousObject: ScheduloScheduledObject,
      initRefTime: boolean): Promise<ScheduloScheduledObject> {

    if (!dymoUri) return Promise.reject('no dymoUri given');

    let referenceTime;
    if (previousObject && initRefTime) {
      referenceTime = previousObject.getEndTime();
    } else if (previousObject) {
      referenceTime = previousObject.getReferenceTime();
    } else {
      referenceTime = this.schedulo.getCurrentTime()+0.5;
    }

    let newObject = new ScheduloScheduledObject(dymoUri, referenceTime, this.store, this.player);

    let startTime;
    let onset = newObject.getParam(uris.ONSET);
    if (!isNaN(onset)) {
      startTime = Time.At(onset); //this onset includes ref time!
    } else if (previousObject) {
      startTime = Time.After([previousObject.getScheduloObject()]);
    } else {
      startTime = Time.At(referenceTime);
    }

    return this.schedulo.scheduleAudio(
      [await this.store.getSourcePath(dymoUri)],
      startTime,
      Playback.Oneshot()
    ).then(audioObject => new Promise<ScheduloScheduledObject>(resolve => {
      newObject.setScheduloObject(audioObject[0]);
      newObject.getScheduloObject().on('scheduled', ()=>{
        resolve(newObject);
      });
      //resolve(newObject);
    }));
  }
}