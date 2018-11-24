import { SuperDymoStore } from 'dymo-core';
import { HierarchicalPlayer } from './players';


export abstract class ScheduledObject {
  
  private store: SuperDymoStore;
  private parentUris: string[];
  protected ready: Promise<void>;

  constructor(protected dymoUri: string, protected player: HierarchicalPlayer) {
    this.ready = this.init();
  }

  private async init() {
    this.store = this.player.getStore();
    this.parentUris = await this.store.findAllParents(this.dymoUri);
  }

  getUri(): string {
    return this.dymoUri;
  }

  async getUris(): Promise<string[]> {
    await this.ready;
    return [this.dymoUri].concat(this.parentUris);
  }

  abstract async getParam(paramUri: string): Promise<number>;

  abstract stop(): Promise<any>;

}

export class DummyScheduledObject extends ScheduledObject {

  constructor(dymoUri: string, player: HierarchicalPlayer, delay: number) {
    super(dymoUri, player);
    this.player.objectStarted(this);
    setTimeout(() => this.player.objectEnded(this), delay);
  }

  async getParam(paramUri: string): Promise<number> {
    return Promise.resolve(0);//this.store.findParameterValue(this.dymoUri, paramUri);
  }

  stop() {
    return Promise.resolve(this.player.objectEnded(this));
  }

}

export abstract class DymoScheduler {

  abstract setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ);

  abstract schedule(dymoUri: string, previousObject: ScheduledObject,
    player: HierarchicalPlayer): Promise<ScheduledObject>;

}

/** a scheduler that logs all scheduled ids that can be used for tests.
  * objects start after given delay and end after another delay */
export class DummyScheduler extends DymoScheduler {
  
  private objects: DummyScheduledObject[] = [];

  constructor(private delay: number) { super() }

  setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ) { }
  
  getScheduledObjects() {
    return this.objects;
  }

  schedule(dymoUri: string, previousObject: ScheduledObject,
      player: HierarchicalPlayer): Promise<ScheduledObject> {
    return new Promise(resolve =>
      setTimeout(() => {
        //console.log("scheduled", dymoUri);
        const newObject = new DummyScheduledObject(dymoUri, player, this.delay);
        this.objects.push(newObject);
        resolve(newObject);
      }, this.delay)
    );
  }

}