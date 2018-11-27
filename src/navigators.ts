import * as _ from 'lodash';
import { Time } from 'schedulo';
import { uris, SuperDymoStore, PartsObserver } from 'dymo-core';

export interface SchedulingInstructions {
  uris: string[],
  initRefTime?: boolean,
  time?: Time
}

export abstract class Navigator implements PartsObserver {

  protected playCount = 0;
  protected parts: string[];

  constructor(protected dymoUri: string, protected store: SuperDymoStore) {
    this.store.addPartsObserver(dymoUri, this);
  }

  async hasParts(): Promise<boolean> {
    if (!this.parts) {
      await this.updateParts();
    }
    return this.parts.length > 0;
  }

  async next(): Promise<SchedulingInstructions> {
    if (!this.parts) {
      await this.updateParts();
    }
    return undefined;
  }

  abstract getPosition(): number;

  protected async keepPlaying(): Promise<boolean> {
    let keepPlaying = !this.playCount || await this.isLoop()
        || await this.repetitions() > this.playCount;
    return keepPlaying;
  }

  private async isLoop(): Promise<boolean> {
    return await this.store.findParameterValue(this.dymoUri, uris.LOOP) || false;
  }

  private async repetitions(): Promise<number> {
    return await this.store.findParameterValue(this.dymoUri, uris.REPEAT) || 0;
  }

  protected toArray(s: string): string[] {
    return s ? [s] : undefined;
  }

  async observedPartsChanged(dymoUri: string) {
    if (dymoUri == this.dymoUri) {
      await this.updateParts();
    }
  }

  private async updateParts() {
    this.parts = await this.store.findParts(this.dymoUri);
  }

}

export abstract class IndexedNavigator extends Navigator {

  protected currentIndex;

  constructor(dymoUri: string, store: SuperDymoStore) {
    super(dymoUri, store);
    this.reset();
  }

  async next() {
    await super.next();
    //check if another pass appropriate
    if (this.currentIndex == this.parts.length && await this.keepPlaying()) {
      this.reset();
    }
    //first next of pass
    if (this.currentIndex == 0) {
      this.playCount++;
    }
    return this.get();
  }

  getPosition(): number {
    return this.currentIndex;
  }

  /** override for any non-index-based reset operation */
  reset() {
    this.currentIndex = 0;
  }

  protected abstract get(): Promise<SchedulingInstructions>;

}

export class SequentialNavigator extends IndexedNavigator {

  async get() {
    return { uris: this.toArray(this.parts[this.currentIndex++]) };
  }

}

export class ReverseSequentialNavigator extends IndexedNavigator {

  async get() {
    let reverseIndex = this.parts.length-1 - this.currentIndex++;
    return { uris: this.toArray(this.parts[reverseIndex]) };
  }

}

export class PermutationNavigator extends IndexedNavigator {

  private permutedIndices: number[];

  reset() {
    super.reset();
    this.permutedIndices = null;
  }

  async get() {
    this.permutedIndices = this.permutedIndices
      || _.shuffle(_.range(this.parts.length));
    return {
      uris: this.toArray(this.parts[this.permutedIndices[this.currentIndex++]])
    };
  }

}

export class OnsetNavigator extends SequentialNavigator {

  async get() {
    const init = this.currentIndex === 0;
    await this.sortParts();
    const superget = await super.get();
    return { uris: superget.uris, initRefTime: init }
  }

  private async sortParts() {
    //sort parts by ONSET if not currently sorted
    //TODO: now this could also observe if the onsets change...
    const onsets = await Promise.all(this.parts.map(p => this.getOnset(p)));
    const sorted = onsets.every((o,i) => i == 0 || o >= onsets[i-1]);
    if (!sorted) {
      this.parts = _.sortBy(this.parts, p => onsets[this.parts.indexOf(p)]);
    }
  }

  private async getOnset(dymoUri: string): Promise<number> {
    return this.store.findParameterValue(dymoUri, uris.ONSET);
  }

}

export abstract class OneshotNavigator extends Navigator {

  async next() {
    await super.next();
    if (await this.keepPlaying()) {
      this.playCount++;
      return this.get();
    }
  }

  abstract async get(): Promise<SchedulingInstructions>;

  getPosition() {
    return 0;
  }

}

export class LeafNavigator extends OneshotNavigator {

  async get() {
    return { uris: this.toArray(this.dymoUri) };
  }

}

export class ConjunctionNavigator extends OneshotNavigator {

  async get() {
    return { uris: this.parts };
  }

}

export class DisjunctionNavigator extends OneshotNavigator {

  async get() {
    return { uris: this.toArray(_.sample(this.parts)) };
  }

}

export class SubsetNavigator extends OneshotNavigator {

  async get() {
    return { uris: _.sampleSize(this.parts, _.random(this.parts.length-1)) };
  }

}

abstract class ParamNavigator extends OneshotNavigator {

  constructor(dymoUri: string, store: SuperDymoStore, private paramUri: string) {
    super(dymoUri, store);
  }
  
  async getParamValue() {
    return this.store.findObjectValue(this.paramUri, uris.VALUE);
  }
  
}

export class SelectionNavigator extends ParamNavigator {

  async get() {
    const indexValue = await this.getParamValue();
    return { uris: this.toArray(this.parts[indexValue]) };
  }

}

export class MultiSelectionNavigator extends ParamNavigator {

  async get() {
    const indicesValue = await this.getParamValue();
    return { uris: indicesValue.map(i => this.parts[i]) };
  }

}

export class MultiRandomNavigator extends ParamNavigator {

  async get() {
    const count = await this.getParamValue();
    return { uris: _.sampleSize(this.parts, count) };
  }

}

const NAVIGATOR_MAP = {
  [uris.CONJUNCTION]: ConjunctionNavigator,
  [uris.DISJUNCTION]: DisjunctionNavigator,
  [uris.SEQUENCE]: SequentialNavigator,
  [uris.REVERSE]: ReverseSequentialNavigator,
  [uris.PERMUTATION]: PermutationNavigator,
  [uris.ONSET_SEQUENCE]: OnsetNavigator,
  [uris.SUBSET]: SubsetNavigator,
  [uris.SELECTION]: SelectionNavigator,
  [uris.MULTI_SELECTION]: MultiSelectionNavigator,
  [uris.MULTI_RANDOM]: MultiRandomNavigator,
}

export async function getNavigator(dymoUri: string, store: SuperDymoStore): Promise<Navigator> {
  const dymoType = await store.findObject(dymoUri, uris.CDT);
  const parts = await store.findParts(dymoUri);
  if (dymoType) {
    const navClass: any = NAVIGATOR_MAP[dymoType]
      || NAVIGATOR_MAP[await store.findObject(dymoType, uris.TYPE)];
    const param = await store.findObject(dymoType, uris.HAS_TYPE_PARAM);
    return new navClass(dymoUri, store, param);
  } else if (parts.length > 0) {
    if (await store.findParameterValue(parts[0], uris.ONSET) != null) {
      return new OnsetNavigator(dymoUri, store);
    }
    return new SequentialNavigator(dymoUri, store);
  } else {
    return new LeafNavigator(dymoUri, store);
  }
}

