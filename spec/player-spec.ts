import "jasmine";
import { uris, SuperDymoStore } from 'dymo-core';
import { MultiPlayer } from  "../src/players";
import { DummyScheduler } from  "../src/scheduler";
import { getStoreWithDymo } from './util';

describe("a player", () => {
  
  let store: SuperDymoStore;

  beforeEach(async done => {
    store = await getStoreWithDymo();
    done();
  });
  
  it("normally plays sequentially", async done => {
    const player = new MultiPlayer(store, new DummyScheduler(0));
    player.play("dymo1");
    setTimeout(done, 200);
    //TODO CHECK IF SEQUENCE ALRIGHT
  });

});