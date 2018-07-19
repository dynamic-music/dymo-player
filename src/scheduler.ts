import { SuperDymoStore } from 'dymo-core';
import { DymoPlayer } from './player';


export abstract class ScheduledObject {

  protected parentUris;

  constructor(protected dymoUri: string, protected store: SuperDymoStore,
      protected player: DymoPlayer) {
    this.init();
  }

  private async init() {
    this.parentUris = await this.store.findAllParents(this.dymoUri);
  }

  getUri(): string {
    return this.dymoUri;
  }

  getUris(): string[] {
    return [this.dymoUri].concat(this.parentUris);
  }

  abstract async getParam(paramUri: string): Promise<number>;

  abstract stop(): void;

}

export class DummyScheduledObject extends ScheduledObject {

  constructor(dymoUri: string, store: SuperDymoStore, player: DymoPlayer,
      delay: number) {
    super(dymoUri, store, player);
    this.player.objectStarted(this);
    setTimeout(() => this.player.objectEnded(this), delay);
  }

  async getParam(paramUri: string): Promise<number> {
    return Promise.resolve(0);//this.store.findParameterValue(this.dymoUri, paramUri);
  }

  stop() {
    this.player.objectEnded(this);
  }

}

export abstract class DymoScheduler {

  protected player: DymoPlayer;
  protected store: SuperDymoStore;

  setPlayer(player: DymoPlayer) {
    this.player = player;
    this.store = player.getStore();
  }

  abstract setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ);

  abstract schedule(dymoUri: string, previousObject: ScheduledObject,
    initRefTime: boolean): Promise<ScheduledObject>;

  abstract getAudioBank(): any;

  abstract update(): void;

}

export class DummyScheduler extends DymoScheduler {

  constructor(private delay: number) { super() }

  setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ) { }

  schedule(dymoUri: string, previousObject: ScheduledObject): Promise<ScheduledObject> {
    return new Promise(resolve =>
      setTimeout(() => {
        console.log("scheduled", dymoUri);
        resolve(new DummyScheduledObject(dymoUri, this.store, this.player, this.delay));
      }, this.delay)
    );
  }

  getAudioBank(): any {
    return null;
  }

  update() {}

}