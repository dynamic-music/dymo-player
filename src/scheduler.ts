import { SuperDymoStore } from 'dymo-core';
import { HierarchicalPlayer } from './players';

export abstract class DymoScheduler {

  abstract setListenerOrientation(posX: number, posY: number, posZ: number, forwX: number, forwY: number, forwZ: number);
  abstract setListenerPosition(x: number, y: number, z: number);

  abstract schedule(dymoUri: string, previousObject: ScheduledObject,
    player: HierarchicalPlayer): Promise<ScheduledObject>;

}

export abstract class ScheduledObject {
  
  protected store: SuperDymoStore;
  protected parentUris: string[];
  protected ready: Promise<void>;

  constructor(protected dymoUri: string, protected player: HierarchicalPlayer) {
    this.ready = this.init();
  }

  protected async init() {
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