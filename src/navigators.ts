import * as _ from 'lodash';
import { uris, SuperDymoStore, PartsObserver } from 'dymo-core';

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

  async next(): Promise<string[]> {
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

  protected abstract get(): Promise<string[]>;

}

export class SequentialNavigator extends IndexedNavigator {

  async get() {
    return this.toArray(this.parts[this.currentIndex++]);
  }

}

export class ReverseSequentialNavigator extends IndexedNavigator {

  async get() {
    let reverseIndex = this.parts.length-1 - this.currentIndex++;
    return this.toArray(this.parts[reverseIndex]);
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
    return this.toArray(this.parts[this.permutedIndices[this.currentIndex++]]);
  }

}

export class OnsetNavigator extends SequentialNavigator {

  async get() {
    await this.sortParts();
    return super.get();
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

  abstract async get(): Promise<string[]>;

  getPosition() {
    return 0;
  }

}

export class LeafNavigator extends OneshotNavigator {

  async get() {
    return this.toArray(this.dymoUri);
  }

}

export class ConjunctionNavigator extends OneshotNavigator {

  async get() {
    return this.parts;
  }

}

export class DisjunctionNavigator extends OneshotNavigator {

  async get() {
    return this.toArray(_.sample(this.parts));
  }

}

abstract class ParamNavigator extends OneshotNavigator {

  constructor(dymoUri: string, store: SuperDymoStore, private paramUri: string) {
    super(dymoUri, store);
  }
  
  async getParamValue() {
    if (this.paramUri) {
      return this.store.findObjectValue(this.paramUri, uris.VALUE);
    }
  }
  
}

export class SubsetNavigator extends ParamNavigator {

  async get() {
    const size = await this.getParamValue() || _.random(1, this.parts.length-1);
    const sample = _.sampleSize(this.parts, size);
    return this.parts.filter(p => sample.indexOf(p) >= 0);//maintains the order
  }

}

export class SelectionNavigator extends ParamNavigator {

  async get() {
    const indexValue = await this.getParamValue() || 0;
    return this.toArray(this.parts[indexValue]);
  }

}

export class MultiSelectionNavigator extends ParamNavigator {

  async get() {
    const indicesValue = await this.getParamValue() || [0];
    return indicesValue.map(i => this.parts[i]);
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
  [uris.EVENT]: LeafNavigator
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

