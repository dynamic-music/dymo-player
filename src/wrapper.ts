import { ScheduloObject, Parameter, Time, Stop } from 'schedulo';
import { uris } from 'dymo-core';
import { HierarchicalPlayer } from './players';
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
PAIRINGS.set(uris.TIME_STRETCH_RATIO, Parameter.TimeStretchRatio);

export class ScheduloScheduledObject extends ScheduledObject {

  private typeToBehavior = new Map<string,string>();
  private dymoToParam = new Map<string,string>();
  private attributeToType = new Map<string,string>();
  private attributeToValue = new Map<string,number>();
  private attributeToValueAfterBehavior = new Map<string,number>();
  private observedParams: [string, string][] = [];
  private object: ScheduloObject;
  private ready: Promise<any>;

  constructor(dymoUri: string, private previousObject: ScheduloScheduledObject,
      player: HierarchicalPlayer) {
    super(dymoUri, player);
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
      this.observedParams.push([dymoUri, typeUri]);
    }
    let value = await this.store.findAttributeValue(dymoUri, typeUri);
    this.dymoToParam.set(dymoUri, attributeUri);
    this.attributeToType.set(attributeUri, typeUri);
    //if (value != null) {
      this.attributeToValue.set(attributeUri, value);
    //}
  }

  async getSourcePath() {
    return this.store.getSourcePath(this.dymoUri);
  }

  async isEvent() {
    const type = await this.store.findObject(this.dymoUri, uris.CDT);
    return type === uris.EVENT;
  }

  async getTriggerFunction() {
    const target = await this.store.findObject(this.dymoUri, uris.HAS_TARGET);
    const value = await this.store.findObjectValue(this.dymoUri, uris.VALUE);
    return () => this.store.setValue(target, uris.VALUE, value);
  }

  setScheduloObject(object: ScheduloObject) {
    this.object = object;
    this.object.on('playing', () => this.player.objectStarted(this));
    this.object.on('stopped', this.stopped.bind(this));
    this.attributeToValueAfterBehavior.forEach((value, typeUri) =>
      this.setObjectParam(typeUri, value));
  }

  getScheduloObject(): ScheduloObject {
    return this.object;
  }

  getDuration(): number {
    return this.object.getDuration();
  }

  async getParam(paramUri: string): Promise<number> {
    await this.ready;
    return this.attributeToValueAfterBehavior.get(paramUri);
  }

  //done playing naturally (schedulo)
  private async stopped() {
    this.player.objectEnded(this);
    await this.removeFromObservers();
  }

  //stopped from above (dymo player)
  stop() {
    if (this.object) {
      this.object.stop(Time.Asap, Stop.Asap);
    }
    return this.removeFromObservers();
  }

  private async removeFromObservers() {
    return Promise.all(this.observedParams.map(([dymoUri, typeUri]) =>
      this.store.removeParameterObserver(dymoUri, typeUri, this)
    ));
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
      //ignore onset if no previous value...
      if (typeUri !== uris.ONSET || (this.previousObject && value != null)) {
        //merge panning into list
        if (typeUri === uris.PAN || typeUri === uris.DISTANCE || typeUri === uris.HEIGHT) {
          let pan = this.attributeToValueAfterBehavior.get(uris.PAN);
          let dist = this.attributeToValueAfterBehavior.get(uris.DISTANCE);
          let heig = this.attributeToValueAfterBehavior.get(uris.HEIGHT);
          pan = pan ? pan : 0;
          dist = dist ? dist : 0;
          heig = heig ? heig : 0;
          value = [pan, dist, heig];
        }
        //deal with onset specifically
        if (typeUri === uris.ONSET ) {
          const previousOnset = await this.previousObject.getParam(uris.ONSET);
          if (value-previousOnset >= 0) {
            //console.log(this.previousObject.getStartTime(), value, previousOnset, this.previousObject.getStartTime()+value-previousOnset)
            value = value-previousOnset;
          } else {
            value = value+this.previousObject.getDuration();
          }
        }
        //console.log(this.dymoUri, typeUri, value);
        this.object.set(target, value);
      }
    }
  }

  observedValueChanged(paramUri: string, paramType: string, value: number) {
    this.attributeToValue.set(paramUri, value);
    this.updateObjectParam(paramType);
  }

}