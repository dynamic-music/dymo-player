import "jasmine";
import { uris, SuperDymoStore } from 'dymo-core';
import { MultiPlayer } from  "../src/players";
import { DummyScheduler } from  "../src/scheduler";
import { getStoreWithDymo } from './util';

describe("a player", () => {
  
  let store: SuperDymoStore;

  beforeEach(async () => {
    store = await getStoreWithDymo();
  });
  
  it("normally plays sequentially", async () => {
    const scheduler = new DummyScheduler(0);
    const player = new MultiPlayer(store, scheduler);
    await player.play("dymo1");
    const uris = scheduler.getScheduledObjects().map(o => o.getUri());
    expect(uris).toEqual(createDymoNames(5,6,7,11,12,9,10));
  });
  
  function createDymoNames(...indexes: number[]) {
    return indexes.map(i => "dymo"+i);
  }

});