import { Observable } from 'rxjs/Observable';
import { ScheduloScheduler } from './schedulo';
import { uris, Fetcher, LoadedStuff } from 'dymo-core';
import { MultiPlayer } from './players';
import { WorkerStoreService } from './worker-store/superstore-service';
import { DymoManager } from 'dymo-core';
import { AudioBank } from 'schedulo';

/**
 * A class for easy access of all dymo player functionality.
 */
export class DymoPlayer {

  private dymoManager: DymoManager;
  private schedulo: ScheduloScheduler;
  private player: MultiPlayer;

  constructor(useWorkers: boolean, private preloadBuffers = true, private scheduleAheadTime = 1,
      private loadAheadTime = 3, private fadeLength = 0.01, fetcher?: Fetcher, private loggingOn = false) {
    const workerStore = useWorkers ? new WorkerStoreService(fetcher) : null;
    this.dymoManager = new DymoManager(workerStore, fetcher);
  }

  async init(ontologiesPath?: string): Promise<any> {
    if (this.loggingOn) console.log("INIT PLAYER")
    await this.dymoManager.init(ontologiesPath);
    this.schedulo = new ScheduloScheduler(this.scheduleAheadTime, this.loadAheadTime, this.fadeLength);
    this.player = new MultiPlayer(this.dymoManager.getStore(), this.schedulo, this.loggingOn);
  }

  async loadDymo(...fileUris: string[]): Promise<LoadedStuff> {
    if (this.loggingOn) console.log("LOADING", ...fileUris)
    const loaded = await this.dymoManager.loadIntoStore(...fileUris);
    if (this.preloadBuffers) {
      const paths = await this.dymoManager.getStore().getAllSourcePaths();
      await this.schedulo.getAudioBank().preloadBuffers(paths)
    }
    if (this.loggingOn) console.log("DONE LOADING")
    if (this.loggingOn) console.log("store size", await this.dymoManager.getStore().size());
    return loaded;
  }

  async loadDymoFromString(dymo: string): Promise<LoadedStuff> {
    if (this.loggingOn) console.log("LOADING")
    const loaded = await this.dymoManager.loadIntoStoreFromString(dymo);
    if (this.preloadBuffers) {
      const paths = await this.dymoManager.getStore().getAllSourcePaths();
      await this.schedulo.getAudioBank().preloadBuffers(paths)
    }
    if (this.loggingOn) console.log("DONE LOADING")
    if (this.loggingOn) console.log("store size", await this.dymoManager.getStore().size());
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

  getAudioBank(): AudioBank {
    return this.schedulo.getAudioBank();
  }

  isPlaying(dymoUri: string) {
    return this.player ? this.player.isPlaying(dymoUri) : false;
  }

  getPosition(dymoUri: string) {
    if (this.player) {
      return this.player.getPosition(dymoUri);
    }
  }

  playUri(dymoUri: string, afterUri?: string) {
    if (this.loggingOn) console.log("PLAYING", dymoUri)
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
