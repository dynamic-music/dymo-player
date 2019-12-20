import * as _ from 'lodash';
import * as natsort from 'natsort';
import { Observable, BehaviorSubject } from 'rxjs';
import { uris, SuperDymoStore } from 'dymo-core';
import { DymoScheduler, ScheduledObject } from './scheduler';
import { Navigator, getNavigator } from './navigators';

function removeFrom<T>(element: T, list: T[]): boolean {
  let index = list.indexOf(element);
  if (index >= 0) {
    list.splice(index, 1);
    return true;
  }
  return false;
}


export class MultiPlayer {

  private currentPlayers = new Map<string,HierarchicalPlayer>();
  private playingObjects: ScheduledObject[] = [];
  private playingDymoUris: BehaviorSubject<string[]> = new BehaviorSubject([]);

  constructor(private store: SuperDymoStore, private scheduler: DymoScheduler,
    private loggingOn = false) {
    this.store.setParameter(null, uris.LISTENER_ORIENTATION, 0);
    this.store.setParameter(null, uris.LISTENER_POSITION_X, 0);
    this.store.setParameter(null, uris.LISTENER_POSITION_Y, 0);
    this.store.setParameter(null, uris.LISTENER_POSITION_Z, 0);
    this.store.addParameterObserver(null, uris.LISTENER_ORIENTATION, this);
    this.store.addParameterObserver(null, uris.LISTENER_POSITION_X, this);
    this.store.addParameterObserver(null, uris.LISTENER_POSITION_Y, this);
    this.store.addParameterObserver(null, uris.LISTENER_POSITION_Z, this);
    this.store.addTypeObserver(uris.PLAY, this);
  }

  getStore(): SuperDymoStore {
    return this.store;
  }

  isLoggingOn() {
    return this.loggingOn;
  }

  async play(dymoUri: string, afterUri?: string): Promise<any> {
    if (!this.currentPlayers.has(dymoUri)) {
      let newPlayer = new HierarchicalPlayer(dymoUri, this.store, null,
        this.scheduler, this);
      this.currentPlayers.set(dymoUri, newPlayer);
      if (afterUri) {
        const ending = this.currentPlayers.get(afterUri).getEndingPromise();
        await ending; //TODO LETS SEE HOW WELL THIS WORKS!
      }
      await newPlayer.play();
      this.currentPlayers.delete(dymoUri);
    }
  }

  async stop(dymoUri?: string) {
    //console.log(this.currentPlayers, this.playingDymoUris.value, this.playingObjects)
    if (dymoUri && this.currentPlayers.has(dymoUri)) {
      await this.currentPlayers.get(dymoUri).stop();
      this.currentPlayers.delete(dymoUri);
    } else if (!dymoUri) {
      const players = Array.from(this.currentPlayers.values())
      await Promise.all(players.map(p => p.stop()));
      this.currentPlayers = new Map<string,HierarchicalPlayer>();
      this.playingObjects = [];
      this.updatePlayingDymoUris([]);
    }
  }

  isPlaying(dymoUri?: string) {
    return dymoUri ? this.currentPlayers.has(dymoUri)
      : this.currentPlayers.size > 0;
  }

  getPosition(dymoUri: string) {
    if (this.currentPlayers.has(dymoUri)) {
      return this.currentPlayers.get(dymoUri).getPosition();
    }
  }

  getPlayingDymoUrisArray(): string[] {
    return this.playingDymoUris.getValue();
  }

  getPlayingDymoUris(): Observable<string[]> {
    return this.playingDymoUris.asObservable();
  }

  private updatePlayingDymoUris(dymoUris: string[]) {
    dymoUris = _.uniq(dymoUris);
    dymoUris.sort(natsort());
    dymoUris = dymoUris.map(uri => uri.replace(uris.CONTEXT_URI, ""));
    this.playingDymoUris.next(dymoUris);
  }

  async objectStarted(object: ScheduledObject) {
    this.playingObjects.push(object);
    let uris = this.playingDymoUris.getValue();
    uris = uris.concat(await object.getUris());
    this.updatePlayingDymoUris(uris);
  }

  async objectEnded(object: ScheduledObject) {
    if (removeFrom(object, this.playingObjects)) {
      let uris = _.flatten(await Promise.all(this.playingObjects.map(o => o.getUris())));
      this.updatePlayingDymoUris(uris);
    }
  }

  async observedValueChanged(paramUri, paramType, value) {
    if (paramType == uris.LISTENER_ORIENTATION) {
      var angleInRadians = value * 2 * Math.PI; //[0,1] -> [0,2PI]
      this.scheduler.setListenerOrientation(Math.sin(angleInRadians), 0, -Math.cos(angleInRadians), 0, 1, 0);
    } else if (paramType == uris.LISTENER_POSITION_X || paramType == uris.LISTENER_POSITION_Y || paramType == uris.LISTENER_POSITION_Z) {
      const x = await this.store.findParameterValue(null, uris.LISTENER_POSITION_X);
      const y = await this.store.findParameterValue(null, uris.LISTENER_POSITION_Y);
      let z = await this.store.findParameterValue(null, uris.LISTENER_POSITION_Z);
      z = z ? z : 1;
      this.scheduler.setListenerPosition(x, y, z);
    } else if (paramType == uris.PLAY) {
      var dymoUri = await this.store.findSubject(uris.HAS_PARAMETER, paramUri);
      if (value > 0) {
        this.play(dymoUri);
      } else {
        this.stop(dymoUri);
      }
    }
  }

}

export class HierarchicalPlayer {

  private navigator: Navigator;
  private scheduledObjects: ScheduledObject[] = []; //all currently playing
  private partPlayers: HierarchicalPlayer[] = [];
  private isPlaying: boolean = false;
  private endingPromise: Promise<ScheduledObject>;

  constructor(
    private dymoUri: string,
    private store: SuperDymoStore,
    private referenceObject: ScheduledObject, //object to schedule relative to
    private scheduler: DymoScheduler,
    private dymoPlayer: MultiPlayer
  ) { }

  getStore() {
    return this.store;
  }

  getEndingPromise(): Promise<ScheduledObject> {
    return this.endingPromise;
  }

  /** returns the last object scheduled before this player is done */
  play(): Promise<ScheduledObject> {
    this.isPlaying = true;
    this.endingPromise = this.recursivePlay();
    return this.endingPromise;
  }

  async stop() {
    this.isPlaying = false;
    await Promise.all(this.partPlayers.map(p => p.stop()));
    return Promise.all(
      this.scheduledObjects.map(o => o ? o.stop() : null));
  }

  objectStarted(object: ScheduledObject) {
    this.dymoPlayer.objectStarted(object);
  }

  objectEnded(object: ScheduledObject) {
    removeFrom(object, this.scheduledObjects);
    this.dymoPlayer.objectEnded(object);
  }

  getPosition() {
    return this.navigator.getPosition();
  }

  private async recursivePlay(): Promise<ScheduledObject> {
    //stop playing when stopped from outside
    if (this.isPlaying) {
      //TODO PLAY AND OBSERVE MAIN DURATION ... should override part players...
      this.navigator = this.navigator || await getNavigator(this.dymoUri, this.store);
      const next = await this.navigator.next();
      
      if (next) {
        if (this.dymoPlayer.isLoggingOn()) console.log(
          await Promise.all(next.map(async n => await this.store.findFeatureValue(n, uris.LEVEL_FEATURE)
            + "." + await this.store.findFeatureValue(n, uris.INDEX_FEATURE))));
        let objects: ScheduledObject[] = [];
        if (await this.navigator.hasParts()) {
          this.partPlayers = next.map(p => new HierarchicalPlayer(
            p, this.store, this.referenceObject, this.scheduler, this.dymoPlayer));
          objects.push(...await Promise.all(this.partPlayers.map(p => p.play())));
        } else {
          //only playing leaf nodes :/
          objects.push(await this.scheduler.schedule(
              this.dymoUri, this.referenceObject, this));
        }
        /*objects.push(await this.scheduler.schedule(
            this.dymoUri, this.referenceObject, this));*/
        //TODO if this stops, stop parts! (make function dependent on objectEnded...)
        await this.addScheduledObjectsAndUpdateReference(objects);
        return this.recursivePlay();
      }
    }
    return this.referenceObject;
  }
  
  //CURRENTLY SHORTEST LAST!!! (SET BACK TO LONGEST ONCE DURATION OF PARENTS OBSERVED ABOVE)
  //adds group of simultaneously scheduled objects, longest last
  /*TODO could be improved once schedulo permits scheduling after group
    of objects with variable duration!*/
  /*TODO also, override with this duration if there is one! (e.g. sequence
    with a variable duration regardless of its parts' durations)*/
  private async addScheduledObjectsAndUpdateReference(objects: ScheduledObject[]) {
    objects = objects.filter(o => o); //ignore undefined TODO NECESSARY STILL?
    let durs = await Promise.all(objects.map(o => o.getParam(uris.DURATION)));
    this.referenceObject = objects[durs.indexOf(_.max(durs))];
    this.scheduledObjects = this.scheduledObjects.concat(objects);
  }

}


//USE CASES
//sequence where parent and children have audio
//sequence with varying main duration



//looping file


//looping conjunction of two looping files


