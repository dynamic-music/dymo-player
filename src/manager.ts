import { Observable } from 'rxjs/Observable';
import { ScheduloScheduler } from './schedulo';
import { uris, GlobalVars, Fetcher } from 'dymo-core';
import { DymoPlayer } from './player';
import { WorkerStoreService } from './worker-store/superstore-service';
import { DymoManager } from 'dymo-core';

/**
 * A class for easy access of all dymo core functionality.
 */
export class DymoPlayerManager {

  private dymoManager: DymoManager;
  private player: DymoPlayer;

  constructor(useWorkers: boolean, fetcher?: Fetcher) {
    const workerStore = useWorkers ? new WorkerStoreService(fetcher) : null;
    this.dymoManager = new DymoManager(workerStore, fetcher);
  }

  async init(ontologiesPath?: string): Promise<any> {
    await this.dymoManager.init(ontologiesPath);
    this.player = new DymoPlayer(this.dymoManager.getStore(), new ScheduloScheduler());
  }

  setScheduleAheadTime(scheduleAheadTime: number) {
    if (!isNaN(scheduleAheadTime)) {
      GlobalVars.SCHEDULE_AHEAD_TIME = scheduleAheadTime;
      if (this.player) {
        this.player.update();
      }
    }
  }

  setFadeLength(fadeLength: number) {
    if (!isNaN(fadeLength)) {
      GlobalVars.FADE_LENGTH = fadeLength;
    }
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

  startPlayingUri(dymoUri) {
    this.player.play(this.addContext(dymoUri));
  }

  stopPlayingUri(dymoUri) {
    this.player.stop(this.addContext(dymoUri));
  }

  private addContext(uri: string): string {
    return uri.indexOf(uris.CONTEXT_URI) < 0 ? uris.CONTEXT_URI + uri : uri;
  }

  startPlaying() {
    const rendering = this.dymoManager.getRendering();
    if (rendering) {
      rendering.play();
    } else {
      this.dymoManager.getLoadedDymoUris().forEach(d => this.player.play(d));
    }
  }

  stopPlaying() {
    const rendering = this.dymoManager.getRendering();
    if (rendering) {
      rendering.stop();
    } else {
      this.dymoManager.getLoadedDymoUris().forEach(d => this.player.stop(d));
    }
  }

}
