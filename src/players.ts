import * as _ from 'lodash';
import * as natsort from 'natsort';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
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
    this.store.addParameterObserver(null, uris.LISTENER_ORIENTATION, this);
    this.store.addTypeObserver(uris.PLAY, this);
  }

  getStore(): SuperDymoStore {
    return this.store;
  }

  getAudioBank() {
    return this.scheduler.getAudioBank();
  }

  isLoggingOn() {
    return this.loggingOn;
  }

  async play(dymoUri: string, afterUri?: string): Promise<any> {
    if (!this.currentPlayers.has(dymoUri)) {
      let newPlayer = new HierarchicalPlayer(dymoUri, this.store, null,
        this.scheduler, this, true);
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
    } else {
      const players = Array.from(this.currentPlayers.values())
      await Promise.all(players.map(p => p.stop()));
      this.currentPlayers = new Map<string,HierarchicalPlayer>();
      this.playingObjects = [];
      this.updatePlayingDymoUris([]);
    }
  }

  isPlaying(dymoUri: string) {
    return this.currentPlayers.has(dymoUri);
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

  objectStarted(object: ScheduledObject) {
    this.playingObjects.push(object);
    let uris = this.playingDymoUris.getValue();
    uris = uris.concat(object.getUris());
    this.updatePlayingDymoUris(uris);
  }

  objectEnded(object: ScheduledObject) {
    if (removeFrom(object, this.playingObjects)) {
      let uris = _.flatten(this.playingObjects.map(o => o.getUris()));
      this.updatePlayingDymoUris(uris);
    }
  }

  async observedValueChanged(paramUri, paramType, value) {
    if (paramType == uris.LISTENER_ORIENTATION) {
      var angleInRadians = value / 180 * Math.PI;
      this.scheduler.setListenerOrientation(Math.sin(angleInRadians), 0, -Math.cos(angleInRadians), 0, 1, 0);
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
  private scheduledObjects: ScheduledObject[] = [];
  private partPlayers: HierarchicalPlayer[] = [];
  private isPlaying: boolean = false;
  private endingPromise: Promise<ScheduledObject>;

  constructor(private dymoUri: string, private store: SuperDymoStore,
    private referenceObject: ScheduledObject, private scheduler: DymoScheduler,
    private dymoPlayer: MultiPlayer, private initRefTime: boolean
  ) {}

  getStore() {
    return this.store;
  }

  getLastScheduledObject() {
    return _.last(this.scheduledObjects);
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
    await Promise.all(this.partPlayers.map(p => p.stop()));
    this.isPlaying = false;
    return Promise.all(this.scheduledObjects.map(o => o.stop()));
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
    if (!this.isPlaying) {
      return Promise.resolve(_.last(this.scheduledObjects));
    }
    //TODO PLAY AND OBSERVE MAIN DURATION ... should override part players...
    //THEN MAKE PLAYER FOR NAVIGATED PART IF THERE IS ONE
    if (!this.navigator) {
      this.navigator = await getNavigator(this.dymoUri, this.store);
    }
    let next = await this.navigator.next();

    let currentReference = this.getLastScheduledObject();
    currentReference = currentReference ? currentReference : this.referenceObject;

    if (await this.navigator.hasParts()) {
      if (next && next.uris) {
        if (this.dymoPlayer.isLoggingOn()) console.log(next.uris);
        this.partPlayers = next.uris.map(p => new HierarchicalPlayer(
          p, this.store, currentReference, this.scheduler, this.dymoPlayer,
          next.initRefTime
        ));
        //TODO COMBINE THE ELSE BELOW WITH THIS!!!!
        this.addScheduledObjects(await Promise.all(
          this.partPlayers.map(p => p.play())
        ));
        return this.recursivePlay();
      } else {
        //for now return the currently longest of the last scheduled objects
        /*TODO could be improved once schedulo permits scheduling after group
          of objects with variable duration!*/
        /*TODO also, override with this duration if there is one! (e.g. sequence
          with a variable duration regardless of its parts' durations)*/
        let lastObjects = this.partPlayers.map(p => p.getLastScheduledObject());
        let durations = await Promise.all(lastObjects.map(o => o.getParam(uris.DURATION)));
        lastObjects.sort((a,b) => durations[lastObjects.indexOf(a)] - durations[lastObjects.indexOf(b)]);
        return Promise.resolve(_.last(lastObjects));
      }
    } else {
      if (next) {
        try {
          //for now, only schedule audio if this has no parts
          this.addScheduledObjects(await Promise.all(next.uris.map(p =>
            this.scheduler.schedule(p, currentReference, this, this.initRefTime))
          ));
          return this.recursivePlay();
        } catch(err) {
          console.log(err)
        }
      } else {
        return Promise.resolve(_.last(this.scheduledObjects));
      }
    }
  }

  private addScheduledObjects(objects: ScheduledObject[]) {
    this.scheduledObjects = this.scheduledObjects.concat(objects);
  }

}


//USE CASES
//sequence where parent and children have audio
//sequence with varying main duration



//looping file


//looping conjunction of two looping files


