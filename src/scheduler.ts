import { HierarchicalPlayer } from './player';


export abstract class ScheduledObject {

  protected store;
  protected parentUris;

  constructor(protected dymoUri: string, protected player: HierarchicalPlayer) {
    this.init();
  }

  private async init() {
    this.store = this.player.getStore();
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

  constructor(dymoUri: string, player: HierarchicalPlayer, delay: number) {
    super(dymoUri, player);
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

  abstract setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ);

  abstract schedule(dymoUri: string, previousObject: ScheduledObject,
    player: HierarchicalPlayer, initRefTime: boolean): Promise<ScheduledObject>;

  abstract getAudioBank(): any;

}

export class DummyScheduler extends DymoScheduler {

  constructor(private delay: number) { super() }

  setListenerOrientation(posX, posY, posZ, forwX, forwY, forwZ) { }

  schedule(dymoUri: string, previousObject: ScheduledObject, player: HierarchicalPlayer): Promise<ScheduledObject> {
    return new Promise(resolve =>
      setTimeout(() => {
        console.log("scheduled", dymoUri);
        resolve(new DummyScheduledObject(dymoUri, player, this.delay));
      }, this.delay)
    );
  }

  getAudioBank(): any {
    return null;
  }

}