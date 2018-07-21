import { AudioObject, Parameter, Time, Stop } from 'schedulo';
import { uris, SuperDymoStore } from 'dymo-core';
import { DymoPlayer } from './player';
import { ScheduledObject } from './scheduler';

//list of used features to speed up init
const FEATURES = [uris.TIME_FEATURE, uris.DURATION_FEATURE];

const PAIRINGS = new Map<string,number>();
PAIRINGS.set(uris.TIME_FEATURE, Parameter.Offset);
PAIRINGS.set(uris.DURATION_FEATURE, Parameter.Duration);
PAIRINGS.set(uris.ONSET, Parameter.StartTime);
PAIRINGS.set(uris.DURATION, Parameter.Duration);
PAIRINGS.set(uris.DURATION_RATIO, Parameter.DurationRatio);
PAIRINGS.set(uris.AMPLITUDE, Parameter.Amplitude);
PAIRINGS.set(uris.PAN, Parameter.Panning);
PAIRINGS.set(uris.DISTANCE, Parameter.Panning);
PAIRINGS.set(uris.HEIGHT, Parameter.Panning);
PAIRINGS.set(uris.REVERB, Parameter.Reverb);
PAIRINGS.set(uris.DELAY, Parameter.Delay);
//PAIRINGS.set(uris.LOOP, Parameter.Loop);
PAIRINGS.set(uris.PLAYBACK_RATE, Parameter.PlaybackRate);

export class ScheduloScheduledObject extends ScheduledObject {

  private typeToBehavior = new Map<string,string>();
  private dymoToParam = new Map<string,string>();
  private attributeToType = new Map<string,string>();
  private attributeToValue = new Map<string,number>();
  private attributeToValueAfterBehavior = new Map<string,number>();
  private object: AudioObject;
  private ready: Promise<any>;

  constructor(dymoUri: string, private previousObject: ScheduloScheduledObject,
      store: SuperDymoStore, player: DymoPlayer) {
    super(dymoUri, store, player);
    this.init2();
  }

  private async init2() {
    this.ready = Promise.all([...PAIRINGS.keys()].map(async (typeUri) => {
      await this.initAttribute(this.dymoUri, typeUri);
      //if behavior not independent, init parent attributes
      let behavior = await this.store.findObject(typeUri, uris.HAS_BEHAVIOR);
      this.typeToBehavior.set(typeUri, behavior);
      if (behavior && behavior !== uris.INDEPENDENT) {
        await Promise.all(this.parentUris.map(p => this.initAttribute(p, typeUri)));
      }
      this.updateObjectParam(typeUri);
    }));
  }

  private async initAttribute(dymoUri: string, typeUri: string) {
    let attributeUri: string;
    if (FEATURES.indexOf(typeUri) >= 0) {
      attributeUri = await this.store.setFeature(dymoUri, typeUri);
    } else {
      attributeUri = await this.store.addParameterObserver(dymoUri, typeUri, this);
    }
    let value = await this.store.findAttributeValue(dymoUri, typeUri);
    this.dymoToParam.set(dymoUri, attributeUri);
    this.attributeToType.set(attributeUri, typeUri);
    //if (value != null) {
      this.attributeToValue.set(attributeUri, value);
    //}
  }

  setScheduloObject(object: AudioObject) {
    this.object = object;
    this.object.on('playing', () => this.player.objectStarted(this));
    this.object.on('stopped', () => this.player.objectEnded(this));
    this.attributeToValueAfterBehavior.forEach((value, typeUri) =>
      this.setObjectParam(typeUri, value));
  }

  getScheduloObject(): AudioObject {
    return this.object;
  }

  getDuration(): number {
    return this.object.getDuration();
  }

  async getParam(paramUri: string): Promise<number> {
    await this.ready;
    return this.attributeToValueAfterBehavior.get(paramUri);
  }

  stop() {
    if (this.object) {
      this.object.stop(Time.Asap, Stop.Asap);
    }
    PAIRINGS.forEach((attribute, typeUri) => {
      if (FEATURES.indexOf(typeUri) >= 0) {
        this.store.removeParameterObserver(this.dymoUri, typeUri, this);
        //TODO REMOVE OBSERVERS FOR ALL PARENTS!!!!!!
      }
    })
  }

  private updateObjectParam(typeUri: string) {
    //console.log("UPDATE", typeUri)
    //TODO GO THROUGH ALL PARENTS AND PROCESS (* or +...)
    let paramsOfType = [...this.attributeToType.keys()].filter(p => this.attributeToType.get(p) === typeUri);
    let allValues = paramsOfType.map(p => this.attributeToValue.get(p)).filter(v => v != null);

    //calculate value based on behavior
    let value;
    if (allValues.length > 0) {
      if (this.typeToBehavior.get(typeUri) === uris.ADDITIVE) {
        value = allValues.reduce((a,b) => a+b);
      } else if (this.typeToBehavior.get(typeUri) === uris.MULTIPLICATIVE) {
        value = allValues.reduce((a,b) => a*b);
      } else {
        value = allValues[0]; //only one value since parents not added...
      }
    }

    //merge panning into list
    if (typeUri === uris.PAN || typeUri === uris.DISTANCE || typeUri === uris.HEIGHT) {
      let pan = this.attributeToValue.get(uris.PAN);
      let dist = this.attributeToValue.get(uris.DISTANCE);
      let heig = this.attributeToValue.get(uris.HEIGHT);
      if (pan != null && dist != null && heig != null) {
        value = [pan, dist, heig];
      } else {
        value = null;
      }
    }

    //update the schedulo object
    if (value != null) {
      //console.log(typeUri, value)
      this.attributeToValueAfterBehavior.set(typeUri, value);
      this.setObjectParam(typeUri, value);
    }
  }

  private async setObjectParam(typeUri: string, value) {
    if (this.object) {
      const target = PAIRINGS.get(typeUri) || PAIRINGS.get(typeUri);
      //deal with onset specifically
      if (typeUri !== uris.ONSET || (this.previousObject && value != null)) {
        if (typeUri === uris.ONSET ) {
          const previousOnset = await this.previousObject.getParam(uris.ONSET);
          if (value-previousOnset >= 0) {
            //console.log(this.previousObject.getStartTime(), value, previousOnset, this.previousObject.getStartTime()+value-previousOnset)
            value = value-previousOnset;
          } else {
            value = value+this.previousObject.getDuration();
          }
        }
        this.object.set(target, value);
      }
    }
  }

  observedValueChanged(paramUri: string, paramType: string, value: number) {
    this.attributeToValue.set(paramUri, value);
    this.updateObjectParam(paramType);
  }

}