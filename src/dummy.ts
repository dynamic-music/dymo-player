import * as _ from 'lodash';
import { HierarchicalPlayer } from './players';
import { ScheduledObject, DymoScheduler } from './scheduler';

/** a scheduler that logs all scheduled ids that can be used for tests.
  * objects start after given delay and end after another delay */
export class DummyScheduler extends DymoScheduler {
  
  private delay = 20; //in milliseconds
  //list of lists of simultaneously scheduled objects
  private objects: DummyScheduledObject[][] = [[]];
  private lastTime: number;

  constructor() { super(); }

  setListenerOrientation(..._) { }
  setListenerPosition(..._) { }
  
  getScheduledObjects() {
    return this.objects;
  }

  async schedule(dymoUri: string, _: ScheduledObject,
      player: HierarchicalPlayer): Promise<ScheduledObject> {
    if (await player.getStore().getSourcePath(dymoUri)) {
      return new Promise<ScheduledObject>(resolve =>
        setTimeout(() => {
          //console.log("scheduled", dymoUri);
          const newObject = new DummyScheduledObject(dymoUri, player, this.delay);
          this.addToScheduledObjects(newObject);
          resolve(newObject);
        }, this.delay)
      );
    }
  }
  
  private addToScheduledObjects(object: ScheduledObject) {
    const currentTime = Date.now();
    if (this.lastTime && currentTime-this.lastTime >= this.delay) {
      //scheduled after an artificial delay, so log that
      this.objects.push([]);
    }
    _.last(this.objects).push(object);
    this.lastTime = Date.now();
  }

}

export class DummyScheduledObject extends ScheduledObject {

  constructor(dymoUri: string, player: HierarchicalPlayer, delay: number) {
    super(dymoUri, player);
    this.player.objectStarted(this);
    setTimeout(() => this.player.objectEnded(this), delay);
  }

  async getParam(_: string): Promise<number> {
    return Promise.resolve(0);//this.store.findParameterValue(this.dymoUri, paramUri);
  }

  stop() {
    return Promise.resolve(this.player.objectEnded(this));
  }

}