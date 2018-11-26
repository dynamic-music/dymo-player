import "jasmine";
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
  
  it("reacts to dymo types", async () => {
    await store.addTriple("dymo1", uris.CDT, uris.CONJUNCTION);
    await player.play("dymo1");
    expectScheduled([[5,7,10],[6,11],[12],[9]]);
  });
  
  function expectScheduled(dymoIndices: number[][]) {
    const uris = scheduler.getScheduledObjects()
      .map(os => os.map(o => o.getUri()));
    //console.log(uris)
    const expected = dymoIndices.map(is => is.map(i => "dymo"+i));
    expect(uris).toEqual(expected);
  }

});