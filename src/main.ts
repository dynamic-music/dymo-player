import { Observable } from 'rxjs';
import { DymoManager, uris, Fetcher, LoadedStuff } from 'dymo-core';
import { AudioBank } from 'schedulo';
import { ScheduloScheduler } from './schedulo';
import { MultiPlayer } from './players';
import { WorkerStoreService } from './worker-store/superstore-service';
import { Transitions } from './transitions';

export interface PlayerOptions {
  useWorkers: boolean,
  preloadBuffers?: boolean,
  scheduleAheadTime?: number,
  loadAheadTime?: number,
  ignoreInaudible?: boolean,
  fadeLength?: number,
  fetcher?: Fetcher,
  loggingOn?: boolean,
  useTone: boolean
}

/**
 * A class for easy access of all dymo player functionality.
 */
export class DymoPlayer {

  private dymoManager: DymoManager;
  private schedulo: ScheduloScheduler;
  private player: MultiPlayer;
  private transitions: Transitions;

  constructor(private options: PlayerOptions) {
    const workerStore = options.useWorkers ? new WorkerStoreService(options.fetcher) : null;
    this.dymoManager = new DymoManager(workerStore, options.fetcher);
    this.transitions = new Transitions(this);
  }

  async init(ontologiesPath?: string): Promise<any> {
    if (this.options.loggingOn) console.log("INIT PLAYER")
    await this.dymoManager.init(ontologiesPath);
    this.schedulo = new ScheduloScheduler(this.options.scheduleAheadTime,
      this.options.loadAheadTime, this.options.fadeLength,
      this.options.ignoreInaudible, this.options.fetcher, this.options.useTone);
    this.player = new MultiPlayer(this.dymoManager.getStore(), this.schedulo, this.options.loggingOn);
  }

  async loadDymo(...fileUris: string[]): Promise<LoadedStuff> {
    if (this.options.loggingOn) console.log("LOADING", ...fileUris)
    const loaded = await this.dymoManager.loadIntoStore(...fileUris);
    this.preloadAndLog();
    return loaded;
  }

  async loadDymoFromString(dymo: string): Promise<LoadedStuff> {
    if (this.options.loggingOn) console.log("LOADING")
    const loaded = await this.dymoManager.loadIntoStoreFromString(dymo);
    this.preloadAndLog();
    return loaded;
  }

  private async preloadAndLog() {
    if (this.options.preloadBuffers) {
      const paths = await this.dymoManager.getStore().getAllSourcePaths();
      await this.schedulo.getAudioBank().preloadBuffers(paths)
    }
    if (this.options.loggingOn) console.log("DONE LOADING")
    if (this.options.loggingOn) console.log("store size", await this.dymoManager.getStore().size());
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

  isPlaying(dymoUri?: string) {
    return this.player ? this.player.isPlaying(dymoUri) : false;
  }

  getPosition(dymoUri: string) {
    if (this.player) {
      return this.player.getPosition(dymoUri);
    }
  }

  playUri(dymoUri: string, afterUri?: string) {
    if (this.options.loggingOn) console.log("PLAYING", dymoUri)
    return this.player.play(this.addContext(dymoUri), afterUri);
  }

  async transitionToUri(toUri: string, fromUri: string, duration: number) {
    if (this.options.loggingOn) console.log("TRANSITIONING", toUri);
    const raints = await this.transitions.transitionToUri(toUri, fromUri, duration);
    if (fromUri) {
      setTimeout(() => this.stopAndRemove(fromUri, raints),
        this.options.scheduleAheadTime+duration*1000);
    }
    return this.playUri(toUri);
  }

  private async stopAndRemove(dymoUri: string, constraints: string[]) {
    await this.stopUri(dymoUri);
    await this.dymoManager.getStore().deactivateConstraints(constraints);
    await this.dymoManager.getStore().removeDymo(dymoUri);
  }

  stopUri(dymoUri: string) {
    if (this.options.loggingOn) console.log("STOPPING", dymoUri)
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
