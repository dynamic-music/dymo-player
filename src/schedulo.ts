import { Schedulo, Time, Playback } from 'schedulo';
import { uris, Fetcher } from 'dymo-core';
import { DymoScheduler } from './scheduler';
import { ScheduloScheduledObject } from './wrapper';
import { HierarchicalPlayer } from './players';

export class ScheduloScheduler extends DymoScheduler {

  private schedulo: Schedulo;
  private paused = false;

  constructor(scheduleAheadTime = 1, loadAheadTime = 3, fadeLength = 0.01, ignoreInaudible = false, fetcher?: Fetcher) {
    super();
    this.schedulo = new Schedulo(
      {
        connectToGraph: {countIn: scheduleAheadTime, countOut: 1, minCountIn: scheduleAheadTime},
        loadBuffer: {countIn: loadAheadTime, countOut: 5, minCountIn: loadAheadTime, ignoreInaudible: ignoreInaudible}
      },
      fadeLength,
      fetcher
    );
  }

  isPaused() {
    return this.paused;
  }

  pause() {
    this.paused = !this.paused;
    //this.schedulo.pause();
  }

  setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ) {
    //TODO SET ON SCHEDULO!!!
  }

  getAudioBank() {
    return this.schedulo.getAudioBank();
  }

  async schedule(dymoUri: string, previousObject: ScheduloScheduledObject, player: HierarchicalPlayer): Promise<ScheduloScheduledObject> {

    if (!dymoUri) return Promise.reject('no dymoUri given');

    const newObject = new ScheduloScheduledObject(dymoUri, previousObject, player);

    let startTime;
    const onset = await newObject.getParam(uris.ONSET);
    let previousOnset;
    if (previousObject) {
      previousOnset = await previousObject.getParam(uris.ONSET);
    }
    if (!isNaN(onset) && !isNaN(previousOnset) && onset-previousOnset >= 0) {
      startTime = Time.RelativeTo(previousObject.getScheduloObject(), onset-previousOnset);
    } else if (previousObject) {
      startTime = Time.After([previousObject.getScheduloObject()]);
    } else {
      startTime = Time.Asap;
    }

    //console.log(dymoUri, startTime)

    if (await newObject.isEvent()) {
      const triggerFunction = await newObject.getTriggerFunction();
      const eventObject = this.schedulo.scheduleEvent(triggerFunction, startTime);
      newObject.setScheduloObject(eventObject);
      return newObject;
    } else {
      const audio = await newObject.getSourcePath();
      const audioObject = this.schedulo.scheduleAudio([audio], startTime, Playback.Oneshot())[0];
      newObject.setScheduloObject(audioObject);
      //only resolve when audio loaded
      return new Promise<ScheduloScheduledObject>(resolve => {
        audioObject.on('loaded', () => resolve(newObject));
      });
    }
  }

}