import "jasmine";
import * as _ from 'lodash';
import { DymoGenerator, uris } from 'dymo-core';
import { MultiPlayer } from  "../src/players";
import { DummyScheduler } from  "../src/dummy";
import { getStoreWithDymo } from './util';

describe("a player", () => {
  
  const DYMO1_PARTS = [[[5],[6]], [[7],[11],[12],[9]], [[10]]];
  let generator: DymoGenerator;
  let scheduler: DummyScheduler;
  let player: MultiPlayer;

  beforeEach(async () => {
    //(1:(2:5,6),(3:7,(8:11,12),9),(4:10)))
    const store = await getStoreWithDymo();
    generator = new DymoGenerator(false, store);
    scheduler = new DummyScheduler();
    player = new MultiPlayer(store, scheduler);
  });
  
  it("normally plays sequentially", async () => {
    await player.play("dymo1");
    expectScheduled(_.flatten(DYMO1_PARTS));
  });
  
  it("handles conjunctions", async () => {
    await generator.setDymoType("dymo1", uris.CONJUNCTION);
    await player.play("dymo1");
    expectScheduled(zipUnevenFlat(DYMO1_PARTS));
  });
  
  it("handles disjunctions", async () => {
    await generator.setDymoType("dymo1", uris.DISJUNCTION);
    await player.play("dymo1");
    expectScheduled(...DYMO1_PARTS);
  });
  
  it("handles reverse", async () => {
    await generator.setDymoType("dymo1", uris.REVERSE);
    await player.play("dymo1");
    expectScheduled(_.flatten(_.reverse(_.clone(DYMO1_PARTS))));
  });
  
  it("handles permutations", async () => {
    await generator.setDymoType("dymo1", uris.PERMUTATION);
    await player.play("dymo1");
    expectScheduled(...getPermutations(DYMO1_PARTS).map(_.flatten));
  });
  
  it("handles subsets", async () => {
    await generator.setDymoType("dymo1", uris.SUBSET);
    await player.play("dymo1");
    expectScheduled(...getSubsets(DYMO1_PARTS).map(zipUnevenFlat));
  });
  
  it("handles subsets of a given size", async () => {
    await generator.setDymoType("dymo1", uris.SUBSET, 2);
    await player.play("dymo1");
    expectScheduled(...getSubsets(DYMO1_PARTS).map(zipUnevenFlat));
  });
  
  it("handles selections", async () => {
    await generator.setDymoType("dymo1", uris.SELECTION, 1);
    await player.play("dymo1");
    expectScheduled(DYMO1_PARTS[1]);
  });
  
  it("handles multiselections", async () => {
    await generator.setDymoType("dymo1", uris.MULTI_SELECTION, [0,2]);
    await player.play("dymo1");
    expectScheduled(zipUnevenFlat([DYMO1_PARTS[0],DYMO1_PARTS[2]]));
  });
  
  //onsets
  //durations!!!
  //LOOP AND REPEAT
  
  function expectScheduled(...dymoIndices: number[][][]) {
    expect(indicesToUris(...dymoIndices)).toContain(getScheduledUris());
  }
  
  function indicesToUris(...dymoIndices: number[][][]) {
    return dymoIndices.map(k => k.map(j => j.map(i => "dymo"+i)));
  }
  
  function getScheduledUris() {
    return scheduler.getScheduledObjects().map(os => os.map(o => o.getUri()));
  }
  
  function getPermutations<T>(a: T[]) {
    return permute(_.clone(a));
  }
  
  //Heap's algorithm
  function permute<T>(a: T[], n = a.length, r: T[][] = []) {
    if (n == 1) r.push(_.clone(a));
    else {
      _.range(n-1).forEach(i => {
        permute(a, n-1, r);
        swap(a, n%2 ? 0 : i, n-1);
      });
      permute(a, n-1, r);
    }
    return r;
  }
  
  function swap(a: any[], i1: number, i2: number) {
    [a[i1], a[i2]] = [a[i2], a[i1]];
  }
  
  function getSubsets<T>(a: T[]) {
    const init: T[][] = [[]];
    return a.reduce((sets, v) =>
      sets.concat(sets.map(s => [...s, v])), init);
  }
  
  function zipUnevenFlat<T>(a: T[][][]) {
    return _.zip(...a).map(z => _.flatten(z.filter(i => i)));
  }

});