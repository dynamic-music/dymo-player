import { Observable } from 'rxjs/Observable';
import { ScheduloScheduler } from './schedulo';
import { uris, Fetcher, LoadedStuff } from 'dymo-core';
import { MultiPlayer } from './players';
import { WorkerStoreService } from './worker-store/superstore-service';
import { DymoManager } from 'dymo-core';

/**
 * A class for easy access of all dymo player functionality.
 */
export class DymoPlayer {

  private dymoManager: DymoManager;
  private schedulo: ScheduloScheduler;
  private player: MultiPlayer;

  constructor(useWorkers: boolean, private preloadBuffers = true, private scheduleAheadTime = 1,
      private loadAheadTime = 3, private fadeLength = 0.01, fetcher?: Fetcher) {
    const workerStore = useWorkers ? new WorkerStoreService(fetcher) : null;
    this.dymoManager = new DymoManager(workerStore, fetcher);
  }

  async init(ontologiesPath?: string): Promise<any> {
    await this.dymoManager.init(ontologiesPath);
    this.schedulo = new ScheduloScheduler(this.scheduleAheadTime, this.loadAheadTime, this.fadeLength);
    this.player = new MultiPlayer(this.dymoManager.getStore(), this.schedulo);
  }

  async loadDymo(...fileUris: string[]): Promise<LoadedStuff> {
    const loaded = await this.dymoManager.loadIntoStore(...fileUris);
    if (this.preloadBuffers) {
      const paths = await this.dymoManager.getStore().getAllSourcePaths();
      await this.schedulo.getAudioBank().preloadBuffers(paths)
    }
    return loaded;
  }

  async loadDymoFromString(dymo: string): Promise<LoadedStuff> {
    const loaded = await this.dymoManager.loadIntoStoreFromString(dymo);
    if (this.preloadBuffers) {
      const paths = await this.dymoManager.getStore().getAllSourcePaths();
      await this.schedulo.getAudioBank().preloadBuffers(paths)
    }
    return loaded;
  }

  getDymoManager(): DymoManager {
    return this.dymoManager;
  }

  getPlayingDymoUris(): Observable<string[]> {
    if (this.player) {
      return this.player.getPlayingDymoUris();
    }
  }

  getAudioBank() {
    if (this.player) {
      return this.player.getAudioBank();
    }
  }

  getPosition(dymoUri: string) {
    if (this.player) {
      return this.player.getPosition(dymoUri);
    }
  }

  /*updateNavigatorPosition(dymoUri, level, position) {
    this.player.updateNavigatorPosition(this.addContext(dymoUri), level, position);
  }*/

  /*getNavigatorPosition(dymoUri): number {
    return this.player.getNavigatorPosition(this.addContext(dymoUri));
  }*/

  /*//sync the first navigator for syncDymo to the position of the first for goalDymo on the given level
  syncNavigators(syncDymo, goalDymo, level) {
    this.scheduler.syncNavigators(this.addContext(syncDymo), this.addContext(goalDymo), level);
  }*/

  playUri(dymoUri: string, afterUri?: string) {
    return this.player.play(this.addContext(dymoUri), afterUri);
  }

  stopUri(dymoUri) {
    return this.player.stop(this.addContext(dymoUri));
  }

  play() {
    if (this.schedulo.isPaused()) {
      this.schedulo.pause();
    } else {
      const rendering = this.dymoManager.getRendering();
      if (rendering) {
        this.playUri(rendering.getDymoUri());
      } else {
        this.dymoManager.getLoadedDymoUris().forEach(d => this.playUri(d));
      }
    }
  }

  pause() {
    this.schedulo.pause();
  }

  async stop() {
    const rendering = this.dymoManager.getRendering();
    if (rendering) {
      await this.stopUri(rendering.getDymoUri());
    } else {
      await Promise.all(this.dymoManager.getLoadedDymoUris().map(d => this.stopUri(d)));
    }
    if (this.schedulo.isPaused()) {
      this.schedulo.pause();
    }
  }

  private addContext(uri: string): string {
    return uri.indexOf(uris.CONTEXT_URI) < 0 ? uris.CONTEXT_URI + uri : uri;
  }

}
