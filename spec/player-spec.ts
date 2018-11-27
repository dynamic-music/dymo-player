import "jasmine";
import * as _ from 'lodash';
import { SuperDymoStore, uris } from 'dymo-core';
import { MultiPlayer } from  "../src/players";
import { DummyScheduler } from  "../src/dummy";
import { getStoreWithDymo } from './util';

describe("a player", () => {
  
  let store: SuperDymoStore;
  let scheduler: DummyScheduler;
  let player: MultiPlayer;

  beforeEach(async () => {
    //(1:(2:5,6),(3:7,(8:11,12),9),(4:10)))
    store = await getStoreWithDymo();
    scheduler = new DummyScheduler();
    player = new MultiPlayer(store, scheduler);
  });
  
  it("normally plays sequentially", async () => {
    await player.play("dymo1");
    expectScheduled([[5],[6],[7],[11],[12],[9],[10]]);
  });
  
  it("handles conjunctions", async () => {
    await store.addTriple("dymo1", uris.CDT, uris.CONJUNCTION);
    await player.play("dymo1");
    expectScheduled([[5,7,10],[6,11],[12],[9]]);
  });
  
  it("handles disjunctions", async () => {
    await store.addTriple("dymo1", uris.CDT, uris.DISJUNCTION);
    await player.play("dymo1");
    expectScheduled([[5],[6]], [[7],[11],[12],[9]], [[10]]);
  });
  
  it("handles reverse", async () => {
    await store.addTriple("dymo1", uris.CDT, uris.REVERSE);
    await player.play("dymo1");
    expectScheduled([[10],[9],[12],[11],[7],[6],[5]]);
  });
  
  it("handles permutations", async () => {
    await store.addTriple("dymo1", uris.CDT, uris.PERMUTATION);
    await player.play("dymo1");
    const expected = getPermutations([[[5],[6]], [[7],[11],[12],[9]], [[10]]])
      .map(p => _.flatten(p));
    expectScheduled(...expected);
  });
  
  it("handles selections", async () => {
    const indexValue = await store.createBlankNode();
    await store.setValue(indexValue, uris.VALUE, 1);
    const selection = await store.addTriple(null, uris.TYPE, uris.SELECTION);
    await store.addTriple(selection, uris.HAS_TYPE_PARAM, indexValue);
    await store.addTriple("dymo1", uris.CDT, selection);
    await player.play("dymo1");
    expectScheduled([[7],[11],[12],[9]]);
  });
  
  it("handles multiselections", async () => {
    const indexValue = await store.createBlankNode();
    await store.setValue(indexValue, uris.VALUE, [0,2]);
    const selection = await store.addTriple(null, uris.TYPE, uris.MULTI_SELECTION);
    await store.addTriple(selection, uris.HAS_TYPE_PARAM, indexValue);
    await store.addTriple("dymo1", uris.CDT, selection);
    await player.play("dymo1");
    expectScheduled([[5,10],[6]]);
  });
  
  //randomselection
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
  
  //Heap's algorithm
  function getPermutations<T>(a: T[], n = a.length, r: T[][] = []) {
    if (n == 1) r.push(_.clone(a));
    else {
      _.range(n-1).forEach(i => {
        getPermutations(a, n-1, r);
        swap(a, n%2 ? 0 : i, n-1);
      });
      getPermutations(a, n-1, r);
    }
    return r;
  }
  
  function swap(a: any[], i1: number, i2: number) {
    [a[i1], a[i2]] = [a[i2], a[i1]];
  }

});