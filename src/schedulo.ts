import { Schedulo, Time, Playback } from 'schedulo';
import { uris } from 'dymo-core';
import { DymoScheduler } from './scheduler';
import { ScheduloScheduledObject } from './wrapper';

export class ScheduloScheduler extends DymoScheduler {

  private schedulo: Schedulo;

  constructor(private scheduleAheadTime: number, loadAheadTime: number, fadeLength: number) {
    super();
    this.schedulo = new Schedulo(
      {
        connectToGraph: {countIn: scheduleAheadTime, countOut: 1, minCountIn: scheduleAheadTime},
        loadBuffer: {countIn: loadAheadTime, countOut: 5, minCountIn: loadAheadTime}
      },
      fadeLength
    );
    this.schedulo.start();
  }

  setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ) {
    //TODO SET ON SCHEDULO!!!
  }

  getAudioBank(): any {
    return this.schedulo.getAudioBank();
  }

  async schedule(dymoUri: string, previousObject: ScheduloScheduledObject): Promise<ScheduloScheduledObject> {

    if (!dymoUri) return Promise.reject('no dymoUri given');

    const newObject = new ScheduloScheduledObject(dymoUri, previousObject, this.store, this.player);

    let startTime;
    const onset = await newObject.getParam(uris.ONSET);
    let previousOnset;
    if (previousObject) {
      previousOnset = await previousObject.getParam(uris.ONSET);
    }
    if (!isNaN(onset) && !isNaN(previousOnset) && onset-previousOnset >= 0) {
      const previousStartTime = previousObject.getStartTime();
      startTime = Time.At(previousStartTime+onset-previousOnset);
    } else if (previousObject) {
      startTime = Time.After([previousObject.getScheduloObject()]);
    } else {
      startTime = Time.At(this.schedulo.getCurrentTime()+this.scheduleAheadTime);
    }

    //console.log(dymoUri, startTime, previousObject)

    return this.schedulo.scheduleAudio(
      [await this.store.getSourcePath(dymoUri)],
      startTime,
      Playback.Oneshot()
    ).then(audioObject => new Promise<ScheduloScheduledObject>(resolve => {
      newObject.setScheduloObject(audioObject[0]);
      newObject.getScheduloObject().on('loaded', ()=>{
        resolve(newObject);
      });
      //resolve(newObject);
    }));
  }
}